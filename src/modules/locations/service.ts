import "server-only";
import { db } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { addDays } from "@/lib/datetime";
import type { Actor } from "@/modules/auth/actor";
import { requireShipmentUpdateAccess, requireShipmentAccess, can } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import { isActiveOnRoad, type ShipmentStatus } from "@/modules/shipments/state-machine";
import { evaluatePing, coarsen, type PingRejectReason } from "@/modules/locations/rules";
import type { LocationBatchInput, LocationSharingInput } from "@/modules/locations/schema";

/**
 * Vị trí chuyến (§17).
 *
 * Ba điều §17 nhấn mạnh, được thực thi ở đây:
 *
 *   1. Đây là vị trí XE/CHUYẾN, không phải GPS của từng kiện hàng. Hàng hóa không tự có
 *      thiết bị định vị. Ngôn từ trong giao diện phải nói đúng như vậy.
 *   2. Chỉ nhận ping khi assignment đang hoạt động — tài xế đã bàn giao xe thì điện thoại
 *      của họ không còn là vị trí của chuyến.
 *   3. Khách chỉ xem được khi doanh nghiệp bật chia sẻ cho chuyến đó, và toạ độ đã làm thô.
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

const ASSIGNMENT_SELECT = {
  primaryDriverId: true,
  secondaryDriverId: true,
  isActive: true,
  effectiveFrom: true,
  effectiveTo: true,
} as const;

export interface IngestResult {
  accepted: number;
  rejected: { index: number; reason: PingRejectReason; message: string }[];
}

/**
 * Nhận một lô điểm vị trí từ thiết bị tài xế.
 *
 * Không ném lỗi khi vài điểm bị loại: thiết bị gửi lô 50 điểm mà một điểm sai thì loại
 * điểm đó, không vứt cả lô. Trả về danh sách bị loại để app tài xế biết mà không gửi lại.
 */
export async function ingestLocationBatch(
  actor: Actor,
  input: LocationBatchInput
): Promise<IngestResult> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode: input.trackingCode },
    select: {
      id: true,
      status: true,
      assignments: {
        where: { isActive: true },
        select: { id: true, ...ASSIGNMENT_SELECT },
        take: 1,
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentUpdateAccess(actor, shipment);

  // Điều kiện 2 của §17: chuyến phải đang trên đường.
  if (!isActiveOnRoad(shipment.status as ShipmentStatus)) {
    throw appError(
      "INVALID_STATE_TRANSITION",
      "Chỉ nhận vị trí khi chuyến đang thực hiện. Vui lòng cập nhật trạng thái trước."
    );
  }

  const assignment = shipment.assignments[0];
  if (!assignment) {
    throw appError("CONFLICT", "Chuyến này chưa có phân công đang hiệu lực.");
  }

  const last = await db.locationPing.findFirst({
    where: { shipmentId: shipment.id },
    orderBy: { recordedAt: "desc" },
    select: { latitude: true, longitude: true, recordedAt: true },
  });

  let previous = last
    ? {
        latitude: Number(last.latitude),
        longitude: Number(last.longitude),
        recordedAt: last.recordedAt,
      }
    : null;

  const receivedAt = new Date();
  const rejected: IngestResult["rejected"] = [];
  const toInsert: {
    shipmentId: string;
    assignmentId: string;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    speedKph: number | null;
    heading: number | null;
    recordedAt: Date;
    receivedAt: Date;
  }[] = [];

  // Sắp xếp theo thời gian thiết bị ghi: lô gửi dồn sau khi mất sóng thường lộn xộn thứ tự,
  // mà luật "điểm sau phải mới hơn điểm trước" chỉ đúng khi duyệt theo đúng trình tự.
  const sorted = [...input.pings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  for (const [index, ping] of sorted.entries()) {
    const candidate = {
      latitude: ping.latitude,
      longitude: ping.longitude,
      accuracyM: ping.accuracyM ?? null,
      speedKph: ping.speedKph ?? null,
      heading: ping.heading ?? null,
      recordedAt: new Date(ping.recordedAt),
    };

    const decision = evaluatePing(candidate, { previous, receivedAt });

    if (!decision.accept) {
      rejected.push({ index, reason: decision.reason, message: decision.message });
      continue;
    }

    toInsert.push({
      shipmentId: shipment.id,
      assignmentId: assignment.id,
      ...candidate,
      receivedAt,
    });

    previous = {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      recordedAt: candidate.recordedAt,
    };
  }

  if (toInsert.length > 0) {
    await db.locationPing.createMany({ data: toInsert });
  }

  logger.debug(
    { trackingCode: input.trackingCode, accepted: toInsert.length, rejected: rejected.length },
    "Nhận lô vị trí"
  );

  return { accepted: toInsert.length, rejected };
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export interface TrackPoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

export type LocationView =
  | { available: true; points: TrackPoint[]; coarse: boolean }
  | { available: false; reason: "SHARING_DISABLED" | "NOT_ACTIVE" | "NO_DATA" };

/**
 * Vị trí chuyến cho khách hàng xem.
 *
 * Ba lớp chặn theo §17: doanh nghiệp phải bật chia sẻ cho chuyến đó, chuyến phải đang chạy,
 * và toạ độ trả về đã làm thô về khoảng 100m. Nhân viên có `tracking.read_all` xem toạ độ
 * đầy đủ vì họ cần điều hành thật.
 */
export async function getShipmentTrack(
  actor: Actor,
  trackingCode: string
): Promise<LocationView> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      userId: true,
      status: true,
      locationSharingEnabled: true,
      assignments: { select: ASSIGNMENT_SELECT },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  const isStaff = can(actor, "tracking.read_all");

  if (!isStaff && !shipment.locationSharingEnabled) {
    return { available: false, reason: "SHARING_DISABLED" };
  }

  if (!isActiveOnRoad(shipment.status as ShipmentStatus)) {
    return { available: false, reason: "NOT_ACTIVE" };
  }

  const pings = await db.locationPing.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { recordedAt: "desc" },
    // Khách không cần toàn bộ hành trình, chỉ cần đoạn gần đây (§17: không hiển thị lịch sử
    // vị trí cá nhân nhiều hơn mức cần thiết).
    take: isStaff ? 200 : 20,
    select: { latitude: true, longitude: true, recordedAt: true },
  });

  if (pings.length === 0) return { available: false, reason: "NO_DATA" };

  const points = pings.map((ping) => {
    const raw = { latitude: Number(ping.latitude), longitude: Number(ping.longitude) };
    const coords = isStaff ? raw : coarsen(raw.latitude, raw.longitude);
    return { ...coords, recordedAt: ping.recordedAt };
  });

  return { available: true, points, coarse: !isStaff };
}

// -----------------------------------------------------------------------------
// Bật/tắt chia sẻ và dọn dữ liệu
// -----------------------------------------------------------------------------

/**
 * Bật hoặc tắt chia sẻ vị trí cho khách của một chuyến (§17).
 *
 * Mặc định là TẮT. Chia sẻ vị trí một người đang làm việc phải là quyết định có chủ ý của
 * doanh nghiệp, không phải trạng thái mặc định.
 */
export async function setLocationSharing(
  actor: Actor,
  input: LocationSharingInput,
  context: Context
): Promise<void> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode: input.trackingCode },
    select: { id: true, locationSharingEnabled: true },
  });

  if (!shipment) throw appError("NOT_FOUND");

  if (!can(actor, "tracking.manage")) {
    throw appError("FORBIDDEN", "Bạn không có quyền thay đổi chia sẻ vị trí.");
  }

  await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipment.id },
      data: { locationSharingEnabled: input.enabled },
    });

    await recordAudit(
      actor,
      {
        action: input.enabled ? "location_sharing.enabled" : "location_sharing.disabled",
        resourceType: "Shipment",
        resourceId: shipment.id,
        before: { locationSharingEnabled: shipment.locationSharingEnabled },
        after: { locationSharingEnabled: input.enabled, reason: input.reason ?? null },
        context,
      },
      tx
    );
  });

  logger.info(
    { trackingCode: input.trackingCode, enabled: input.enabled },
    "Đã đổi cài đặt chia sẻ vị trí"
  );
}

/**
 * Xoá điểm vị trí quá hạn lưu trữ (§17, §31).
 *
 * Chạy được nhiều lần không sao. Chưa có bộ lập lịch nên hiện phải gọi thủ công hoặc qua
 * cron bên ngoài — ghi rõ trong tài liệu vận hành thay vì để người đọc tưởng nó tự chạy.
 */
export async function purgeExpiredLocations(now: Date = new Date()): Promise<number> {
  const retentionDays = serverEnv().LOCATION_RETENTION_DAYS;
  const cutoff = addDays(now, -retentionDays);

  const result = await db.locationPing.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    logger.info({ deleted: result.count, retentionDays }, "Đã dọn điểm vị trí quá hạn");
  }

  return result.count;
}
