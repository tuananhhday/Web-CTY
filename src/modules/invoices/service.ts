import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateInvoiceNumber, generateRequestId } from "@/lib/ids";
import { toStorage } from "@/lib/money";
import { addDays } from "@/lib/datetime";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requireAuth, requirePermission, requireFreshAuth, can } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import { calculateInvoiceTotals, calculateLine, calculateBalance } from "@/modules/invoices/totals";
import {
  assertInvoiceTransition,
  canAcceptPayment,
  canReversePayment,
  deriveStatus,
  isEditable,
  type InvoiceStatus,
  type PaymentStatus,
} from "@/modules/invoices/state-machine";
import type {
  CreateInvoiceInput,
  RecordPaymentInput,
  ReversePaymentInput,
  VoidInvoiceInput,
} from "@/modules/invoices/schema";

/**
 * Hóa đơn và ghi nhận thanh toán (§20).
 *
 * PHẠM VI: hệ thống KHÔNG có cổng thanh toán online và KHÔNG lưu bất kỳ dữ liệu thẻ nào.
 * Nó ghi nhận khoản tiền đã nhận qua tiền mặt hoặc chuyển khoản, để đối chiếu công nợ.
 *
 * `invoiceNumber` là MÃ CHỨNG TỪ NỘI BỘ, không phải hóa đơn điện tử hợp pháp. Khi doanh
 * nghiệp tích hợp nhà cung cấp hóa đơn điện tử thì phải dùng số do bên đó cấp — giao diện
 * và tài liệu đều nói rõ điều này để không ai nhầm (§1, §20).
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "Invoice",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

/**
 * Sinh số chứng từ tiếp theo trong năm.
 *
 * Đếm trong transaction để hai người lập cùng lúc không nhận cùng một số. Unique index trên
 * `invoiceNumber` là lớp chặn cuối nếu vẫn đụng nhau.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));

  const count = await tx.invoice.count({ where: { createdAt: { gte: startOfYear } } });

  return generateInvoiceNumber(year, count + 1);
}

/**
 * Đồng bộ lại số tiền đã trả, số dư và trạng thái từ danh sách thanh toán.
 *
 * Gọi sau MỌI thay đổi liên quan tới tiền. `paidAmount` và `balanceAmount` là giá trị dẫn
 * xuất được lưu lại để truy vấn nhanh — chúng phải luôn tính lại từ bảng `PaymentRecord`
 * chứ không được cộng trừ tại chỗ, vì cộng trừ tại chỗ là cách sổ sách lệch dần theo thời
 * gian mà không ai biết từ lúc nào.
 */
async function recalculate(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      totalAmount: true,
      status: true,
      dueAt: true,
      payments: { select: { amount: true, status: true } },
    },
  });

  if (!invoice) return;

  const { paidAmount, balanceAmount } = calculateBalance({
    totalAmount: invoice.totalAmount.toString(),
    payments: invoice.payments.map((payment) => ({
      amount: payment.amount.toString(),
      status: payment.status,
    })),
  });

  const status = deriveStatus({
    current: invoice.status as InvoiceStatus,
    totalAmount: invoice.totalAmount.toString(),
    paidAmount,
    dueAt: invoice.dueAt,
  });

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: toStorage(paidAmount),
      balanceAmount: toStorage(balanceAmount),
      status,
      version: { increment: 1 },
    },
  });
}

// -----------------------------------------------------------------------------
// Lập hóa đơn
// -----------------------------------------------------------------------------

export async function createInvoice(
  actor: Actor,
  input: CreateInvoiceInput,
  context: Context
): Promise<{ invoiceNumber: string }> {
  const user = requirePermission(actor, "invoice.manage");

  let shipmentId: string | null = null;
  let userId: string | null = null;
  let quoteId: string | null = null;

  if (input.trackingCode) {
    const shipment = await db.shipment.findUnique({
      where: { trackingCode: input.trackingCode },
      select: { id: true, userId: true, quoteId: true },
    });
    if (!shipment) throw appError("NOT_FOUND", "Không tìm thấy chuyến hàng.");

    shipmentId = shipment.id;
    userId = shipment.userId;
    quoteId = shipment.quoteId;
  }

  const totals = calculateInvoiceTotals(input.lines, input.discountAmount ?? "0");

  const created = await db.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        userId,
        shipmentId,
        quoteId,
        billingName: input.billingName,
        billingTaxCode: input.billingTaxCode ?? null,
        billingAddress: input.billingAddress ?? null,
        billingEmail: input.billingEmail ?? null,
        status: "DRAFT",
        subtotal: toStorage(totals.subtotal),
        discountAmount: toStorage(totals.discountAmount),
        taxAmount: toStorage(totals.taxAmount),
        totalAmount: toStorage(totals.totalAmount),
        paidAmount: toStorage("0"),
        balanceAmount: toStorage(totals.totalAmount),
        note: input.note ?? null,
        internalNote: input.internalNote ?? null,
        createdById: user.userId,
        lines: {
          create: input.lines.map((line, index) => {
            const computed = calculateLine(line);
            return {
              sequence: index,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: toStorage(line.unitPrice),
              discountAmount: toStorage(computed.discountAmount),
              taxPercent: line.taxPercent ?? 0,
              lineTotal: toStorage(computed.lineTotal),
            };
          }),
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    await recordAudit(
      actor,
      {
        action: "invoice.created",
        resourceType: "Invoice",
        resourceId: invoice.id,
        after: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: totals.totalAmount,
          lineCount: input.lines.length,
        },
        context,
      },
      tx
    );

    return invoice;
  });

  logger.info(
    { invoiceNumber: created.invoiceNumber, totalAmount: totals.totalAmount },
    "Đã lập hóa đơn"
  );

  return { invoiceNumber: created.invoiceNumber };
}

export async function issueInvoice(
  actor: Actor,
  invoiceNumber: string,
  context: Context
): Promise<void> {
  requirePermission(actor, "invoice.manage");

  const invoice = await db.invoice.findUnique({
    where: { invoiceNumber },
    select: { id: true, status: true, totalAmount: true },
  });

  if (!invoice) throw appError("NOT_FOUND");

  const from = invoice.status as InvoiceStatus;
  assertInvoiceTransition(from, "ISSUED");

  const now = new Date();
  // Hạn thanh toán mặc định 15 ngày; doanh nghiệp chỉnh được khi có UI cấu hình (§20).
  const dueAt = addDays(now, 15);

  await db.$transaction(async (tx) => {
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, status: from },
      data: { status: "ISSUED", issuedAt: now, dueAt, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Hóa đơn vừa được người khác thay đổi. Vui lòng tải lại.");
    }

    await enqueueOutbox(tx, {
      eventKey: "invoice.issued",
      aggregateId: invoice.id,
      payload: { invoiceNumber },
    });

    await recordAudit(
      actor,
      {
        action: "invoice.issued",
        resourceType: "Invoice",
        resourceId: invoice.id,
        before: { status: from },
        after: { status: "ISSUED", dueAt: dueAt.toISOString() },
        context,
      },
      tx
    );
  });

  logger.info({ invoiceNumber }, "Đã phát hành hóa đơn");
}

export async function voidInvoice(
  actor: Actor,
  input: VoidInvoiceInput,
  context: Context
): Promise<void> {
  requirePermission(actor, "invoice.manage");

  const invoice = await db.invoice.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
    select: { id: true, status: true },
  });

  if (!invoice) throw appError("NOT_FOUND");

  const from = invoice.status as InvoiceStatus;
  assertInvoiceTransition(from, "VOID", { reason: input.reason });

  await db.$transaction(async (tx) => {
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, status: from },
      data: { status: "VOID", voidReason: input.reason, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Hóa đơn vừa được người khác thay đổi. Vui lòng tải lại.");
    }

    await recordAudit(
      actor,
      {
        action: "invoice.voided",
        resourceType: "Invoice",
        resourceId: invoice.id,
        before: { status: from },
        after: { status: "VOID", reason: input.reason },
        context,
      },
      tx
    );
  });

  logger.warn({ invoiceNumber: input.invoiceNumber }, "Đã hủy hóa đơn");
}

// -----------------------------------------------------------------------------
// Thanh toán
// -----------------------------------------------------------------------------

export async function recordPayment(
  actor: Actor,
  input: RecordPaymentInput,
  context: Context
): Promise<{ paymentId: string }> {
  // Ghi nhận tiền là thao tác nhạy cảm — đòi xác thực gần đây (§30.2).
  const user = requireFreshAuth(actor, "payment.record");

  const invoice = await db.invoice.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
    select: { id: true, status: true },
  });

  if (!invoice) throw appError("NOT_FOUND");

  const check = canAcceptPayment(invoice.status as InvoiceStatus);
  if (!check.allowed) throw appError("CONFLICT", check.reason);

  const created = await db.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        amount: toStorage(input.amount),
        method: input.method,
        // Mặc định PENDING: tiền vào tài khoản mới là đã thu, lời khai chưa phải là tiền.
        status: "PENDING",
        referenceCode: input.referenceCode ?? null,
        paidAt: new Date(input.paidAt),
        note: input.note ?? null,
        recordedById: user.userId,
      },
      select: { id: true },
    });

    await recordAudit(
      actor,
      {
        action: "payment.recorded",
        resourceType: "PaymentRecord",
        resourceId: payment.id,
        after: {
          invoiceNumber: input.invoiceNumber,
          amount: input.amount,
          method: input.method,
          status: "PENDING",
        },
        context,
      },
      tx
    );

    return payment;
  });

  logger.info(
    { invoiceNumber: input.invoiceNumber, amount: input.amount },
    "Đã ghi nhận khoản thanh toán, chờ đối chiếu"
  );

  return { paymentId: created.id };
}

/**
 * Xác nhận khoản đã về tài khoản.
 *
 * Đây mới là bước làm thay đổi công nợ. Tách khỏi bước ghi nhận để người nhập liệu và người
 * đối chiếu sao kê có thể là hai người khác nhau (§20).
 */
export async function confirmPayment(
  actor: Actor,
  paymentId: string,
  context: Context
): Promise<void> {
  requireFreshAuth(actor, "payment.record");

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, invoiceId: true, amount: true },
  });

  if (!payment) throw appError("NOT_FOUND");

  if (payment.status !== "PENDING") {
    throw appError("CONFLICT", "Chỉ xác nhận được khoản đang chờ đối chiếu.");
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.paymentRecord.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "CONFIRMED" },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Khoản này vừa được người khác xử lý.");
    }

    await recalculate(tx, payment.invoiceId);

    await recordAudit(
      actor,
      {
        action: "payment.confirmed",
        resourceType: "PaymentRecord",
        resourceId: payment.id,
        before: { status: "PENDING" },
        after: { status: "CONFIRMED", amount: payment.amount.toString() },
        context,
      },
      tx
    );
  });

  logger.info({ paymentId }, "Đã xác nhận khoản thanh toán");
}

/**
 * Đảo một khoản đã ghi nhận.
 *
 * Không xóa bản ghi. Khoản tiền đã từng được ghi nhận là sự kiện có thật; xóa đi là làm mất
 * dấu vết đối chiếu và khiến sổ sách không khớp sao kê (§20).
 */
export async function reversePayment(
  actor: Actor,
  input: ReversePaymentInput,
  context: Context
): Promise<void> {
  requireFreshAuth(actor, "payment.record");

  const payment = await db.paymentRecord.findUnique({
    where: { id: input.paymentId },
    select: { id: true, status: true, invoiceId: true, amount: true },
  });

  if (!payment) throw appError("NOT_FOUND");

  const check = canReversePayment(payment.status as PaymentStatus);
  if (!check.allowed) throw appError("CONFLICT", check.reason);

  await db.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reverseReason: input.reason,
      },
    });

    await recalculate(tx, payment.invoiceId);

    await recordAudit(
      actor,
      {
        action: "payment.reversed",
        resourceType: "PaymentRecord",
        resourceId: payment.id,
        before: { status: payment.status, amount: payment.amount.toString() },
        after: { status: "REVERSED", reason: input.reason },
        context,
      },
      tx
    );
  });

  logger.warn({ paymentId: input.paymentId }, "Đã đảo khoản thanh toán");
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

const INVOICE_LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  status: true,
  billingName: true,
  issuedAt: true,
  dueAt: true,
  totalAmount: true,
  paidAmount: true,
  balanceAmount: true,
  currency: true,
  createdAt: true,
  shipment: { select: { trackingCode: true } },
} satisfies Prisma.InvoiceSelect;

export async function listInvoicesForStaff(actor: Actor, options: { onlyUnpaid?: boolean } = {}) {
  requirePermission(actor, "invoice.read_all");

  return db.invoice.findMany({
    where: options.onlyUnpaid
      ? { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }
      : {},
    select: INVOICE_LIST_SELECT,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

/** Hóa đơn của chính khách hàng. Nháp KHÔNG hiện — chưa phát hành thì chưa tồn tại với khách. */
export async function listMyInvoices(actor: Actor) {
  const user = requireAuth(actor);

  return db.invoice.findMany({
    where: { userId: user.userId, status: { notIn: ["DRAFT", "VOID"] } },
    select: INVOICE_LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getInvoice(actor: Actor, invoiceNumber: string) {
  const user = requireAuth(actor);
  const isStaff = can(actor, "invoice.read_all");

  const invoice = await db.invoice.findUnique({
    where: { invoiceNumber },
    select: {
      ...INVOICE_LIST_SELECT,
      userId: true,
      billingTaxCode: true,
      billingAddress: true,
      billingEmail: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      note: true,
      voidReason: true,
      // Ghi chú nội bộ chỉ nhân viên đọc được — cùng nguyên tắc với phiếu hỗ trợ (§19).
      ...(isStaff ? { internalNote: true } : {}),
      lines: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          discountAmount: true,
          taxPercent: true,
          lineTotal: true,
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          referenceCode: true,
          paidAt: true,
          note: true,
          reverseReason: true,
        },
      },
    },
  });

  if (!invoice) throw appError("NOT_FOUND");

  if (!isStaff) {
    // Khách chỉ xem hóa đơn của mình, và không xem được bản nháp.
    if (invoice.userId !== user.userId) throw appError("NOT_FOUND");
    if (invoice.status === "DRAFT" || invoice.status === "VOID") throw appError("NOT_FOUND");
  }

  return invoice;
}

/**
 * Dữ liệu mồi khi lập hóa đơn từ một chuyến hàng.
 *
 * Lấy dòng chi phí từ BẢN BÁO GIÁ ĐÃ CHẤP NHẬN, không phải bản mới nhất — khách đã đồng ý
 * với bản nào thì xuất hóa đơn theo đúng bản đó (§13.3).
 *
 * Trả về gợi ý, không tự tạo hóa đơn: kế toán phải xem lại và chịu trách nhiệm về con số.
 */
export async function getInvoiceDraftFromShipment(actor: Actor, trackingCode: string) {
  requirePermission(actor, "invoice.manage");

  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      trackingCode: true,
      status: true,
      invoices: { select: { invoiceNumber: true, status: true } },
      serviceRequest: {
        select: { contactName: true, companyName: true, contactEmail: true },
      },
      quote: {
        select: {
          code: true,
          acceptedRevision: {
            select: {
              lineItems: {
                orderBy: { sequence: "asc" },
                select: {
                  description: true,
                  quantity: true,
                  unit: true,
                  unitPrice: true,
                  discountAmount: true,
                  taxPercent: true,
                },
              },
              discountAmount: true,
            },
          },
        },
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND", "Không tìm thấy chuyến hàng.");

  const revision = shipment.quote?.acceptedRevision;

  return {
    trackingCode: shipment.trackingCode,
    shipmentStatus: shipment.status,
    quoteCode: shipment.quote?.code ?? null,
    // Cảnh báo trùng: một chuyến lập hai hóa đơn là lỗi vận hành hay gặp.
    existingInvoices: shipment.invoices.filter((invoice) => invoice.status !== "VOID"),
    billingName:
      shipment.serviceRequest?.companyName || shipment.serviceRequest?.contactName || "",
    billingEmail: shipment.serviceRequest?.contactEmail ?? "",
    discountAmount: revision?.discountAmount?.toString() ?? "0",
    lines:
      revision?.lineItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: item.unitPrice.toString(),
        discountAmount: item.discountAmount?.toString() ?? "",
        taxPercent: item.taxPercent ? Number(item.taxPercent) : undefined,
      })) ?? [],
  };
}

/** Công nợ tổng quan cho widget quản trị (§26.3). */
export async function countOutstandingInvoices(actor: Actor) {
  if (!isAuthenticated(actor) || !can(actor, "invoice.read_all")) {
    return { unpaid: 0, overdue: 0 };
  }

  const [unpaid, overdue] = await Promise.all([
    db.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
  ]);

  return { unpaid, overdue };
}

export { isEditable };
