"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import {
  createShipmentFromQuote,
  assignVehicleAndDriver,
  releaseAssignment,
  checkAssignmentConflicts,
} from "@/modules/shipments/dispatch-service";
import { changeShipmentStatus } from "@/modules/shipments/service";
import { setLocationSharing } from "@/modules/locations/service";
import type { ShipmentStatus } from "@/modules/shipments/state-machine";
import {
  createShipmentSchema,
  assignmentSchema,
  changeShipmentStatusSchema,
} from "@/modules/fleet/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/** Server action cho điều phối (§14.3). Quyền kiểm tra trong service. */

export interface DispatchActionResult {
  ok: boolean;
  message?: string;
  trackingCode?: string;
  /** Xung đột phát hiện được, để giao diện hiện cảnh báo và hỏi có override không. */
  conflicts?: string[];
  overridable?: boolean;
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
  return "Thao tác không thành công. Vui lòng thử lại.";
}

export async function createShipmentAction(payload: unknown): Promise<DispatchActionResult> {
  const parsed = createShipmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();

  try {
    const result = await createShipmentFromQuote(actor, parsed.data, await requestContext());

    revalidatePath("/quan-tri/dieu-phoi");
    revalidatePath("/quan-tri/don-hang");
    revalidatePath("/quan-tri");

    return {
      ok: true,
      trackingCode: result.trackingCode,
      message: `Đã tạo đơn hàng ${result.trackingCode}.`,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

/** Xem trước xung đột mà không ghi gì — dùng khi dispatcher đổi lựa chọn trên form. */
export async function previewConflictsAction(input: {
  vehicleId: string | null;
  primaryDriverId: string | null;
  secondaryDriverId: string | null;
  effectiveFrom: string;
  effectiveTo: string;
  /** Chuyến đang phân công lại — phân công cũ của nó không tính là xung đột. */
  trackingCode?: string;
}): Promise<DispatchActionResult> {
  const actor = await getActor();

  try {
    const preview = await checkAssignmentConflicts(actor, {
      vehicleId: input.vehicleId,
      primaryDriverId: input.primaryDriverId,
      secondaryDriverId: input.secondaryDriverId,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: new Date(input.effectiveTo),
      excludeTrackingCode: input.trackingCode,
    });

    return {
      ok: true,
      conflicts: preview.conflicts.map((c) => c.message),
      overridable: preview.overridable,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

export async function assignAction(
  trackingCode: string,
  payload: unknown
): Promise<DispatchActionResult> {
  const parsed = assignmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();

  try {
    await assignVehicleAndDriver(actor, trackingCode, parsed.data, await requestContext());
  } catch (error) {
    // DOUBLE_BOOKING mang thông báo mô tả rõ xung đột — chuyển thẳng ra giao diện.
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/quan-tri/dieu-phoi/${trackingCode}`);
  revalidatePath("/quan-tri/dieu-phoi");

  return { ok: true, message: "Đã phân công xe và tài xế." };
}

/** Đổi trạng thái đơn hàng theo state machine (§15). */
export async function changeShipmentStatusAction(
  trackingCode: string,
  formData: FormData
): Promise<DispatchActionResult> {
  const parsed = changeShipmentStatusSchema.safeParse({
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") ?? undefined,
    reasonCode: formData.get("reasonCode") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();

  try {
    await changeShipmentStatus(
      actor,
      trackingCode,
      {
        toStatus: parsed.data.toStatus as ShipmentStatus,
        reason: parsed.data.reason,
        reasonCode: parsed.data.reasonCode,
      },
      await requestContext()
    );
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/quan-tri/dieu-phoi/${trackingCode}`);
  revalidatePath("/quan-tri/dieu-phoi");
  revalidatePath("/quan-tri");

  return { ok: true, message: "Đã cập nhật trạng thái đơn hàng." };
}

/** Bật/tắt cho khách xem vị trí chuyến (§17). */
export async function setLocationSharingAction(
  trackingCode: string,
  enabled: boolean
): Promise<DispatchActionResult> {
  const actor = await getActor();

  try {
    await setLocationSharing(actor, { trackingCode, enabled }, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/quan-tri/dieu-phoi/${trackingCode}`);
  revalidatePath(`/tai-khoan/don-hang/${trackingCode}`);

  return {
    ok: true,
    message: enabled ? "Khách hàng đã xem được vị trí xe." : "Đã tắt chia sẻ vị trí.",
  };
}

export async function releaseAssignmentAction(
  trackingCode: string,
  formData: FormData
): Promise<DispatchActionResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) {
    return { ok: false, message: "Vui lòng nhập lý do gỡ phân công." };
  }

  const actor = await getActor();

  try {
    await releaseAssignment(actor, trackingCode, reason, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/quan-tri/dieu-phoi/${trackingCode}`);
  revalidatePath("/quan-tri/dieu-phoi");

  return { ok: true, message: "Đã gỡ phân công." };
}
