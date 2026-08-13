import "server-only";
import { db } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { normalizePlateNumber, normalizePhone } from "@/lib/normalize";
import type { Actor } from "@/modules/auth/actor";
import { requirePermission } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import type { VehicleInput, DriverInput } from "@/modules/fleet/schema";

/**
 * Nghiệp vụ đội xe: thêm và sửa xe, tài xế (§14.1, §14.2).
 *
 * Không có hàm xoá cứng. Xe thanh lý chuyển sang trạng thái `RETIRED`, tài xế nghỉ việc
 * chuyển sang `INACTIVE` — lịch sử phân công phải đọc được về sau, xoá đi là mất vết (§14).
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

/** Ngày ISO từ form (`yyyy-mm-dd`) sang Date, hoặc null nếu bỏ trống. */
function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

// -----------------------------------------------------------------------------
// Xe
// -----------------------------------------------------------------------------

async function resolveVehicleType(slug: string): Promise<string> {
  const vehicleType = await db.vehicleType.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!vehicleType) throw appError("VALIDATION_ERROR", "Loại xe không tồn tại.");
  return vehicleType.id;
}

export async function createVehicle(
  actor: Actor,
  input: VehicleInput,
  context: Context
): Promise<{ id: string }> {
  requirePermission(actor, "fleet.manage");

  const plateNumberNormalized = normalizePlateNumber(input.plateNumber);
  const vehicleTypeId = await resolveVehicleType(input.vehicleTypeSlug);

  // Kiểm tra trước để báo lỗi dễ hiểu; unique index vẫn là lớp chặn cuối.
  const duplicate = await db.vehicle.findUnique({
    where: { plateNumberNormalized },
    select: { id: true, deletedAt: true },
  });
  if (duplicate) {
    throw appError("CONFLICT", `Biển số ${input.plateNumber} đã có trong hệ thống.`);
  }

  const vehicle = await db.$transaction(async (tx) => {
    const created = await tx.vehicle.create({
      data: {
        plateNumber: input.plateNumber.trim(),
        plateNumberNormalized,
        vehicleTypeId,
        status: input.status,
        brand: input.brand || null,
        model: input.model || null,
        manufactureYear: input.manufactureYear ?? null,
        inspectionExpiresAt: toDate(input.inspectionExpiresAt),
        insuranceExpiresAt: toDate(input.insuranceExpiresAt),
        internalNote: input.internalNote || null,
      },
      select: { id: true, plateNumber: true },
    });

    await recordAudit(
      actor,
      {
        action: "vehicle.created",
        resourceType: "Vehicle",
        resourceId: created.id,
        after: { plateNumber: created.plateNumber, status: input.status },
        context,
      },
      tx
    );

    return created;
  });

  logger.info({ vehicleId: vehicle.id, plateNumber: vehicle.plateNumber }, "Đã thêm xe");

  return { id: vehicle.id };
}

export async function updateVehicle(
  actor: Actor,
  id: string,
  input: VehicleInput,
  context: Context
): Promise<void> {
  requirePermission(actor, "fleet.manage");

  const existing = await db.vehicle.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      plateNumber: true,
      plateNumberNormalized: true,
      status: true,
      vehicleTypeId: true,
    },
  });
  if (!existing) throw appError("NOT_FOUND");

  const plateNumberNormalized = normalizePlateNumber(input.plateNumber);
  const vehicleTypeId = await resolveVehicleType(input.vehicleTypeSlug);

  if (plateNumberNormalized !== existing.plateNumberNormalized) {
    const duplicate = await db.vehicle.findUnique({
      where: { plateNumberNormalized },
      select: { id: true },
    });
    if (duplicate) {
      throw appError("CONFLICT", `Biển số ${input.plateNumber} đã thuộc về xe khác.`);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.vehicle.update({
      where: { id },
      data: {
        plateNumber: input.plateNumber.trim(),
        plateNumberNormalized,
        vehicleTypeId,
        status: input.status,
        brand: input.brand || null,
        model: input.model || null,
        manufactureYear: input.manufactureYear ?? null,
        inspectionExpiresAt: toDate(input.inspectionExpiresAt),
        insuranceExpiresAt: toDate(input.insuranceExpiresAt),
        internalNote: input.internalNote || null,
      },
    });

    await recordAudit(
      actor,
      {
        action: "vehicle.updated",
        resourceType: "Vehicle",
        resourceId: id,
        before: { plateNumber: existing.plateNumber, status: existing.status },
        after: { plateNumber: input.plateNumber, status: input.status },
        context,
      },
      tx
    );
  });

  logger.info({ vehicleId: id }, "Đã cập nhật xe");
}

// -----------------------------------------------------------------------------
// Tài xế
// -----------------------------------------------------------------------------

/**
 * Cập nhật hồ sơ tài xế.
 *
 * Chỉ SỬA, không tạo mới: `DriverProfile` bắt buộc gắn với một `User`, mà tạo tài khoản
 * đăng nhập là việc của module quản lý người dùng (§3.4) — chưa có trong pha này. Tài
 * khoản tài xế hiện được tạo qua seed hoặc thao tác trực tiếp trên database.
 */
export async function updateDriver(
  actor: Actor,
  id: string,
  input: DriverInput,
  context: Context
): Promise<void> {
  requirePermission(actor, "fleet.manage");

  const existing = await db.driverProfile.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      workPhoneNormalized: true,
      status: true,
    },
  });
  if (!existing) throw appError("NOT_FOUND");

  const workPhoneNormalized = normalizePhone(input.workPhone);
  if (!workPhoneNormalized) {
    throw appError("VALIDATION_ERROR", "Số điện thoại không hợp lệ.", {
      fields: [{ path: "workPhone", message: "Số điện thoại không hợp lệ" }],
    });
  }

  if (workPhoneNormalized !== existing.workPhoneNormalized) {
    const duplicate = await db.driverProfile.findUnique({
      where: { workPhoneNormalized },
      select: { id: true },
    });
    if (duplicate) {
      throw appError("CONFLICT", "Số điện thoại này đã thuộc về tài xế khác.");
    }
  }

  if (input.employeeCode !== existing.employeeCode) {
    const duplicate = await db.driverProfile.findUnique({
      where: { employeeCode: input.employeeCode },
      select: { id: true },
    });
    if (duplicate) {
      throw appError("CONFLICT", "Mã nhân sự này đã được dùng.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.driverProfile.update({
      where: { id },
      data: {
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        workPhone: input.workPhone.trim(),
        workPhoneNormalized,
        licenseClass: input.licenseClass ?? null,
        licenseNumber: input.licenseNumber || null,
        licenseExpiresAt: toDate(input.licenseExpiresAt),
        status: input.status,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone
          ? (normalizePhone(input.emergencyContactPhone) ?? input.emergencyContactPhone)
          : null,
        internalNote: input.internalNote || null,
      },
    });

    // Số điện thoại và người liên hệ khẩn cấp là dữ liệu cá nhân — `recordAudit` tự che
    // các trường nhạy cảm, nên chỉ ghi lại thứ cần để truy vết (§30.5).
    await recordAudit(
      actor,
      {
        action: "driver.updated",
        resourceType: "DriverProfile",
        resourceId: id,
        before: { employeeCode: existing.employeeCode, status: existing.status },
        after: { employeeCode: input.employeeCode, status: input.status },
        context,
      },
      tx
    );
  });

  logger.info({ driverId: id }, "Đã cập nhật hồ sơ tài xế");
}
