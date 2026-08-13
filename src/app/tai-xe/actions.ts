"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { changeShipmentStatus } from "@/modules/shipments/service";
import {
  nextDriverStep,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { reportIncident } from "@/modules/incidents/service";
import { reportIncidentSchema } from "@/modules/incidents/schema";
import {
  INCIDENT_TYPE_LABELS,
  type IncidentType,
} from "@/modules/incidents/state-machine";
import {
  issueDeliveryOtp,
  recordProofOfDelivery,
} from "@/modules/proof-of-delivery/service";
import { proofOfDeliverySchema } from "@/modules/proof-of-delivery/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Server action cho khu vực tài xế (§26.2).
 *
 * Quyền và assignment kiểm tra trong `changeShipmentStatus` (`requireShipmentUpdateAccess`),
 * không tin gì từ client.
 */

export interface DriverActionResult {
  ok: boolean;
  message?: string;
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
    requestId: generateRequestId(),
  };
}

function toMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "Không cập nhật được. Vui lòng thử lại.";
}

function revalidate(trackingCode: string) {
  revalidatePath("/tai-xe");
  revalidatePath(`/tai-xe/chuyen/${trackingCode}`);
  revalidatePath(`/quan-tri/dieu-phoi/${trackingCode}`);
  revalidatePath(`/tai-khoan/don-hang/${trackingCode}`);
}

/**
 * Đẩy chuyến sang bước kế tiếp — nút CTA duy nhất trên màn hình tài xế.
 *
 * Bước đích do SERVER tính lại từ trạng thái hiện tại, client chỉ gửi trạng thái nó đang
 * thấy. Nếu điều phối vừa đổi trạng thái, `expectedFrom` không khớp và thao tác bị từ chối
 * thay vì nhảy nhầm bước.
 */
export async function advanceStatusAction(
  trackingCode: string,
  expectedFrom: string
): Promise<DriverActionResult> {
  const next = nextDriverStep(expectedFrom as ShipmentStatus);
  if (!next) {
    return { ok: false, message: "Chuyến này không còn bước tự động nào." };
  }

  const actor = await getActor();

  try {
    await changeShipmentStatus(actor, trackingCode, { toStatus: next }, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(trackingCode);

  return { ok: true, message: "Đã cập nhật trạng thái chuyến." };
}

/** Gửi mã xác nhận tới người nhận (§18). */
export async function requestDeliveryOtpAction(
  trackingCode: string
): Promise<DriverActionResult & { maskedPhone?: string }> {
  const actor = await getActor();

  try {
    const result = await issueDeliveryOtp(actor, { trackingCode }, await requestContext());

    return {
      ok: true,
      maskedPhone: result.maskedPhone,
      message: `Đã gửi mã tới số ${result.maskedPhone}. Mã có hiệu lực ${result.expiresInMinutes} phút.`,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

/**
 * Lập biên bản giao hàng (§18).
 *
 * Biên bản là điều kiện bắt buộc để đóng đơn (§15 ràng buộc 2), nên hàm này tự đẩy chuyến
 * sang `COMPLETED` ngay sau khi ghi xong — tài xế không phải nhớ thêm một thao tác nữa.
 * Trường hợp người nhận từ chối thì KHÔNG tự đóng: đó là chuyến thất bại, điều phối quyết
 * định xử lý tiếp.
 */
export async function recordDeliveryAction(
  trackingCode: string,
  formData: FormData
): Promise<DriverActionResult> {
  const parsed = proofOfDeliverySchema.safeParse({
    trackingCode,
    receiverName: String(formData.get("receiverName") ?? ""),
    receiverRelation: String(formData.get("receiverRelation") ?? "") || undefined,
    outcome: String(formData.get("outcome") ?? "DELIVERED_FULL"),
    exceptionReason: String(formData.get("exceptionReason") ?? "") || undefined,
    condition: String(formData.get("condition") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || undefined,
    otp: String(formData.get("otp") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();
  const context = await requestContext();

  try {
    await recordProofOfDelivery(actor, parsed.data, context);
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  // Đóng đơn là bước riêng: biên bản đã ghi xong và không được mất nếu bước này lỗi.
  if (parsed.data.outcome !== "REFUSED") {
    try {
      await changeShipmentStatus(actor, trackingCode, { toStatus: "COMPLETED" }, context);
    } catch (error) {
      revalidate(trackingCode);
      return {
        ok: true,
        message: `Đã lập biên bản giao hàng, nhưng chưa đóng được đơn: ${toMessage(error)}`,
      };
    }
  }

  revalidate(trackingCode);

  return {
    ok: true,
    message:
      parsed.data.outcome === "REFUSED"
        ? "Đã ghi nhận người nhận từ chối. Điều phối sẽ xử lý tiếp."
        : "Đã lập biên bản giao hàng và hoàn tất chuyến.",
  };
}

/**
 * Báo sự cố (§19).
 *
 * Tạo bản ghi `Incident` để theo dõi được ai xử lý và kết luận ra sao. Chuyến chỉ tự chuyển
 * sang trạng thái `INCIDENT` khi mức độ đủ nghiêm trọng — chậm trễ vài chục phút không nên
 * làm cả chuyến dừng lại.
 */
export async function reportIncidentAction(
  trackingCode: string,
  formData: FormData
): Promise<DriverActionResult> {
  const description = String(formData.get("reason") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER");

  const parsed = reportIncidentSchema.safeParse({
    trackingCode,
    type,
    // Tài xế chỉ gõ một ô mô tả; tiêu đề lấy từ nhãn loại sự cố để hàng chờ của điều phối
    // đọc được ngay mà không bắt tài xế gõ thêm khi đang đứng giữa đường.
    title: INCIDENT_TYPE_LABELS[type as IncidentType] ?? "Sự cố",
    description,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Vui lòng mô tả sự cố đang gặp.",
    };
  }

  const actor = await getActor();

  let code: string;
  try {
    const result = await reportIncident(actor, parsed.data, await requestContext());
    code = result.code;
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(trackingCode);

  return {
    ok: true,
    message: `Đã ghi nhận sự cố ${code}. Điều phối sẽ liên hệ với bạn.`,
  };
}
