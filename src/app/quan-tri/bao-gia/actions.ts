"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { createQuote, createRevision, submitOrSend } from "@/modules/quotes/service";
import { createQuoteSchema, quoteRevisionSchema } from "@/modules/quotes/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Server action cho nghiệp vụ báo giá.
 *
 * Mỗi action tự validate, kiểm tra quyền và ghi audit — được gọi từ form nội bộ không
 * khiến nó đáng tin hơn một API công khai (§25).
 */

export interface QuoteActionResult {
  ok: boolean;
  message?: string;
  code?: string;
  needsApproval?: boolean;
  approvalReasons?: string[];
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

export async function createQuoteAction(payload: unknown): Promise<QuoteActionResult> {
  const parsed = createQuoteSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();

  try {
    const result = await createQuote(actor, parsed.data, await requestContext());

    revalidatePath("/quan-tri/bao-gia");
    revalidatePath(`/quan-tri/yeu-cau/${parsed.data.serviceRequestCode}`);

    return {
      ok: true,
      code: result.code,
      needsApproval: result.needsApproval,
      approvalReasons: result.approvalReasons,
      message: result.needsApproval
        ? "Đã tạo báo giá. Báo giá này cần được duyệt trước khi gửi khách."
        : "Đã tạo báo giá ở dạng bản nháp.",
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

export async function createRevisionAction(
  code: string,
  payload: unknown
): Promise<QuoteActionResult> {
  const parsed = quoteRevisionSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const actor = await getActor();

  try {
    const result = await createRevision(actor, code, parsed.data, await requestContext());

    revalidatePath(`/quan-tri/bao-gia/${code}`);
    revalidatePath("/quan-tri/bao-gia");

    return {
      ok: true,
      code,
      needsApproval: result.needsApproval,
      approvalReasons: result.approvalReasons,
      message: `Đã tạo phiên bản ${result.revisionNumber}.`,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

/**
 * Gửi báo giá. Service tự quyết định đích đến là SENT hay PENDING_APPROVAL dựa trên
 * ngưỡng duyệt và quyền của người bấm — giao diện không tự đoán.
 */
export async function sendQuoteAction(code: string): Promise<QuoteActionResult> {
  const actor = await getActor();

  try {
    const result = await submitOrSend(actor, code, await requestContext());

    revalidatePath(`/quan-tri/bao-gia/${code}`);
    revalidatePath("/quan-tri/bao-gia");
    revalidatePath("/quan-tri");

    return {
      ok: true,
      message:
        result.status === "SENT"
          ? "Đã gửi báo giá tới khách hàng."
          : "Đã chuyển báo giá sang chờ duyệt.",
      approvalReasons: result.approvalReasons,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}
