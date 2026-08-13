"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import {
  createInvoice,
  issueInvoice,
  voidInvoice,
  recordPayment,
  confirmPayment,
  reversePayment,
} from "@/modules/invoices/service";
import {
  createInvoiceSchema,
  voidInvoiceSchema,
  recordPaymentSchema,
  reversePaymentSchema,
} from "@/modules/invoices/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/** Server action cho hóa đơn và thanh toán (§20). Quyền kiểm tra trong service. */

export interface InvoiceActionResult {
  ok: boolean;
  message?: string;
  invoiceNumber?: string;
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

function revalidate(invoiceNumber?: string) {
  revalidatePath("/quan-tri/hoa-don");
  if (invoiceNumber) revalidatePath(`/quan-tri/hoa-don/${invoiceNumber}`);
  revalidatePath("/tai-khoan/hoa-don");
  revalidatePath("/quan-tri");
}

export async function createInvoiceAction(payload: unknown): Promise<InvoiceActionResult> {
  const parsed = createInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    const result = await createInvoice(actor, parsed.data, await requestContext());
    revalidate(result.invoiceNumber);

    return {
      ok: true,
      invoiceNumber: result.invoiceNumber,
      message: `Đã lập hóa đơn nháp ${result.invoiceNumber}.`,
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}

export async function issueInvoiceAction(invoiceNumber: string): Promise<InvoiceActionResult> {
  const actor = await getActor();

  try {
    await issueInvoice(actor, invoiceNumber, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(invoiceNumber);

  return { ok: true, message: "Đã phát hành hóa đơn." };
}

export async function voidInvoiceAction(
  invoiceNumber: string,
  formData: FormData
): Promise<InvoiceActionResult> {
  const parsed = voidInvoiceSchema.safeParse({
    invoiceNumber,
    reason: String(formData.get("reason") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await voidInvoice(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(invoiceNumber);

  return { ok: true, message: "Đã hủy hóa đơn." };
}

export async function recordPaymentAction(
  invoiceNumber: string,
  formData: FormData
): Promise<InvoiceActionResult> {
  const paidAtRaw = String(formData.get("paidAt") ?? "");

  const parsed = recordPaymentSchema.safeParse({
    invoiceNumber,
    amount: String(formData.get("amount") ?? ""),
    method: String(formData.get("method") ?? "BANK_TRANSFER"),
    referenceCode: String(formData.get("referenceCode") ?? "") || undefined,
    // `datetime-local` không kèm múi giờ; diễn giải theo giờ máy người nhập rồi đổi sang ISO.
    paidAt: paidAtRaw ? new Date(paidAtRaw).toISOString() : new Date().toISOString(),
    note: String(formData.get("note") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await recordPayment(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(invoiceNumber);

  return {
    ok: true,
    message: "Đã ghi nhận khoản thanh toán. Cần xác nhận sau khi đối chiếu sao kê.",
  };
}

export async function confirmPaymentAction(
  invoiceNumber: string,
  paymentId: string
): Promise<InvoiceActionResult> {
  const actor = await getActor();

  try {
    await confirmPayment(actor, paymentId, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(invoiceNumber);

  return { ok: true, message: "Đã xác nhận khoản thanh toán." };
}

export async function reversePaymentAction(
  invoiceNumber: string,
  paymentId: string,
  formData: FormData
): Promise<InvoiceActionResult> {
  const parsed = reversePaymentSchema.safeParse({
    paymentId,
    reason: String(formData.get("reason") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await reversePayment(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(invoiceNumber);

  return { ok: true, message: "Đã đảo khoản thanh toán." };
}
