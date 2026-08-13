import "server-only";
import { db, type Prisma } from "@/lib/db";

/**
 * Truy cập dữ liệu đơn hàng.
 *
 * Hàm dành cho khách hàng luôn lọc theo `userId` ngay trong truy vấn (§30.2).
 * Hàm dành cho tài xế lọc theo assignment — tài xế chỉ thấy chuyến của mình (§8).
 */

const LIST_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  scheduledPickupAt: true,
  estimatedDeliveryAt: true,
  createdAt: true,
  userId: true,
  vehicleType: { select: { name: true } },
  stops: {
    select: { kind: true, province: true, district: true },
    orderBy: { sequence: "asc" },
  },
  assignments: {
    where: { isActive: true },
    select: {
      id: true,
      vehicle: { select: { plateNumber: true } },
      primaryDriver: { select: { fullName: true } },
      effectiveFrom: true,
      effectiveTo: true,
    },
  },
} satisfies Prisma.ShipmentSelect;

/** Đơn chưa có tài xế — hàng chờ chính của dispatcher (§26.3). */
export async function listShipmentsAwaitingDispatch() {
  return db.shipment.findMany({
    where: { status: { in: ["CREATED", "CONFIRMED", "SCHEDULED"] } },
    select: LIST_SELECT,
    orderBy: [{ scheduledPickupAt: "asc" }, { createdAt: "asc" }],
    take: 50,
  });
}

/** Chuyến đang chạy hôm nay. */
export async function listActiveShipments() {
  return db.shipment.findMany({
    where: {
      status: {
        in: [
          "DRIVER_ASSIGNED",
          "EN_ROUTE_TO_PICKUP",
          "AT_PICKUP",
          "PICKUP_INSPECTION",
          "PACKING",
          "LOADING",
          "SECURED_ON_VEHICLE",
          "IN_TRANSIT",
          "AT_DELIVERY",
          "UNLOADING",
          "DELIVERED_PENDING_CONFIRMATION",
        ],
      },
    },
    select: LIST_SELECT,
    orderBy: { scheduledPickupAt: "asc" },
    take: 50,
  });
}

/** Chuyến cần chú ý: tạm dừng hoặc có sự cố (§26.3). */
export async function listAttentionShipments() {
  return db.shipment.findMany({
    where: { status: { in: ["ON_HOLD", "INCIDENT"] } },
    select: LIST_SELECT,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

/** Báo giá đã chấp nhận nhưng chưa tạo đơn — việc tiếp theo của dispatcher. */
export async function listQuotesReadyForShipment() {
  return db.quote.findMany({
    where: { status: "ACCEPTED", shipment: null },
    select: {
      id: true,
      code: true,
      acceptedAt: true,
      acceptedRevision: { select: { totalAmount: true } },
      serviceRequest: {
        select: {
          code: true,
          contactName: true,
          kind: true,
          stops: {
            select: { kind: true, province: true, district: true },
            orderBy: { sequence: "asc" },
          },
        },
      },
    },
    orderBy: { acceptedAt: "asc" },
    take: 50,
  });
}

const DETAIL_INCLUDE = {
  vehicleType: { select: { name: true, slug: true } },
  stops: { orderBy: { sequence: "asc" } },
  assignments: {
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, plateNumber: true } },
      primaryDriver: { select: { id: true, fullName: true, workPhoneNormalized: true } },
      secondaryDriver: { select: { id: true, fullName: true } },
    },
  },
  statusEvents: { orderBy: { occurredAt: "desc" } },
  serviceRequest: { select: { code: true, contactName: true, contactPhoneNormalized: true } },
  quote: { select: { code: true } },
  // Chỉ cần biết CÓ hay KHÔNG để quyết định cho phép hoàn tất đơn (§15 ràng buộc 2).
  // Bản đã bị thay thế không tính — xem `supersededAt` trong §18.
  proofOfDeliveries: { where: { supersededAt: null }, take: 1, select: { id: true } },
} satisfies Prisma.ShipmentInclude;

export async function findShipmentByTrackingCode(trackingCode: string) {
  return db.shipment.findUnique({ where: { trackingCode }, include: DETAIL_INCLUDE });
}

export async function findShipmentForUser(trackingCode: string, userId: string) {
  return db.shipment.findFirst({
    where: { trackingCode, userId },
    include: DETAIL_INCLUDE,
  });
}

export async function listShipmentsForUser(userId: string) {
  return db.shipment.findMany({
    where: { userId },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/**
 * Chuyến của một tài xế. Lọc theo assignment ngay trong truy vấn — tài xế không bao giờ
 * thấy chuyến của người khác, kể cả khi tầng trên quên kiểm tra (§8, §30.2).
 */
export async function listShipmentsForDriver(driverProfileId: string) {
  return db.shipment.findMany({
    where: {
      assignments: {
        some: {
          isActive: true,
          OR: [{ primaryDriverId: driverProfileId }, { secondaryDriverId: driverProfileId }],
        },
      },
    },
    select: LIST_SELECT,
    orderBy: { scheduledPickupAt: "asc" },
    take: 50,
  });
}

/**
 * Chi tiết chuyến dành riêng cho tài xế (§8, §26.2).
 *
 * Có select riêng chứ không dùng chung `DETAIL_INCLUDE`: tài xế không có quyền với báo giá
 * và dữ liệu tài chính, nên `quote`, `totalAmount`, `internalNote` không được nằm trong kết
 * quả. Chọn tường minh như thế này khiến trường mới thêm vào Shipment KHÔNG tự động lọt ra
 * màn hình tài xế — phải có người chủ động mở.
 */
export const DRIVER_SHIPMENT_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  userId: true,
  scheduledPickupAt: true,
  actualPickupAt: true,
  estimatedDeliveryAt: true,
  deliveredAt: true,
  instructions: true,
  vehicleType: { select: { name: true } },
  stops: {
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      kind: true,
      sequence: true,
      line: true,
      ward: true,
      district: true,
      province: true,
      contactName: true,
      contactPhone: true,
      floorNumber: true,
      hasElevator: true,
      carryDistanceM: true,
      accessNote: true,
    },
  },
  statusEvents: {
    orderBy: { occurredAt: "desc" },
    select: { id: true, fromStatus: true, toStatus: true, occurredAt: true, note: true },
  },
  assignments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      isActive: true,
      effectiveFrom: true,
      effectiveTo: true,
      primaryDriverId: true,
      secondaryDriverId: true,
      note: true,
      vehicle: { select: { plateNumber: true } },
      secondaryDriver: { select: { fullName: true } },
    },
  },
} satisfies Prisma.ShipmentSelect;

export async function findShipmentForDriver(trackingCode: string) {
  return db.shipment.findUnique({
    where: { trackingCode },
    select: DRIVER_SHIPMENT_SELECT,
  });
}

export async function countShipmentsByStatus() {
  const rows = await db.shipment.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
