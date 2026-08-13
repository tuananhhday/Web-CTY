"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { acceptQuote, declineQuote } from "@/modules/quotes/service";
import { acceptQuoteSchema, declineQuoteSchema } from "@/modules/quotes/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Server action cho khách hàng phản hồi báo giá.
 *
 * Quyền sở hữu được kiểm tra trong service (`requireReadOwned`), không phải ở đây —
 * để một chỗ duy nhất chịu trách nhiệm, tránh hai nơi kiểm tra lệch nhau.
 */

export interface CustomerQuoteActionResult {
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
  return "Thao tác không thành công. Vui lòng thử lại.";
}

export async function acceptQuoteAction(
  code: string,
  formData: FormData
): Promise<CustomerQuoteActionResult> {
  const parsed = acceptQuoteSchema.safeParse({
    revisionNumber: Number(formData.get("revisionNumber")),
  });

  if (!parsed.success) {
    return { ok: false, message: "Thiếu thông tin phiên bản báo giá. Vui lòng tải lại trang." };
  }

  const actor = await getActor();

  try {
    await acceptQuote(actor, code, parsed.data.revisionNumber, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/tai-khoan/bao-gia/${code}`);
  revalidatePath("/tai-khoan/bao-gia");
  revalidatePath("/tai-khoan");

  return { ok: true, message: "Đã chấp nhận báo giá. Chúng tôi sẽ liên hệ để sắp xếp phương tiện." };
}

export async function declineQuoteAction(
  code: string,
  formData: FormData
): Promise<CustomerQuoteActionResult> {
  const parsed = declineQuoteSchema.safeParse({ reason: formData.get("reason") });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Vui lòng nhập lý do." };
  }

  const actor = await getActor();

  try {
    await declineQuote(actor, code, parsed.data.reason, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/tai-khoan/bao-gia/${code}`);
  revalidatePath("/tai-khoan/bao-gia");

  return { ok: true, message: "Đã ghi nhận phản hồi của bạn." };
}
