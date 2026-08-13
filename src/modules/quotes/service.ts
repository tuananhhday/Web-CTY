import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateQuoteCode, generateRequestId } from "@/lib/ids";
import { toStorage, money } from "@/lib/money";
import { addDays } from "@/lib/datetime";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requirePermission, requireReadOwned } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import * as repo from "@/modules/quotes/repository";
import { loadApprovalThresholds } from "@/modules/quotes/thresholds";
import {
  assertTransition,
  quoteActorOf,
  isEditable,
  type QuoteStatus,
} from "@/modules/quotes/state-machine";
import {
  calculateLineItem,
  calculateQuoteTotals,
  requiresApproval,
  isQuoteExpired,
  type LineItemInput,
} from "@/modules/quotes/pricing";
import type {
  CreateQuoteInput,
  QuoteRevisionInput,
  ListQuotesQuery,
} from "@/modules/quotes/schema";

/**
 * Nghiệp vụ báo giá (§13.3).
 *
 * Hai nguyên tắc chi phối toàn bộ module:
 *
 *   1. **Không ghi đè lịch sử.** Mỗi lần đổi nội dung tạo một `QuoteRevision` mới.
 *      Revision khách đã chấp nhận bị khoá (`lockedAt`) và không bao giờ sửa được.
 *
 *   2. **Ngưỡng duyệt do dữ liệu quyết định, không hardcode.** Ngưỡng đọc từ
 *      `SystemSetting` nên doanh nghiệp đổi được mà không cần deploy.
 */

async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "Quote",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

/** Chuyển input thành dạng tính tiền được. */
function toPricingInput(items: QuoteRevisionInput["lineItems"]): LineItemInput[] {
  return items.map((item) => ({
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
    taxPercent: item.taxPercent,
  }));
}

/** Dựng dữ liệu line item kèm số tiền đã tính, để ghi vào database. */
function buildLineItemRows(items: QuoteRevisionInput["lineItems"]) {
  return items.map((item, index) => {
    const totals = calculateLineItem({
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      taxPercent: item.taxPercent,
    });

    return {
      sequence: index,
      description: item.description,
      category: item.category,
      quantity: item.quantity.toFixed(2),
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount ?? "0",
      taxPercent: (item.taxPercent ?? 0).toFixed(2),
      lineTotal: toStorage(totals.lineTotal),
      note: item.note ?? null,
    };
  });
}

// -----------------------------------------------------------------------------
// Tạo báo giá
// -----------------------------------------------------------------------------

export interface CreateQuoteResult {
  code: string;
  revisionNumber: number;
  needsApproval: boolean;
  approvalReasons: string[];
}

export async function createQuote(
  actor: Actor,
  input: CreateQuoteInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<CreateQuoteResult> {
  const user = requirePermission(actor, "quote.create");

  const request = await db.serviceRequest.findUnique({
    where: { code: input.serviceRequestCode },
    select: { id: true, code: true, status: true },
  });
  if (!request) {
    throw appError("NOT_FOUND", "Không tìm thấy yêu cầu dịch vụ tương ứng.");
  }

  // Không lập báo giá cho yêu cầu đã đóng.
  if (["REJECTED", "EXPIRED", "CANCELLED", "CONVERTED_TO_SHIPMENT"].includes(request.status)) {
    throw appError(
      "INVALID_STATE_TRANSITION",
      `Yêu cầu đang ở trạng thái ${request.status}, không thể lập báo giá mới.`
    );
  }

  const thresholds = await loadApprovalThresholds();
  const totals = calculateQuoteTotals(toPricingInput(input.lineItems), input.discountAmount ?? 0);
  const approval = requiresApproval(totals, thresholds);

  const code = generateQuoteCode();
  const validityDays = input.validityDays ?? thresholds.defaultValidityDays;

  const created = await db.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        code,
        serviceRequestId: request.id,
        status: "DRAFT",
        preparedById: user.userId,
        expiresAt: addDays(new Date(), validityDays),
      },
      select: { id: true, code: true },
    });

    const revision = await tx.quoteRevision.create({
      data: {
        quoteId: quote.id,
        revisionNumber: 1,
        subtotal: toStorage(totals.subtotal),
        discountAmount: toStorage(totals.discountAmount),
        taxAmount: toStorage(totals.taxAmount),
        totalAmount: toStorage(totals.totalAmount),
        terms: input.terms ?? null,
        note: input.note ?? null,
        createdById: user.userId,
        lineItems: { create: buildLineItemRows(input.lineItems) },
      },
      select: { id: true, revisionNumber: true },
    });

    await tx.quote.update({
      where: { id: quote.id },
      data: { currentRevisionId: revision.id },
    });

    await tx.quoteActivity.create({
      data: {
        quoteId: quote.id,
        action: "CREATED",
        actorId: user.userId,
        actorRole: user.roles[0] ?? null,
        metadata: { revisionNumber: 1, totalAmount: toStorage(totals.totalAmount) },
      },
    });

    await recordAudit(
      actor,
      {
        action: "quote.created",
        resourceType: "Quote",
        resourceId: quote.id,
        after: {
          code: quote.code,
          serviceRequestCode: request.code,
          totalAmount: toStorage(totals.totalAmount),
          needsApproval: approval.required,
        },
        context,
      },
      tx
    );

    return { quote, revision };
  });

  logger.info(
    { code: created.quote.code, needsApproval: approval.required },
    "Đã tạo báo giá"
  );

  return {
    code: created.quote.code,
    revisionNumber: created.revision.revisionNumber,
    needsApproval: approval.required,
    approvalReasons: approval.reasons,
  };
}

// -----------------------------------------------------------------------------
// Tạo revision mới
// -----------------------------------------------------------------------------

export async function createRevision(
  actor: Actor,
  code: string,
  input: QuoteRevisionInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<CreateQuoteResult> {
  const user = requirePermission(actor, "quote.create");

  const quote = await repo.findQuoteOwnership(code);
  if (!quote) throw appError("NOT_FOUND");

  // Báo giá đã chấp nhận thì đóng băng hoàn toàn (§13.3).
  if (quote.acceptedRevisionId) {
    throw appError(
      "CONFLICT",
      "Báo giá đã được khách chấp nhận. Tạo báo giá mới nếu cần thay đổi phương án."
    );
  }

  const thresholds = await loadApprovalThresholds();
  const totals = calculateQuoteTotals(toPricingInput(input.lineItems), input.discountAmount ?? 0);
  const approval = requiresApproval(totals, thresholds);

  const revisionNumber = await repo.nextRevisionNumber(quote.id);

  await db.$transaction(async (tx) => {
    const revision = await tx.quoteRevision.create({
      data: {
        quoteId: quote.id,
        revisionNumber,
        subtotal: toStorage(totals.subtotal),
        discountAmount: toStorage(totals.discountAmount),
        taxAmount: toStorage(totals.taxAmount),
        totalAmount: toStorage(totals.totalAmount),
        terms: input.terms ?? null,
        note: input.note ?? null,
        createdById: user.userId,
        lineItems: { create: buildLineItemRows(input.lineItems) },
      },
      select: { id: true },
    });

    // Revision cũ KHÔNG bị xoá — chỉ đổi con trỏ. Lịch sử giữ nguyên để đối chiếu.
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        currentRevisionId: revision.id,
        status: "DRAFT",
        ...(input.validityDays
          ? { expiresAt: addDays(new Date(), input.validityDays) }
          : {}),
      },
    });

    await tx.quoteActivity.create({
      data: {
        quoteId: quote.id,
        action: "REVISED",
        actorId: user.userId,
        actorRole: user.roles[0] ?? null,
        metadata: { revisionNumber, totalAmount: toStorage(totals.totalAmount) },
      },
    });

    await recordAudit(
      actor,
      {
        action: "quote.revised",
        resourceType: "Quote",
        resourceId: quote.id,
        before: { status: quote.status, revisionNumber: revisionNumber - 1 },
        after: { revisionNumber, totalAmount: toStorage(totals.totalAmount) },
        context,
      },
      tx
    );
  });

  logger.info({ code, revisionNumber }, "Đã tạo phiên bản báo giá mới");

  return {
    code,
    revisionNumber,
    needsApproval: approval.required,
    approvalReasons: approval.reasons,
  };
}

// -----------------------------------------------------------------------------
// Gửi khách (kèm kiểm tra ngưỡng duyệt)
// -----------------------------------------------------------------------------

export async function submitOrSend(
  actor: Actor,
  code: string,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<{ status: QuoteStatus; approvalReasons: string[] }> {
  const user = requirePermission(actor, "quote.create");

  const quote = await repo.findQuoteOwnership(code);
  if (!quote) throw appError("NOT_FOUND");
  if (!quote.currentRevision) {
    throw appError("CONFLICT", "Báo giá chưa có nội dung.");
  }

  const thresholds = await loadApprovalThresholds();

  // Tính lại ngưỡng từ số tiền ĐÃ LƯU của revision hiện tại. Phải tính cả tỷ lệ giảm giá:
  // một báo giá tổng tiền nhỏ nhưng giảm 50% vẫn cần người duyệt (§13.3).
  const storedSubtotal = money(quote.currentRevision.subtotal.toString());
  const storedDiscount = money(quote.currentRevision.discountAmount.toString());
  const discountPercent = storedSubtotal.isZero()
    ? 0
    : Number(storedDiscount.dividedBy(storedSubtotal).times(100).toFixed(2));

  const approval = requiresApproval(
    {
      totalAmount: money(quote.currentRevision.totalAmount.toString()),
      discountPercent,
    },
    thresholds
  );

  const by = quoteActorOf(actor);
  const from = quote.status as QuoteStatus;

  // Vượt ngưỡng mà người gửi không có quyền duyệt thì phải qua bước chờ duyệt (§13.3).
  const target: QuoteStatus = approval.required && by !== "APPROVER" ? "PENDING_APPROVAL" : "SENT";

  assertTransition(from, target, by);

  await db.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, status: from },
      data: {
        status: target,
        ...(target === "SENT"
          ? { sentAt: new Date(), approvedById: by === "APPROVER" ? user.userId : undefined }
          : {}),
      },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Báo giá vừa được người khác thay đổi. Vui lòng tải lại.");
    }

    await tx.quoteActivity.create({
      data: {
        quoteId: quote.id,
        action: target === "SENT" ? "SENT" : "SUBMITTED_FOR_APPROVAL",
        actorId: user.userId,
        actorRole: user.roles[0] ?? null,
      },
    });

    if (target === "SENT") {
      await enqueueOutbox(tx, {
        eventKey: "quote.sent",
        aggregateId: quote.id,
        payload: { code, serviceRequestCode: quote.serviceRequest.code },
      });
    }

    await recordAudit(
      actor,
      {
        action: target === "SENT" ? "quote.sent" : "quote.submitted_for_approval",
        resourceType: "Quote",
        resourceId: quote.id,
        before: { status: from },
        after: { status: target },
        context,
      },
      tx
    );
  });

  logger.info({ code, from, to: target }, "Đã cập nhật trạng thái báo giá");

  return { status: target, approvalReasons: approval.reasons };
}

// -----------------------------------------------------------------------------
// Khách chấp nhận / từ chối
// -----------------------------------------------------------------------------

export async function acceptQuote(
  actor: Actor,
  code: string,
  revisionNumber: number,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const quote = await repo.findQuoteOwnership(code);
  if (!quote) throw appError("NOT_FOUND");

  // Chỉ chủ yêu cầu mới chấp nhận được; người khác nhận NOT_FOUND.
  requireReadOwned(actor, quote.serviceRequest.userId, "quote.read_all");

  if (isQuoteExpired(quote.expiresAt)) {
    throw appError(
      "CONFLICT",
      "Báo giá đã hết hạn hiệu lực. Vui lòng liên hệ để nhận báo giá mới."
    );
  }

  // Khách phải chấp nhận ĐÚNG revision đang hiển thị. Nếu nhân viên vừa gửi bản mới,
  // yêu cầu bị từ chối để khách xem lại thay vì chấp nhận nhầm bản cũ (§13.3).
  if (quote.currentRevision?.revisionNumber !== revisionNumber) {
    throw appError(
      "STALE_VERSION",
      `Báo giá đã có phiên bản mới (bản ${quote.currentRevision?.revisionNumber}). Vui lòng tải lại trang và xem bản mới nhất.`
    );
  }

  const from = quote.status as QuoteStatus;
  assertTransition(from, "ACCEPTED", "CUSTOMER");

  await db.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, status: from, currentRevisionId: quote.currentRevisionId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        // Snapshot: ghim đúng revision đã chấp nhận (§13.3).
        acceptedRevisionId: quote.currentRevisionId,
      },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Báo giá vừa thay đổi. Vui lòng tải lại trang.");
    }

    // Khoá revision — từ đây không sửa được nữa.
    await tx.quoteRevision.update({
      where: { id: quote.currentRevisionId as string },
      data: { lockedAt: new Date() },
    });

    // Yêu cầu dịch vụ chuyển sang đã chấp nhận, sẵn sàng cho dispatcher tạo đơn hàng.
    await tx.serviceRequest.updateMany({
      where: { id: quote.serviceRequest.id, status: { in: ["QUOTED", "NEGOTIATING"] } },
      data: { status: "ACCEPTED" },
    });

    await tx.requestStatusEvent.create({
      data: {
        serviceRequestId: quote.serviceRequest.id,
        fromStatus: quote.serviceRequest.status as never,
        toStatus: "ACCEPTED",
        actorId: actor.userId,
        actorRole: actor.roles[0] ?? null,
        reason: `Khách chấp nhận báo giá ${code} bản ${revisionNumber}`,
      },
    });

    await tx.quoteActivity.create({
      data: {
        quoteId: quote.id,
        action: "ACCEPTED",
        actorId: actor.userId,
        actorRole: actor.roles[0] ?? null,
        metadata: { revisionNumber },
      },
    });

    await enqueueOutbox(tx, {
      eventKey: "quote.accepted",
      aggregateId: quote.id,
      payload: { code, revisionNumber, serviceRequestCode: quote.serviceRequest.code },
    });

    await recordAudit(
      actor,
      {
        action: "quote.accepted",
        resourceType: "Quote",
        resourceId: quote.id,
        before: { status: from },
        after: { status: "ACCEPTED", acceptedRevision: revisionNumber },
        context,
      },
      tx
    );
  });

  logger.info({ code, revisionNumber }, "Khách đã chấp nhận báo giá");
}

export async function declineQuote(
  actor: Actor,
  code: string,
  reason: string,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const quote = await repo.findQuoteOwnership(code);
  if (!quote) throw appError("NOT_FOUND");

  requireReadOwned(actor, quote.serviceRequest.userId, "quote.read_all");

  const from = quote.status as QuoteStatus;
  assertTransition(from, "DECLINED", "CUSTOMER", { reason });

  await db.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, status: from },
      data: { status: "DECLINED", declinedAt: new Date(), declineReason: reason },
    });

    if (updated.count === 0) {
      throw appError("STALE_VERSION", "Báo giá vừa thay đổi. Vui lòng tải lại trang.");
    }

    await tx.quoteActivity.create({
      data: {
        quoteId: quote.id,
        action: "DECLINED",
        actorId: actor.userId,
        actorRole: actor.roles[0] ?? null,
      },
    });

    await enqueueOutbox(tx, {
      eventKey: "quote.declined",
      aggregateId: quote.id,
      payload: { code, reason },
    });

    await recordAudit(
      actor,
      {
        action: "quote.declined",
        resourceType: "Quote",
        resourceId: quote.id,
        before: { status: from },
        after: { status: "DECLINED", reason },
        context,
      },
      tx
    );
  });

  logger.info({ code }, "Khách đã từ chối báo giá");
}

/** Ghi nhận khách mở xem lần đầu. Không phải thao tác quan trọng nên lỗi không chặn trang. */
export async function markViewed(quoteId: string, currentStatus: QuoteStatus): Promise<void> {
  if (currentStatus !== "SENT") return;

  try {
    await db.quote.updateMany({
      where: { id: quoteId, status: "SENT" },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  } catch (error) {
    logger.warn({ err: error, quoteId }, "Không ghi nhận được lượt xem báo giá");
  }
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export async function listMyQuotes(actor: Actor, query: ListQuotesQuery) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");
  return repo.listQuotesForUser(actor.userId, query);
}

export async function getMyQuote(actor: Actor, code: string) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const quote = await repo.findQuoteForUser(code, actor.userId);
  if (!quote) throw appError("NOT_FOUND");

  return quote;
}

export async function listAllQuotes(actor: Actor, query: ListQuotesQuery) {
  requirePermission(actor, "quote.read_all");
  return repo.listAllQuotes(query);
}

export async function getQuoteAsStaff(actor: Actor, code: string) {
  requirePermission(actor, "quote.read_all");

  const quote = await repo.findQuoteByCode(code);
  if (!quote) throw appError("NOT_FOUND");

  return quote;
}

/** Nhân viên còn sửa được báo giá này không. */
export function canEditQuote(status: string): boolean {
  return isEditable(status as QuoteStatus);
}
