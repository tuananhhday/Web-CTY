import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateRequestId, generateTicketCode } from "@/lib/ids";
import { normalizePhone } from "@/lib/normalize";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requireAuth, requirePermission, can } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import {
  assertTicketTransition,
  defaultPriorityFor,
  isTicketClosed,
  slaDueAt,
  statusAfterMessage,
  type Party,
  type TicketStatus,
  type TicketType,
} from "@/modules/support/state-machine";
import type {
  AssignTicketInput,
  ChangeTicketStatusInput,
  ContactInquiryInput,
  CreateTicketInput,
  ReplyTicketInput,
} from "@/modules/support/schema";

/**
 * Hỗ trợ khách hàng và tiếp nhận liên hệ (§19, §23).
 *
 * NGUYÊN TẮC XUYÊN SUỐT: khách hàng không bao giờ đọc được `TicketMessage` có
 * `visibility = INTERNAL`. Việc lọc làm NGAY TRONG TRUY VẤN, không lọc sau khi lấy về —
 * dữ liệu không rời khỏi database thì không có đường rò rỉ qua log, cache hay lỗi lập trình
 * ở tầng giao diện (§19, §30.2).
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "SupportTicket",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

/** Người đang thao tác là khách hay nhân viên. */
function partyOf(actor: Actor): Party {
  return can(actor, "support.read_all") ? "STAFF" : "CUSTOMER";
}

// -----------------------------------------------------------------------------
// Tạo phiếu
// -----------------------------------------------------------------------------

export async function createTicket(
  actor: Actor,
  input: CreateTicketInput,
  context: Context
): Promise<{ code: string }> {
  const user = requireAuth(actor);

  // Gắn phiếu vào chuyến: chỉ chấp nhận chuyến của chính khách. Không kiểm tra thì khách
  // gắn phiếu vào đơn của người khác và nhân viên trả lời nhầm ngữ cảnh (§30.2).
  let shipmentId: string | null = null;
  if (input.trackingCode) {
    const shipment = await db.shipment.findFirst({
      where: { trackingCode: input.trackingCode, userId: user.userId },
      select: { id: true },
    });
    if (!shipment) {
      throw appError("NOT_FOUND", "Không tìm thấy đơn hàng này trong tài khoản của bạn.");
    }
    shipmentId = shipment.id;
  }

  const priority = defaultPriorityFor(input.type as TicketType);
  const code = generateTicketCode();
  const now = new Date();

  const created = await db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        code,
        userId: user.userId,
        shipmentId,
        type: input.type,
        priority,
        status: "OPEN",
        subject: input.subject,
        slaDueAt: slaDueAt(priority, now),
        messages: {
          create: {
            authorId: user.userId,
            authorRole: user.roles[0] ?? null,
            visibility: "CUSTOMER_VISIBLE",
            body: input.body,
          },
        },
      },
      select: { id: true, code: true },
    });

    await recordAudit(
      actor,
      {
        action: "ticket.created",
        resourceType: "SupportTicket",
        resourceId: ticket.id,
        after: { code: ticket.code, type: input.type, priority },
        context,
      },
      tx
    );

    return ticket;
  });

  logger.info({ code: created.code, type: input.type }, "Đã tạo phiếu hỗ trợ");

  return { code: created.code };
}

// -----------------------------------------------------------------------------
// Trả lời
// -----------------------------------------------------------------------------

export async function replyToTicket(
  actor: Actor,
  input: ReplyTicketInput,
  context: Context
): Promise<void> {
  const user = requireAuth(actor);
  const party = partyOf(actor);

  const ticket = await db.supportTicket.findUnique({
    where: { code: input.code },
    select: { id: true, userId: true, status: true, firstRespondedAt: true },
  });

  if (!ticket) throw appError("NOT_FOUND");

  // Khách chỉ trả lời phiếu của chính mình.
  if (party === "CUSTOMER" && ticket.userId !== user.userId) {
    throw appError("NOT_FOUND");
  }

  if (isTicketClosed(ticket.status as TicketStatus)) {
    throw appError(
      "RESOURCE_LOCKED",
      "Phiếu đã đóng. Vui lòng tạo phiếu mới nếu cần hỗ trợ tiếp."
    );
  }

  // Chỉ nhân viên gửi được ghi chú nội bộ. Khách đặt cờ này cũng vô hiệu (§19).
  const visibility = party === "STAFF" && input.internal ? "INTERNAL" : "CUSTOMER_VISIBLE";

  const nextStatus = statusAfterMessage(ticket.status as TicketStatus, party, visibility);

  await db.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.userId,
        authorRole: user.roles[0] ?? null,
        visibility,
        body: input.body,
      },
    });

    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        // Mốc phản hồi lần đầu chỉ tính khi nhân viên trả lời KHÁCH, không tính ghi chú
        // nội bộ — nếu không thì chỉ cần ghi một dòng cho nhau là SLA coi như đã đạt.
        ...(party === "STAFF" && visibility === "CUSTOMER_VISIBLE" && !ticket.firstRespondedAt
          ? { firstRespondedAt: new Date() }
          : {}),
      },
    });

    // Chỉ báo cho khách khi nhân viên trả lời họ.
    if (party === "STAFF" && visibility === "CUSTOMER_VISIBLE") {
      await enqueueOutbox(tx, {
        eventKey: "ticket.replied",
        aggregateId: ticket.id,
        payload: { code: input.code },
      });
    }

    await recordAudit(
      actor,
      {
        action: "ticket.replied",
        resourceType: "SupportTicket",
        resourceId: ticket.id,
        after: { visibility, statusAfter: nextStatus },
        context,
      },
      tx
    );
  });

  logger.info({ code: input.code, party, visibility }, "Đã trả lời phiếu hỗ trợ");
}

// -----------------------------------------------------------------------------
// Đổi trạng thái và phân công
// -----------------------------------------------------------------------------

export async function changeTicketStatus(
  actor: Actor,
  input: ChangeTicketStatusInput,
  context: Context
): Promise<void> {
  const user = requireAuth(actor);
  const party = partyOf(actor);

  const ticket = await db.supportTicket.findUnique({
    where: { code: input.code },
    select: { id: true, userId: true, status: true },
  });

  if (!ticket) throw appError("NOT_FOUND");

  if (party === "CUSTOMER" && ticket.userId !== user.userId) {
    throw appError("NOT_FOUND");
  }

  const from = ticket.status as TicketStatus;
  assertTicketTransition(from, input.toStatus, party, { note: input.note });

  const now = new Date();

  await db.$transaction(async (tx) => {
    const updated = await tx.supportTicket.updateMany({
      where: { id: ticket.id, status: from },
      data: {
        status: input.toStatus,
        ...(input.toStatus === "RESOLVED" ? { resolvedAt: now } : {}),
        ...(input.toStatus === "CLOSED" ? { closedAt: now } : {}),
      },
    });

    if (updated.count === 0) {
      throw appError(
        "STALE_VERSION",
        "Trạng thái phiếu vừa được người khác thay đổi. Vui lòng tải lại trang."
      );
    }

    // Lý do đổi trạng thái là thông tin khách cần đọc, nên lưu thành tin nhắn thật thay vì
    // giấu trong audit log.
    if (input.note?.trim()) {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.userId,
          authorRole: user.roles[0] ?? null,
          visibility: "CUSTOMER_VISIBLE",
          body: input.note,
        },
      });
    }

    if (input.toStatus === "RESOLVED") {
      await enqueueOutbox(tx, {
        eventKey: "ticket.resolved",
        aggregateId: ticket.id,
        payload: { code: input.code },
      });
    }

    await recordAudit(
      actor,
      {
        action: "ticket.status_changed",
        resourceType: "SupportTicket",
        resourceId: ticket.id,
        before: { status: from },
        after: { status: input.toStatus, note: input.note ?? null },
        context,
      },
      tx
    );
  });

  logger.info({ code: input.code, from, to: input.toStatus }, "Đã đổi trạng thái phiếu");
}

export async function assignTicket(
  actor: Actor,
  input: AssignTicketInput,
  context: Context
): Promise<void> {
  requirePermission(actor, "support.manage");

  const ticket = await db.supportTicket.findUnique({
    where: { code: input.code },
    select: { id: true, assigneeId: true, priority: true },
  });

  if (!ticket) throw appError("NOT_FOUND");

  await db.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        assigneeId: input.assigneeId,
        ...(input.priority ? { priority: input.priority } : {}),
      },
    });

    await recordAudit(
      actor,
      {
        action: "ticket.assigned",
        resourceType: "SupportTicket",
        resourceId: ticket.id,
        before: { assigneeId: ticket.assigneeId, priority: ticket.priority },
        after: { assigneeId: input.assigneeId, priority: input.priority ?? ticket.priority },
        context,
      },
      tx
    );
  });
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

const TICKET_LIST_SELECT = {
  id: true,
  code: true,
  type: true,
  priority: true,
  status: true,
  subject: true,
  slaDueAt: true,
  firstRespondedAt: true,
  createdAt: true,
  updatedAt: true,
  shipment: { select: { trackingCode: true } },
} satisfies Prisma.SupportTicketSelect;

export async function listMyTickets(actor: Actor) {
  const user = requireAuth(actor);

  return db.supportTicket.findMany({
    where: { userId: user.userId },
    select: TICKET_LIST_SELECT,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

/**
 * Chi tiết phiếu.
 *
 * Điều kiện `visibility` nằm TRONG truy vấn: ghi chú nội bộ không bao giờ rời khỏi database
 * khi người đọc là khách. Đây là điểm quan trọng nhất của module này (§19).
 */
export async function getTicket(actor: Actor, code: string) {
  const user = requireAuth(actor);
  const party = partyOf(actor);

  const ticket = await db.supportTicket.findUnique({
    where: { code },
    select: {
      ...TICKET_LIST_SELECT,
      userId: true,
      resolvedAt: true,
      closedAt: true,
      user: { select: { name: true, email: true } },
      messages: {
        where: party === "STAFF" ? {} : { visibility: "CUSTOMER_VISIBLE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          visibility: true,
          authorRole: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) throw appError("NOT_FOUND");

  if (party === "CUSTOMER" && ticket.userId !== user.userId) {
    throw appError("NOT_FOUND");
  }

  return ticket;
}

/** Hàng chờ của nhân viên hỗ trợ, ưu tiên phiếu quá hạn và mức khẩn cấp cao. */
export async function listTicketsForStaff(options: { onlyOpen?: boolean } = {}) {
  return db.supportTicket.findMany({
    where: options.onlyOpen
      ? { status: { in: ["OPEN", "WAITING_FOR_STAFF"] } }
      : { status: { not: "CLOSED" } },
    select: {
      ...TICKET_LIST_SELECT,
      user: { select: { name: true, email: true } },
      assigneeId: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
  });
}

// -----------------------------------------------------------------------------
// Liên hệ từ trang công khai (§23)
// -----------------------------------------------------------------------------

/**
 * Tiếp nhận form liên hệ.
 *
 * Không cần đăng nhập. Nếu người gửi đang đăng nhập thì vẫn không tự tạo `SupportTicket`:
 * liên hệ chung và phiếu hỗ trợ là hai luồng khác nhau, gộp lại sẽ làm hàng chờ hỗ trợ
 * lẫn cả câu hỏi bán hàng.
 */
export async function createContactInquiry(
  actor: Actor,
  input: ContactInquiryInput,
  context: Context
): Promise<{ id: string }> {
  const phoneNormalized = normalizePhone(input.phone);
  if (!phoneNormalized) {
    throw appError("VALIDATION_ERROR", "Số điện thoại không hợp lệ.", {
      fields: [{ path: "phone", message: "Số điện thoại không hợp lệ" }],
    });
  }

  const inquiry = await db.contactInquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      phoneNormalized,
      email: input.email ?? null,
      subject: input.subject,
      message: input.message,
      source: "contact-form",
    },
    select: { id: true },
  });

  await recordAudit(actor, {
    action: "contact_inquiry.created",
    resourceType: "ContactInquiry",
    resourceId: inquiry.id,
    after: { subject: input.subject, hasEmail: Boolean(input.email) },
    context,
  });

  logger.info({ inquiryId: inquiry.id }, "Đã nhận liên hệ từ trang công khai");

  return { id: inquiry.id };
}

export async function listContactInquiries(actor: Actor, status?: string) {
  requirePermission(actor, "support.read_all");

  return db.contactInquiry.findMany({
    where: status ? { status: status as never } : { status: { not: "SPAM" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function updateInquiryStatus(
  actor: Actor,
  inquiryId: string,
  status: string,
  context: Context
): Promise<void> {
  requirePermission(actor, "support.manage");

  const existing = await db.contactInquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, status: true },
  });

  if (!existing) throw appError("NOT_FOUND");

  await db.$transaction(async (tx) => {
    await tx.contactInquiry.update({
      where: { id: inquiryId },
      data: { status: status as never },
    });

    await recordAudit(
      actor,
      {
        action: "contact_inquiry.status_changed",
        resourceType: "ContactInquiry",
        resourceId: inquiryId,
        before: { status: existing.status },
        after: { status },
        context,
      },
      tx
    );
  });
}

/** Số phiếu và liên hệ đang chờ xử lý — dùng cho widget tổng quan (§26.3). */
export async function countPendingSupport(actor: Actor) {
  if (!isAuthenticated(actor) || !can(actor, "support.read_all")) {
    return { tickets: 0, inquiries: 0 };
  }

  const [tickets, inquiries] = await Promise.all([
    db.supportTicket.count({ where: { status: { in: ["OPEN", "WAITING_FOR_STAFF"] } } }),
    db.contactInquiry.count({ where: { status: "NEW" } }),
  ]);

  return { tickets, inquiries };
}
