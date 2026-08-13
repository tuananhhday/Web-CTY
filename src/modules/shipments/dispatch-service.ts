import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateTrackingCode, generateRequestId } from "@/lib/ids";
import { toStorage } from "@/lib/money";
import type { Actor } from "@/modules/auth/actor";
import { requirePermission } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import * as fleetRepo from "@/modules/fleet/repository";
import {
  findConflicts,
  canOverride,
  summarizeConflicts,
  isExclusionViolation,
  type Conflict,
} from "@/modules/fleet/conflicts";
import { assertTransition, shipmentActorOf } from "@/modules/shipments/state-machine";
import type { AssignmentInput, CreateShipmentInput } from "@/modules/fleet/schema";

/**
 * Điều phối: tạo đơn hàng và phân công xe, tài xế (§14.3, §15).
 *
 * Ba lớp chống double-booking hoạt động cùng nhau ở đây:
 *   1. `findConflicts` cho thông báo dễ hiểu trước khi ghi.
 *   2. Transaction giữ mọi thay đổi cùng một khối.
 *   3. Exclusion constraint của PostgreSQL chặn tuyệt đối — kể cả khi hai dispatcher
 *      bấm cùng lúc và cả hai đều qua được lớp 1.
 */

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

// -----------------------------------------------------------------------------
// Tạo đơn hàng từ báo giá đã chấp nhận
// -----------------------------------------------------------------------------

export async function createShipmentFromQuote(
  actor: Actor,
  input: CreateShipmentInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<{ trackingCode: string }> {
  const user = requirePermission(actor, "shipment.dispatch");

  const quote = await db.quote.findUnique({
    where: { code: input.quoteCode },
    select: {
      id: true,
      code: true,
      status: true,
      acceptedRevisionId: true,
      shipment: { select: { trackingCode: true } },
      acceptedRevision: { select: { totalAmount: true } },
      serviceRequest: {
        select: {
          id: true,
          code: true,
          status: true,
          userId: true,
          requestedVehicleTypeId: true,
          stops: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });

  if (!quote) throw appError("NOT_FOUND", "Không tìm thấy báo giá.");

  // Chỉ tạo đơn từ báo giá khách đã chấp nhận (§14.3).
  if (quote.status !== "ACCEPTED" || !quote.acceptedRevisionId) {
    throw appError(
      "INVALID_STATE_TRANSITION",
      "Chỉ tạo được đơn hàng từ báo giá khách đã chấp nhận."
    );
  }

  // Quan hệ Quote↔Shipment là một-một; tạo lần hai sẽ vi phạm unique constraint.
  if (quote.shipment) {
    throw appError(
      "CONFLICT",
      `Báo giá này đã có đơn hàng ${quote.shipment.trackingCode}.`
    );
  }

  const trackingCode = generateTrackingCode();

  const created = await db.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        trackingCode,
        userId: quote.serviceRequest.userId,
        serviceRequestId: quote.serviceRequest.id,
        quoteId: quote.id,
        vehicleTypeId: quote.serviceRequest.requestedVehicleTypeId,
        status: "CREATED",
        scheduledPickupAt: input.scheduledPickupAt ? new Date(input.scheduledPickupAt) : null,
        estimatedDeliveryAt: input.estimatedDeliveryAt
          ? new Date(input.estimatedDeliveryAt)
          : null,
        totalAmount: quote.acceptedRevision
          ? toStorage(quote.acceptedRevision.totalAmount.toString())
          : null,
        instructions: input.instructions ?? null,
        createdById: user.userId,

        // Sao chép điểm dừng từ yêu cầu. Sao chép chứ không tham chiếu: yêu cầu có thể
        // được sửa về sau, còn đơn hàng phải giữ đúng địa chỉ tại thời điểm chốt.
        stops: {
          create: quote.serviceRequest.stops.map((stop, index) => ({
            kind: stop.kind,
            sequence: index,
            contactName: stop.contactName,
            contactPhone: stop.contactPhone,
            line: stop.line,
            ward: stop.ward,
            district: stop.district,
            province: stop.province,
            latitude: stop.latitude,
            longitude: stop.longitude,
            floorNumber: stop.floorNumber,
            hasElevator: stop.hasElevator,
            carryDistanceM: stop.carryDistanceM,
            accessNote: stop.accessNote,
          })),
        },

        statusEvents: {
          create: {
            fromStatus: null,
            toStatus: "CREATED",
            actorId: user.userId,
            actorRole: user.roles[0] ?? null,
            source: "STAFF_PORTAL",
            // Không nhúng mã báo giá vào đây: tài xế đọc được lịch sử chuyến nhưng không
            // có quyền với dữ liệu báo giá (§8). Liên kết tới báo giá đã có sẵn qua quan
            // hệ `quote`, và AuditLog vẫn ghi đầy đủ để truy vết.
            note: "Tạo từ báo giá đã chốt",
          },
        },
      },
      select: { id: true, trackingCode: true },
    });

    // Yêu cầu dịch vụ khép lại vòng đời.
    await tx.serviceRequest.updateMany({
      where: { id: quote.serviceRequest.id, status: "ACCEPTED" },
      data: { status: "CONVERTED_TO_SHIPMENT" },
    });

    await tx.requestStatusEvent.create({
      data: {
        serviceRequestId: quote.serviceRequest.id,
        fromStatus: "ACCEPTED",
        toStatus: "CONVERTED_TO_SHIPMENT",
        actorId: user.userId,
        actorRole: user.roles[0] ?? null,
        reason: `Đã tạo đơn hàng ${shipment.trackingCode}`,
      },
    });

    await enqueueOutbox(tx, {
      eventKey: "shipment.created",
      aggregateId: shipment.id,
      payload: { trackingCode: shipment.trackingCode, quoteCode: quote.code },
    });

    await recordAudit(
      actor,
      {
        action: "shipment.created",
        resourceType: "Shipment",
        resourceId: shipment.id,
        after: {
          trackingCode: shipment.trackingCode,
          quoteCode: quote.code,
          serviceRequestCode: quote.serviceRequest.code,
        },
        context,
      },
      tx
    );

    return shipment;
  });

  logger.info({ trackingCode: created.trackingCode, quoteCode: quote.code }, "Đã tạo đơn hàng");

  return { trackingCode: created.trackingCode };
}

// -----------------------------------------------------------------------------
// Kiểm tra xung đột (dùng cho xem trước, không ghi gì)
// -----------------------------------------------------------------------------

export interface ConflictPreview {
  conflicts: Conflict[];
  overridable: boolean;
  summary: string;
}

export async function checkAssignmentConflicts(
  actor: Actor,
  input: {
    vehicleId: string | null;
    primaryDriverId: string | null;
    secondaryDriverId: string | null;
    effectiveFrom: Date;
    effectiveTo: Date;
    excludeAssignmentId?: string;
    /** Mã tra cứu của chuyến đang phân công lại — phân công cũ của nó không tính là xung đột. */
    excludeTrackingCode?: string;
  }
): Promise<ConflictPreview> {
  requirePermission(actor, "shipment.dispatch");

  const driverIds = [input.primaryDriverId, input.secondaryDriverId].filter(
    (id): id is string => Boolean(id)
  );

  const excludeShipmentId = input.excludeTrackingCode
    ? ((
        await db.shipment.findUnique({
          where: { trackingCode: input.excludeTrackingCode },
          select: { id: true },
        })
      )?.id ?? undefined)
    : undefined;

  const [assignments, blocks] = await Promise.all([
    fleetRepo.listAssignmentsInWindow({
      from: input.effectiveFrom,
      to: input.effectiveTo,
      vehicleId: input.vehicleId,
      driverIds,
    }),
    fleetRepo.listBlocksInWindow({
      from: input.effectiveFrom,
      to: input.effectiveTo,
      vehicleId: input.vehicleId,
      driverIds,
    }),
  ]);

  const conflicts = findConflicts({
    window: { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo },
    vehicleId: input.vehicleId,
    primaryDriverId: input.primaryDriverId,
    secondaryDriverId: input.secondaryDriverId,
    excludeAssignmentId: input.excludeAssignmentId,
    excludeShipmentId,
    existingAssignments: assignments.map((a) => ({
      id: a.id,
      shipmentId: a.shipmentId,
      shipmentTrackingCode: a.shipment.trackingCode,
      vehicleId: a.vehicleId,
      primaryDriverId: a.primaryDriverId,
      secondaryDriverId: a.secondaryDriverId,
      isActive: a.isActive,
      overrideConflict: a.overrideConflict,
      effectiveFrom: a.effectiveFrom,
      effectiveTo: a.effectiveTo,
    })),
    availabilityBlocks: blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      reason: b.reason,
      vehicleId: b.vehicleId,
      driverProfileId: b.driverProfileId,
      effectiveFrom: b.startsAt,
      effectiveTo: b.endsAt,
    })),
  });

  return {
    conflicts,
    overridable: canOverride(conflicts),
    summary: summarizeConflicts(conflicts),
  };
}

// -----------------------------------------------------------------------------
// Phân công
// -----------------------------------------------------------------------------

export async function assignVehicleAndDriver(
  actor: Actor,
  trackingCode: string,
  input: AssignmentInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  const user = requirePermission(actor, "shipment.dispatch");

  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: { id: true, status: true, trackingCode: true },
  });
  if (!shipment) throw appError("NOT_FOUND");

  const effectiveFrom = new Date(input.effectiveFrom);
  const effectiveTo = new Date(input.effectiveTo);

  const preview = await checkAssignmentConflicts(actor, {
    vehicleId: input.vehicleId,
    primaryDriverId: input.primaryDriverId,
    secondaryDriverId: input.secondaryDriverId ?? null,
    effectiveFrom,
    effectiveTo,
    // Phân công cũ của chính chuyến này sắp bị gỡ trong cùng transaction bên dưới.
    excludeTrackingCode: trackingCode,
  });

  if (preview.conflicts.length > 0) {
    // Bảo trì và nghỉ phép là ràng buộc vật lý, không override được.
    if (!preview.overridable) {
      throw appError("DOUBLE_BOOKING", preview.summary);
    }
    // Trùng phân công thì override được, nhưng phải chủ động chọn và nêu lý do.
    if (!input.overrideConflict) {
      throw appError("DOUBLE_BOOKING", preview.summary);
    }
  }

  // Chuyến đã có tài xế thì chuyển sang DRIVER_ASSIGNED nếu đang ở bước lên lịch.
  const by = shipmentActorOf(actor);
  const shouldAdvance = shipment.status === "SCHEDULED";
  if (shouldAdvance) {
    assertTransition("SCHEDULED", "DRIVER_ASSIGNED", by);
  }

  try {
    await db.$transaction(async (tx) => {
      // Gỡ phân công cũ thay vì xoá — giữ lịch sử đổi tài xế (§14.3).
      await tx.shipmentAssignment.updateMany({
        where: { shipmentId: shipment.id, isActive: true },
        data: { isActive: false, releasedAt: new Date() },
      });

      await tx.shipmentAssignment.create({
        data: {
          shipmentId: shipment.id,
          vehicleId: input.vehicleId,
          primaryDriverId: input.primaryDriverId,
          secondaryDriverId: input.secondaryDriverId || null,
          effectiveFrom,
          effectiveTo,
          isActive: true,
          overrideConflict: input.overrideConflict,
          overrideReason: input.overrideReason ?? null,
          assignedById: user.userId,
          note: input.note ?? null,
        },
      });

      if (shouldAdvance) {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "DRIVER_ASSIGNED" },
        });

        await tx.shipmentStatusEvent.create({
          data: {
            shipmentId: shipment.id,
            fromStatus: "SCHEDULED",
            toStatus: "DRIVER_ASSIGNED",
            actorId: user.userId,
            actorRole: user.roles[0] ?? null,
            source: "STAFF_PORTAL",
          },
        });

        await enqueueOutbox(tx, {
          eventKey: "shipment.driver_assigned",
          aggregateId: shipment.id,
          payload: { trackingCode: shipment.trackingCode },
        });
      }

      // Override luôn để lại dấu vết trong AuditLog (§14.3).
      await recordAudit(
        actor,
        {
          action: input.overrideConflict
            ? "shipment.assignment_overridden"
            : "shipment.assigned",
          resourceType: "Shipment",
          resourceId: shipment.id,
          after: {
            vehicleId: input.vehicleId,
            primaryDriverId: input.primaryDriverId,
            secondaryDriverId: input.secondaryDriverId ?? null,
            effectiveFrom: effectiveFrom.toISOString(),
            effectiveTo: effectiveTo.toISOString(),
            overrideConflict: input.overrideConflict,
            overrideReason: input.overrideReason ?? null,
            conflictsAtAssignTime: preview.conflicts.map((c) => c.message),
          },
          context,
        },
        tx
      );
    });
  } catch (error) {
    // Lớp bảo vệ thứ ba: hai dispatcher bấm cùng lúc, cả hai qua được kiểm tra ở tầng
    // ứng dụng nhưng database chỉ nhận một. Đổi lỗi thô thành thông báo hiểu được.
    if (isExclusionViolation(error)) {
      logger.warn({ trackingCode }, "Exclusion constraint chặn phân công trùng lịch");
      throw appError(
        "DOUBLE_BOOKING",
        "Xe hoặc tài xế vừa được phân công cho chuyến khác trong khoảng thời gian này. Vui lòng tải lại trang và chọn phương án khác."
      );
    }
    throw error;
  }

  logger.info(
    { trackingCode, overridden: input.overrideConflict },
    "Đã phân công xe và tài xế"
  );
}

/** Gỡ phân công hiện tại, giữ lại lịch sử. */
export async function releaseAssignment(
  actor: Actor,
  trackingCode: string,
  reason: string,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  const user = requirePermission(actor, "shipment.dispatch");

  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: { id: true, status: true },
  });
  if (!shipment) throw appError("NOT_FOUND");

  await db.$transaction(async (tx) => {
    const released = await tx.shipmentAssignment.updateMany({
      where: { shipmentId: shipment.id, isActive: true },
      data: { isActive: false, releasedAt: new Date() },
    });

    if (released.count === 0) {
      throw appError("CONFLICT", "Chuyến này chưa có phân công nào đang hiệu lực.");
    }

    if (shipment.status === "DRIVER_ASSIGNED") {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "SCHEDULED" },
      });

      await tx.shipmentStatusEvent.create({
        data: {
          shipmentId: shipment.id,
          fromStatus: "DRIVER_ASSIGNED",
          toStatus: "SCHEDULED",
          actorId: user.userId,
          actorRole: user.roles[0] ?? null,
          source: "STAFF_PORTAL",
          note: reason,
        },
      });
    }

    await recordAudit(
      actor,
      {
        action: "shipment.assignment_released",
        resourceType: "Shipment",
        resourceId: shipment.id,
        after: { reason },
        context,
      },
      tx
    );
  });

  logger.info({ trackingCode }, "Đã gỡ phân công");
}
