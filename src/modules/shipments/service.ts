import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateRequestId } from "@/lib/ids";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requireShipmentAccess, requireShipmentUpdateAccess } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import * as repo from "@/modules/shipments/repository";
import {
  assertTransition,
  shipmentActorOf,
  hasReachedPickup,
  checkStatusPreconditions,
  REASON_CODE_REQUIRED_STATUSES,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";

/**
 * Nghiệp vụ đơn hàng: đổi trạng thái (§15).
 *
 * Tách khỏi `dispatch-service.ts` vì đây là thao tác cả tài xế lẫn điều phối đều dùng,
 * còn điều phối (tạo đơn, phân công xe) chỉ dành cho nhân viên.
 *
 * Bốn ràng buộc cứng của §15 được thực thi tại đây, không chỉ trong state machine:
 *   1. Không IN_TRANSIT trước khi có mặt ở điểm lấy hàng — state machine lo.
 *   2. Không COMPLETED khi chưa có bằng chứng giao hàng — kiểm tra database ở đây.
 *   3. Tài xế không tự quay ngược trạng thái — state machine lo qua vai trò.
 *   4. Hủy hoặc thất bại bắt buộc có mã lý do — kiểm tra ở đây.
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

export interface ChangeStatusInput {
  toStatus: ShipmentStatus;
  reason?: string | null;
  reasonCode?: string | null;
  /** Vị trí tài xế lúc bấm nút, nếu app gửi kèm (§17). */
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Mốc thời gian thực tế cần ghi khi bước sang một trạng thái nhất định.
 *
 * Ghi tại thời điểm chuyển thay vì suy ra từ `statusEvents` về sau: truy vấn danh sách
 * và báo cáo cần đọc trực tiếp từ `Shipment` mà không phải join lịch sử.
 */
function timestampsFor(to: ShipmentStatus, from: ShipmentStatus, now: Date) {
  const data: Prisma.ShipmentUpdateManyMutationInput = {};

  // Lấy hàng xong: mốc đầu tiên đi qua vạch "đã tới điểm lấy hàng".
  if (!hasReachedPickup(from) && hasReachedPickup(to)) {
    data.actualPickupAt = now;
  }
  if (to === "DELIVERED_PENDING_CONFIRMATION") data.deliveredAt = now;
  if (to === "COMPLETED") data.completedAt = now;

  return data;
}

export async function changeShipmentStatus(
  actor: Actor,
  trackingCode: string,
  input: ChangeStatusInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      status: true,
      userId: true,
      assignments: {
        select: {
          primaryDriverId: true,
          secondaryDriverId: true,
          isActive: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      },
      // Chỉ bản đang hiệu lực mới tính là "đã có bằng chứng giao hàng" (§18).
      proofOfDeliveries: {
        where: { supersededAt: null },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  // Tài xế phải đang được phân công; nhân viên điều phối thì không cần.
  const user = requireShipmentUpdateAccess(actor, shipment);

  const from = shipment.status as ShipmentStatus;
  const to = input.toStatus;
  const by = shipmentActorOf(actor);
  const reason = input.reason?.trim() || null;
  const reasonCode = input.reasonCode?.trim() || null;

  assertTransition(from, to, by, { reason });

  // Ràng buộc 2 và 4 của §15: phụ thuộc dữ liệu nên kiểm tra sau khi đã nạp đơn hàng.
  const preconditions = checkStatusPreconditions({
    to,
    reasonCode,
    hasProofOfDelivery: shipment.proofOfDeliveries.length > 0,
  });
  if (!preconditions.allowed) {
    throw appError("INVALID_STATE_TRANSITION", preconditions.reason);
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Điều kiện `status: from` chống race: hai người cùng bấm thì người sau thất bại
    // thay vì ghi đè âm thầm.
    const updated = await tx.shipment.updateMany({
      where: { id: shipment.id, status: from },
      data: {
        status: to,
        ...timestampsFor(to, from, now),
        ...(REASON_CODE_REQUIRED_STATUSES.includes(to)
          ? { cancelReasonCode: reasonCode, cancelReason: reason }
          : {}),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw appError(
        "STALE_VERSION",
        "Trạng thái đơn hàng vừa được người khác thay đổi. Vui lòng tải lại trang."
      );
    }

    await tx.shipmentStatusEvent.create({
      data: {
        shipmentId: shipment.id,
        fromStatus: from,
        toStatus: to,
        actorId: user.userId,
        actorRole: user.roles[0] ?? null,
        source: by === "DRIVER" ? "DRIVER_APP" : "STAFF_PORTAL",
        note: reason,
        reasonCode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
    });

    await enqueueOutbox(tx, {
      eventKey: `shipment.${to.toLowerCase()}`,
      aggregateId: shipment.id,
      payload: { trackingCode, fromStatus: from, toStatus: to },
    });

    await recordAudit(
      actor,
      {
        action: "shipment.status_changed",
        resourceType: "Shipment",
        resourceId: shipment.id,
        before: { status: from },
        after: { status: to, reason, reasonCode },
        context,
      },
      tx
    );
  });

  logger.info({ trackingCode, from, to }, "Đã đổi trạng thái đơn hàng");
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

/** Chi tiết đơn cho nhân viên điều phối. Ném NOT_FOUND nếu không đủ quyền. */
export async function getShipmentAsStaff(actor: Actor, trackingCode: string) {
  const shipment = await repo.findShipmentByTrackingCode(trackingCode);
  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  return shipment;
}

/**
 * Chuyến của tài xế đang đăng nhập (§26.2).
 *
 * Lọc theo `driverProfileId` ngay trong truy vấn — tài xế không bao giờ thấy chuyến của
 * người khác, kể cả khi tầng trên quên kiểm tra (§8, §30.2).
 */
export async function listMyDriverShipments(actor: Actor) {
  const user = requireDriverProfile(actor);
  return repo.listShipmentsForDriver(user.driverProfileId);
}

/**
 * Chi tiết một chuyến của tài xế.
 *
 * Dùng `requireShipmentAccess` với `requireCurrentlyActive: false`: tài xế xem lại được
 * chuyến đã hoàn thành của mình để đối chiếu, nhưng `changeShipmentStatus` vẫn đòi
 * assignment còn hiệu lực nên họ không sửa được gì sau khi bị gỡ khỏi chuyến.
 */
export async function getDriverShipment(actor: Actor, trackingCode: string) {
  requireDriverProfile(actor);

  const shipment = await repo.findShipmentForDriver(trackingCode);
  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  return shipment;
}

function requireDriverProfile(actor: Actor): { userId: string; driverProfileId: string } {
  if (!isAuthenticated(actor) || !actor.driverProfileId) {
    // Không phải tài xế thì coi như khu vực này không tồn tại (§30.2).
    throw appError("NOT_FOUND");
  }
  return { userId: actor.userId, driverProfileId: actor.driverProfileId };
}
