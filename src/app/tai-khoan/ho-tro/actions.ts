"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import {
  createTicket,
  replyToTicket,
  changeTicketStatus,
} from "@/modules/support/service";
import {
  createTicketSchema,
  replyTicketSchema,
  changeTicketStatusSchema,
} from "@/modules/support/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/** Server action cho khu vực hỗ trợ của khách (§19). */

export interface SupportActionResult {
  ok: boolean;
  message?: string;
  code?: string;
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

export async function createTicketAction(formData: FormData): Promise<SupportActionResult> {
  const parsed = createTicketSchema.safeParse({
    type: String(formData.get("type") ?? "QUESTION"),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    trackingCode: String(formData.get("trackingCode") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    const result = await createTicket(actor, parsed.data, await requestContext());

    revalidatePath("/tai-khoan/ho-tro");

    return {
      ok: true,
      code: result.code,
      message: `Đã tạo phiếu hỗ trợ ${result.code}.`,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

export async function replyAction(code: string, formData: FormData): Promise<SupportActionResult> {
  const parsed = replyTicketSchema.safeParse({
    code,
    body: String(formData.get("body") ?? ""),
    // Khách không gửi được ghi chú nội bộ; service kiểm tra lại quyền dù client gửi gì.
    internal: formData.get("internal") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await replyToTicket(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/tai-khoan/ho-tro/${code}`);
  revalidatePath(`/quan-tri/ho-tro/${code}`);
  revalidatePath("/tai-khoan/ho-tro");
  revalidatePath("/quan-tri/ho-tro");

  return { ok: true, message: "Đã gửi." };
}

export async function changeStatusAction(
  code: string,
  toStatus: string,
  note?: string
): Promise<SupportActionResult> {
  const parsed = changeTicketStatusSchema.safeParse({ code, toStatus, note });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await changeTicketStatus(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath(`/tai-khoan/ho-tro/${code}`);
  revalidatePath(`/quan-tri/ho-tro/${code}`);
  revalidatePath("/tai-khoan/ho-tro");
  revalidatePath("/quan-tri/ho-tro");

  return { ok: true, message: "Đã cập nhật trạng thái phiếu." };
}
