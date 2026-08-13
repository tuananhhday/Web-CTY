import "server-only";
import { db } from "@/lib/db";
import { addDays } from "@/lib/datetime";

/**
 * Truy cập dữ liệu đội xe (§14).
 *
 * Toàn bộ dữ liệu ở đây là nội bộ — không có hàm nào dành cho khách hàng. Quyền được
 * kiểm tra ở tầng service.
 */

/** Ngưỡng cảnh báo giấy tờ sắp hết hạn (§32.3). */
const EXPIRY_WARNING_DAYS = 30;

export async function listVehicles(options: { includeRetired?: boolean } = {}) {
  return db.vehicle.findMany({
    where: {
      deletedAt: null,
      ...(options.includeRetired ? {} : { status: { not: "RETIRED" } }),
    },
    include: {
      vehicleType: { select: { name: true, slug: true, category: true } },
      _count: { select: { assignments: true, maintenances: true } },
    },
    orderBy: [{ status: "asc" }, { plateNumberNormalized: "asc" }],
  });
}

export async function findVehicleById(id: string) {
  return db.vehicle.findFirst({
    where: { id, deletedAt: null },
    include: {
      vehicleType: true,
      documents: { orderBy: { expiresAt: "asc" } },
      maintenances: { orderBy: { scheduledAt: "desc" }, take: 10 },
      availabilityBlocks: {
        where: { endsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
      },
    },
  });
}

export async function findVehicleByPlate(plateNumberNormalized: string) {
  return db.vehicle.findUnique({
    where: { plateNumberNormalized },
    select: { id: true, plateNumber: true },
  });
}

/** Xe sẵn sàng nhận chuyến. Lịch bận kiểm tra riêng khi phân công. */
export async function listAvailableVehicles() {
  return db.vehicle.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    include: { vehicleType: { select: { name: true, slug: true } } },
    orderBy: { plateNumberNormalized: "asc" },
  });
}

/** Loại xe dùng cho ô chọn khi thêm/sửa xe. Lấy cả bản nháp vì đây là dữ liệu nội bộ. */
export async function listVehicleTypesForSelect() {
  return db.vehicleType.findMany({
    select: { slug: true, name: true, category: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listDrivers(options: { includeInactive?: boolean } = {}) {
  return db.driverProfile.findMany({
    where: {
      deletedAt: null,
      ...(options.includeInactive ? {} : { status: { not: "INACTIVE" } }),
    },
    include: {
      user: { select: { email: true, status: true } },
      _count: { select: { primaryAssignments: true } },
    },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
  });
}

export async function findDriverById(id: string) {
  return db.driverProfile.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { email: true, status: true } },
      documents: { orderBy: { expiresAt: "asc" } },
      availabilityBlocks: {
        where: { endsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
      },
    },
  });
}

export async function listAvailableDrivers() {
  return db.driverProfile.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, fullName: true, employeeCode: true, licenseClass: true },
    orderBy: { fullName: "asc" },
  });
}

/**
 * Giấy tờ sắp hết hạn hoặc đã hết hạn (§32.3).
 * Gộp cả xe và tài xế để dispatcher thấy trong một danh sách.
 */
export async function listExpiringDocuments(withinDays = EXPIRY_WARNING_DAYS) {
  const threshold = addDays(new Date(), withinDays);

  const [vehicles, drivers] = await Promise.all([
    db.vehicle.findMany({
      where: {
        deletedAt: null,
        status: { not: "RETIRED" },
        OR: [
          { inspectionExpiresAt: { lte: threshold } },
          { insuranceExpiresAt: { lte: threshold } },
        ],
      },
      select: {
        id: true,
        plateNumber: true,
        inspectionExpiresAt: true,
        insuranceExpiresAt: true,
      },
    }),
    db.driverProfile.findMany({
      where: {
        deletedAt: null,
        status: { not: "INACTIVE" },
        licenseExpiresAt: { lte: threshold },
      },
      select: { id: true, fullName: true, employeeCode: true, licenseExpiresAt: true },
    }),
  ]);

  return { vehicles, drivers };
}

// -----------------------------------------------------------------------------
// Dữ liệu cho kiểm tra xung đột lịch (§14.3)
// -----------------------------------------------------------------------------

/**
 * Nạp phân công hiện có của những xe và tài xế liên quan, trong khoảng thời gian quan tâm.
 *
 * Chỉ lấy bản ghi CÓ THỂ giao nhau thay vì kéo cả bảng: điều kiện `effectiveFrom < to`
 * và `effectiveTo > from` chính là định nghĩa của "hai khoảng giao nhau".
 */
export async function listAssignmentsInWindow(input: {
  from: Date;
  to: Date;
  vehicleId?: string | null;
  driverIds: string[];
}) {
  const targets = [
    ...(input.vehicleId ? [{ vehicleId: input.vehicleId }] : []),
    ...(input.driverIds.length > 0
      ? [
          { primaryDriverId: { in: input.driverIds } },
          { secondaryDriverId: { in: input.driverIds } },
        ]
      : []),
  ];

  if (targets.length === 0) return [];

  return db.shipmentAssignment.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lt: input.to },
      effectiveTo: { gt: input.from },
      OR: targets,
    },
    select: {
      id: true,
      shipmentId: true,
      vehicleId: true,
      primaryDriverId: true,
      secondaryDriverId: true,
      isActive: true,
      overrideConflict: true,
      effectiveFrom: true,
      effectiveTo: true,
      shipment: { select: { trackingCode: true } },
    },
  });
}

export async function listBlocksInWindow(input: {
  from: Date;
  to: Date;
  vehicleId?: string | null;
  driverIds: string[];
}) {
  const targets = [
    ...(input.vehicleId ? [{ vehicleId: input.vehicleId }] : []),
    ...(input.driverIds.length > 0 ? [{ driverProfileId: { in: input.driverIds } }] : []),
  ];

  if (targets.length === 0) return [];

  return db.availabilityBlock.findMany({
    where: {
      startsAt: { lt: input.to },
      endsAt: { gt: input.from },
      OR: targets,
    },
    select: {
      id: true,
      kind: true,
      reason: true,
      vehicleId: true,
      driverProfileId: true,
      startsAt: true,
      endsAt: true,
    },
  });
}
