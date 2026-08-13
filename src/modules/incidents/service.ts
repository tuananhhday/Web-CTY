import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateIncidentCode, generateRequestId } from "@/lib/ids";
import type { Actor } from "@/modules/auth/actor";
import {
  requirePermission,
  requireShipmentUpdateAccess,
  requireShipmentAccess,
  can,
} from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import {
  assertIncidentTransition,
  defaultSeverityFor,
  isIncidentOpen,
  shouldHoldShipment,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from "@/modules/incidents/state-machine";
import type {
  ChangeIncidentStatusInput,
  ReportIncidentInput,
  UpdateIncidentInput,
} from "@/modules/incidents/schema";

/**
 * Sự cố vận hành (§19).
 *
 * Trước module này, tài xế báo sự cố bằng cách chuyển chuyến sang trạng thái `INCIDENT` kèm
 * lý do. Cách đó ghi được VIỆC GÌ xảy ra nhưng không theo dõi được AI đang xử lý, xử lý tới
 * đâu, và kết luận ra sao. Bản ghi `Incident` bổ sung đúng phần thiếu đó; trạng thái chuyến
 * vẫn đổi như cũ để khách nhìn thấy ngay.
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "Shipment",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

const ASSIGNMENT_SELECT = {
  primaryDriverId: true,
  secondaryDriverId: true,
  isActive: true,
  effectiveFrom: true,
  effectiveTo: true,
} as const;

// -----------------------------------------------------------------------------
// Báo sự cố
// -----------------------------------------------------------------------------

export async function reportIncident(
  actor: Actor,
  input: ReportIncidentInput,
  context: Context
): Promise<{ code: string }> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode: input.trackingCode },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      assignments: { select: ASSIGNMENT_SELECT },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  // Tài xế đang được phân công hoặc nhân viên có quyền cập nhật chuyến.
  const user = requireShipmentUpdateAccess(actor, shipment);

  const type = input.type as IncidentType;
  const severity = defaultSeverityFor(type);
  const code = generateIncidentCode();
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  // Thời điểm xảy ra không được nằm ở tương lai — đồng hồ thiết bị có thể sai (§17).
  const now = new Date();
  const effectiveOccurredAt = occurredAt.getTime() > now.getTime() ? now : occurredAt;

  const hold = shouldHoldShipment(type, severity);

  const created = await db.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        code,
        shipmentId: shipment.id,
        type,
        severity,
        status: "OPEN",
        reportedById: user.userId,
        title: input.title,
        description: input.description,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        occurredAt: effectiveOccurredAt,
      },
      select: { id: true, code: true },
    });

    /*
     * Sự cố nghiêm trọng thì đưa chuyến sang INCIDENT luôn.
     *
     * Dùng `updateMany` kèm điều kiện trạng thái đang chạy: chuyến đã hủy hoặc đã hoàn tất
     * thì không kéo ngược lại được — báo sự cố muộn về một chuyến đã đóng là chuyện có thật,
     * và không được phép làm hỏng dữ liệu đã chốt.
     */
    if (hold) {
      const changed = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          status: {
            notIn: ["COMPLETED", "CANCELLED", "FAILED", "INCIDENT"],
          },
        },
        data: { status: "INCIDENT" },
      });

      if (changed.count > 0) {
        await tx.shipmentStatusEvent.create({
          data: {
            shipmentId: shipment.id,
            fromStatus: shipment.status,
            toStatus: "INCIDENT",
            actorId: user.userId,
            actorRole: user.roles[0] ?? null,
            source: "STAFF_PORTAL",
            note: `Sự cố ${incident.code}: ${input.title}`,
          },
        });

        await enqueueOutbox(tx, {
          eventKey: "shipment.incident",
          aggregateId: shipment.id,
          payload: { trackingCode: shipment.trackingCode },
        });
      }
    }

    await recordAudit(
      actor,
      {
        action: "incident.reported",
        resourceType: "Incident",
        resourceId: incident.id,
        after: {
          code: incident.code,
          type,
          severity,
          trackingCode: shipment.trackingCode,
          heldShipment: hold,
        },
        context,
      },
      tx
    );

    return incident;
  });

  logger.warn(
    { code: created.code, type, severity, trackingCode: shipment.trackingCode },
    "Đã ghi nhận sự cố"
  );

  return { code: created.code };
}

// -----------------------------------------------------------------------------
// Xử lý
// -----------------------------------------------------------------------------

export async function changeIncidentStatus(
  actor: Actor,
  input: ChangeIncidentStatusInput,
  context: Context
): Promise<void> {
  const user = requirePermission(actor, "incident.manage");

  const incident = await db.incident.findUnique({
    where: { code: input.code },
    select: { id: true, status: true, resolution: true },
  });

  if (!incident) throw appError("NOT_FOUND");

  const from = incident.status as IncidentStatus;
  assertIncidentTransition(from, input.toStatus, { resolution: input.resolution });

  const now = new Date();

  await db.$transaction(async (tx) => {
    const updated = await tx.incident.updateMany({
      where: { id: incident.id, status: from },
      data: {
        status: input.toStatus,
        ...(input.resolution?.trim() ? { resolution: input.resolution } : {}),
        ...(input.toStatus === "RESOLVED" ? { resolvedAt: now } : {}),
      },
    });

    if (updated.count === 0) {
      throw appError(
        "STALE_VERSION",
        "Trạng thái sự cố vừa được người khác thay đổi. Vui lòng tải lại trang."
      );
    }

    await recordAudit(
      actor,
      {
        action: "incident.status_changed",
        resourceType: "Incident",
        resourceId: incident.id,
        before: { status: from, resolution: incident.resolution },
        after: { status: input.toStatus, resolution: input.resolution ?? incident.resolution },
        context,
      },
      tx
    );
  });

  logger.info(
    { code: input.code, from, to: input.toStatus, actorId: user.userId },
    "Đã đổi trạng thái sự cố"
  );
}

export async function updateIncident(
  actor: Actor,
  input: UpdateIncidentInput,
  context: Context
): Promise<void> {
  requirePermission(actor, "incident.manage");

  const incident = await db.incident.findUnique({
    where: { code: input.code },
    select: { id: true, severity: true, assigneeId: true },
  });

  if (!incident) throw appError("NOT_FOUND");

  await db.$transaction(async (tx) => {
    await tx.incident.update({
      where: { id: incident.id },
      data: {
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      },
    });

    await recordAudit(
      actor,
      {
        action: "incident.updated",
        resourceType: "Incident",
        resourceId: incident.id,
        before: { severity: incident.severity, assigneeId: incident.assigneeId },
        after: {
          severity: input.severity ?? incident.severity,
          assigneeId: input.assigneeId !== undefined ? input.assigneeId : incident.assigneeId,
        },
        context,
      },
      tx
    );
  });
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

const INCIDENT_LIST_SELECT = {
  id: true,
  code: true,
  type: true,
  severity: true,
  status: true,
  title: true,
  occurredAt: true,
  resolvedAt: true,
  createdAt: true,
  shipment: { select: { trackingCode: true } },
  reportedBy: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.IncidentSelect;

/** Hàng chờ sự cố cho nhân viên, nghiêm trọng nhất lên đầu. */
export async function listIncidents(
  actor: Actor,
  options: { onlyOpen?: boolean } = {}
) {
  requirePermission(actor, "incident.read_all");

  return db.incident.findMany({
    where: options.onlyOpen
      ? { status: { in: ["OPEN", "INVESTIGATING", "ACTION_REQUIRED"] } }
      : {},
    select: INCIDENT_LIST_SELECT,
    orderBy: [{ severity: "desc" }, { occurredAt: "desc" }],
    take: 100,
  });
}

export async function getIncident(actor: Actor, code: string) {
  requirePermission(actor, "incident.read_all");

  const incident = await db.incident.findUnique({
    where: { code },
    select: {
      ...INCIDENT_LIST_SELECT,
      description: true,
      resolution: true,
      latitude: true,
      longitude: true,
      shipmentId: true,
    },
  });

  if (!incident) throw appError("NOT_FOUND");

  return incident;
}

/**
 * Sự cố của một chuyến, dùng trên trang điều phối và trang tài xế.
 *
 * Không đòi `incident.read_all`: tài xế đang chạy chuyến cần thấy sự cố mình vừa báo, mà
 * họ chỉ có `incident.manage` chứ không có quyền đọc toàn hệ thống (§8). Quyền truy cập
 * chuyến đã được kiểm tra, và truy vấn lọc theo đúng chuyến đó.
 */
export async function listIncidentsForShipment(actor: Actor, trackingCode: string) {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: { id: true, userId: true, assignments: { select: ASSIGNMENT_SELECT } },
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  // Khách hàng KHÔNG đọc chi tiết sự cố: mô tả nội bộ có thể nêu tên nhân sự, lỗi vận hành
  // và đánh giá trách nhiệm. Họ được thông báo chuyến gặp sự cố qua trạng thái đơn (§19).
  if (!can(actor, "incident.read_all") && !can(actor, "incident.manage")) {
    return [];
  }

  return db.incident.findMany({
    where: { shipmentId: shipment.id },
    select: INCIDENT_LIST_SELECT,
    orderBy: { occurredAt: "desc" },
  });
}

/** Số sự cố đang mở — widget tổng quan điều phối (§26.3). */
export async function countOpenIncidents(actor: Actor): Promise<number> {
  if (!can(actor, "incident.read_all")) return 0;

  return db.incident.count({
    where: { status: { in: ["OPEN", "INVESTIGATING", "ACTION_REQUIRED"] } },
  });
}

/** Chuyến còn sự cố chưa khép lại — dùng để cảnh báo trước khi đóng đơn. */
export async function hasOpenIncident(shipmentId: string): Promise<boolean> {
  const count = await db.incident.count({
    where: {
      shipmentId,
      status: { in: ["OPEN", "INVESTIGATING", "ACTION_REQUIRED"] },
    },
  });
  return count > 0;
}

export { isIncidentOpen };
export type { IncidentSeverity, IncidentStatus, IncidentType };
