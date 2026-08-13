"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { changeStatus } from "@/modules/service-requests/service";
import { changeStatusSchema } from "@/modules/service-requests/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Server action đổi trạng thái yêu cầu.
 *
 * Server action phải validate, kiểm tra quyền và ghi audit ĐÚNG NHƯ một API route —
 * việc nó được gọi từ form trong cùng ứng dụng không làm nó đáng tin hơn (§25).
 * Toàn bộ ba việc đó nằm trong `changeStatus`.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function changeRequestStatusAction(
  code: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = changeStatusSchema.safeParse({
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();
  const requestHeaders = await headers();

  try {
    await changeStatus(actor, code, parsed.data.toStatus, parsed.data.reason, {
      ipAddress: getClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      requestId: generateRequestId(),
    });
  } catch (error) {
    // AppError đã có thông báo tiếng Việt an toàn cho người dùng cuối.
    if (isAppError(error)) {
      return { ok: false, message: error.message };
    }
    // Lỗi lạ: không trả chi tiết ra ngoài.
    return { ok: false, message: "Không cập nhật được trạng thái. Vui lòng thử lại." };
  }

  revalidatePath(`/quan-tri/yeu-cau/${code}`);
  revalidatePath("/quan-tri/yeu-cau");
  revalidatePath("/quan-tri");

  return { ok: true, message: "Đã cập nhật trạng thái." };
}
