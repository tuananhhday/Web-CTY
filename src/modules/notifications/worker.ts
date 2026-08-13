import "server-only";
import { db, type Prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  buildNotification,
  UnknownEventError,
  type Audience,
  type EventPayload,
  type NotificationContent,
} from "@/modules/notifications/catalog";
import { decideRetry } from "@/modules/notifications/retry";

/**
 * Worker xử lý OutboxEvent (§21).
 *
 * Mọi service nghiệp vụ đã ghi `OutboxEvent` trong CÙNG transaction với thay đổi dữ liệu —
 * nhờ vậy không có trường hợp đơn hàng đổi trạng thái mà thông báo biến mất, hay ngược lại.
 * Worker này là nửa còn lại của mô hình: đọc hàng chờ và thực sự tạo thông báo.
 *
 * Chưa có bộ lập lịch. Hiện gọi qua `POST /api/internal/outbox/run` (có khoá bảo vệ) hoặc
 * script thủ công. Cron hoặc worker thường trú thuộc Pha 9 — ghi rõ ở đây để không ai tưởng
 * nó tự chạy.
 */

/** Số sự kiện xử lý trong một lượt chạy. Giữ nhỏ để một lượt không chạy quá lâu. */
const DEFAULT_BATCH_SIZE = 50;

/**
 * Sự kiện `PROCESSING` quá lâu coi như worker trước đã chết giữa chừng.
 *
 * Không có mốc này thì một lần crash sẽ khoá sự kiện đó vĩnh viễn ở trạng thái `PROCESSING`
 * và không ai xử lý nữa.
 */
const STUCK_PROCESSING_MINUTES = 15;

export interface WorkerResult {
  claimed: number;
  sent: number;
  failed: number;
  deadLettered: number;
  skipped: number;
}

/**
 * Người nhận, kèm nhóm của họ.
 *
 * Giữ nhóm chứ không chỉ trả `userId`: link tới trang nào phụ thuộc vào việc người đó là
 * khách hay tài xế. Một người vừa là khách vừa là tài xế thì nhận theo nhóm nào cũng được —
 * chọn nhóm đầu tiên khớp, không tạo hai thông báo trùng nội dung.
 */
async function resolveRecipients(
  aggregateType: string,
  aggregateId: string,
  content: NotificationContent
): Promise<{ userId: string; audience: Audience }[]> {
  const byUser = new Map<string, Audience>();
  const add = (userId: string, audience: Audience) => {
    if (!byUser.has(userId)) byUser.set(userId, audience);
  };

  if (aggregateType === "Shipment") {
    const shipment = await db.shipment.findUnique({
      where: { id: aggregateId },
      select: {
        userId: true,
        assignments: {
          where: { isActive: true },
          select: {
            primaryDriver: { select: { userId: true } },
            secondaryDriver: { select: { userId: true } },
          },
        },
      },
    });

    if (!shipment) return [];

    // Khách trước tài xế: người vừa đặt hàng vừa lái xe thì trải nghiệm khách quan trọng hơn.
    if (content.audience.includes("CUSTOMER") && shipment.userId) {
      add(shipment.userId, "CUSTOMER");
    }

    if (content.audience.includes("DRIVER")) {
      for (const assignment of shipment.assignments) {
        if (assignment.primaryDriver) add(assignment.primaryDriver.userId, "DRIVER");
        if (assignment.secondaryDriver) add(assignment.secondaryDriver.userId, "DRIVER");
      }
    }
  }

  if (aggregateType === "ServiceRequest" && content.audience.includes("CUSTOMER")) {
    const request = await db.serviceRequest.findUnique({
      where: { id: aggregateId },
      select: { userId: true },
    });
    if (request?.userId) add(request.userId, "CUSTOMER");
  }

  if (aggregateType === "Quote" && content.audience.includes("CUSTOMER")) {
    const quote = await db.quote.findUnique({
      where: { id: aggregateId },
      select: { serviceRequest: { select: { userId: true } } },
    });
    if (quote?.serviceRequest?.userId) add(quote.serviceRequest.userId, "CUSTOMER");
  }

  if (aggregateType === "SupportTicket" && content.audience.includes("CUSTOMER")) {
    const ticket = await db.supportTicket.findUnique({
      where: { id: aggregateId },
      select: { userId: true },
    });
    if (ticket?.userId) add(ticket.userId, "CUSTOMER");
  }

  return [...byUser].map(([userId, audience]) => ({ userId, audience }));
}

/**
 * Xử lý một sự kiện.
 *
 * Tạo `Notification` trong ứng dụng. Gửi email/SMS chưa nối vào đây: `NotificationPreference`
 * chưa có giao diện cho người dùng chọn kênh, mà gửi email giao dịch khi chưa hỏi ý kiến là
 * sai với §21 và §31. Thông báo trong ứng dụng thì không cần hỏi vì người dùng chủ động vào
 * xem.
 */
async function processEvent(event: {
  id: string;
  eventKey: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
}): Promise<"sent" | "skipped"> {
  const payload = (event.payload ?? {}) as EventPayload;
  const content = buildNotification(event.eventKey, payload);

  // Sự kiện có thật nhưng cố ý không báo cho ai.
  if (!content) return "skipped";

  const recipients = await resolveRecipients(event.aggregateType, event.aggregateId, content);

  if (recipients.length === 0) {
    // Khách vãng lai không có tài khoản thì không có chỗ nhận thông báo trong ứng dụng.
    // Đây là kết quả hợp lệ, không phải lỗi cần retry.
    return "skipped";
  }

  await db.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      eventKey: event.eventKey,
      severity: content.severity,
      title: content.title,
      body: content.body,
      // Mỗi nhóm đi vào khu vực của mình; không có link cho nhóm đó thì để trống.
      linkUrl: content.linkUrl[recipient.audience] ?? null,
    })),
  });

  return "sent";
}

/**
 * Chạy một lượt xử lý hàng chờ.
 *
 * Nhận sự kiện bằng cách đổi trạng thái sang `PROCESSING` với điều kiện trạng thái cũ —
 * hai worker chạy song song thì chỉ một cái nhận được, cái kia thấy `count = 0` và bỏ qua.
 */
export async function runOutboxOnce(
  options: { batchSize?: number; now?: Date } = {}
): Promise<WorkerResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  const result: WorkerResult = { claimed: 0, sent: 0, failed: 0, deadLettered: 0, skipped: 0 };

  // Giải phóng sự kiện bị kẹt do worker trước chết giữa chừng.
  const stuckBefore = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60_000);
  const released = await db.outboxEvent.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: stuckBefore } },
    data: { status: "PENDING" },
  });
  if (released.count > 0) {
    logger.warn({ count: released.count }, "Giải phóng sự kiện outbox bị kẹt ở PROCESSING");
  }

  const candidates = await db.outboxEvent.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextRetryAt: { lte: now } },
        { status: "FAILED", nextRetryAt: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      eventKey: true,
      aggregateType: true,
      aggregateId: true,
      payload: true,
      status: true,
      attempts: true,
      maxAttempts: true,
    },
  });

  for (const candidate of candidates) {
    const claimed = await db.outboxEvent.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });

    if (claimed.count === 0) continue;
    result.claimed += 1;

    const attempts = candidate.attempts + 1;

    try {
      const outcome = await processEvent(candidate);

      await db.outboxEvent.update({
        where: { id: candidate.id },
        data: { status: "SENT", processedAt: new Date(), lastError: null },
      });

      if (outcome === "sent") result.sent += 1;
      else result.skipped += 1;
    } catch (error) {
      const decision = decideRetry({
        attempts,
        maxAttempts: candidate.maxAttempts,
        error,
        now,
      });

      await db.outboxEvent.update({
        where: { id: candidate.id },
        data: {
          status: decision.status,
          nextRetryAt: decision.nextRetryAt,
          lastError: decision.reason.slice(0, 1000),
        },
      });

      if (decision.status === "DEAD_LETTER") {
        result.deadLettered += 1;
        logger.error(
          { eventKey: candidate.eventKey, outboxId: candidate.id, reason: decision.reason },
          "Sự kiện outbox chuyển sang dead-letter"
        );
      } else {
        result.failed += 1;
        logger.warn(
          { eventKey: candidate.eventKey, outboxId: candidate.id, attempts },
          "Xử lý sự kiện outbox thất bại, sẽ thử lại"
        );
      }

      // Sự kiện chưa khai báo là lỗi lập trình, cần biết ngay chứ không chỉ nằm trong log.
      if (error instanceof UnknownEventError) {
        logger.error({ eventKey: candidate.eventKey }, error.message);
      }
    }
  }

  if (result.claimed > 0) {
    logger.info(result, "Đã chạy một lượt outbox");
  }

  return result;
}

/** Sự kiện cần người can thiệp. Dùng cho màn hình vận hành và cảnh báo (§32). */
export async function listDeadLetters(limit = 50) {
  return db.outboxEvent.findMany({
    where: { status: "DEAD_LETTER" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventKey: true,
      aggregateType: true,
      aggregateId: true,
      attempts: true,
      lastError: true,
      updatedAt: true,
    },
  });
}

/** Đưa một sự kiện dead-letter trở lại hàng chờ sau khi đã xử lý nguyên nhân. */
export async function requeueDeadLetter(id: string): Promise<void> {
  await db.outboxEvent.updateMany({
    where: { id, status: "DEAD_LETTER" },
    data: { status: "PENDING", attempts: 0, nextRetryAt: null, lastError: null },
  });

  logger.info({ outboxId: id }, "Đưa sự kiện dead-letter trở lại hàng chờ");
}
