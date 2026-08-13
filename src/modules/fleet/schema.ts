import { z } from "zod";
import { normalizePlateNumber, normalizePhone } from "@/lib/normalize";

/** Zod schema cho đội xe và tài xế (§14). */

/**
 * Biển số xe Việt Nam. Chấp nhận nhiều cách viết: "51C-123.45", "51c 12345", "51C12345".
 * Sau chuẩn hoá phải khớp: 2 chữ số tỉnh + 1–2 ký tự series + 4–5 chữ số.
 */
const plateNumber = z
  .string()
  .trim()
  .min(6, "Biển số quá ngắn")
  .max(15, "Biển số quá dài")
  .refine((value) => /^\d{2}[A-Z]{1,2}\d?\d{4,5}$/.test(normalizePlateNumber(value)), {
    message: "Biển số không hợp lệ. Ví dụ: 51C-123.45 hoặc 29A-12345",
  });

export const VEHICLE_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"] as const;

export const VEHICLE_STATUS_LABELS: Record<(typeof VEHICLE_STATUSES)[number], string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  MAINTENANCE: "Đang bảo trì",
  RETIRED: "Đã thanh lý",
};

export const vehicleSchema = z.object({
  plateNumber,
  vehicleTypeSlug: z.string().trim().min(1, "Vui lòng chọn loại xe"),
  status: z.enum(VEHICLE_STATUSES).default("ACTIVE"),

  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  manufactureYear: z
    .number()
    .int("Năm sản xuất phải là số nguyên")
    .min(1980, "Năm sản xuất không hợp lệ")
    .max(new Date().getFullYear() + 1, "Năm sản xuất không thể ở tương lai xa")
    .optional(),

  inspectionExpiresAt: z.string().date("Ngày không hợp lệ").optional(),
  insuranceExpiresAt: z.string().date("Ngày không hợp lệ").optional(),

  internalNote: z.string().trim().max(1000).optional(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const DRIVER_STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "INACTIVE"] as const;

export const DRIVER_STATUS_LABELS: Record<(typeof DRIVER_STATUSES)[number], string> = {
  ACTIVE: "Đang làm việc",
  ON_LEAVE: "Đang nghỉ phép",
  SUSPENDED: "Tạm đình chỉ",
  INACTIVE: "Đã nghỉ việc",
};

/** Hạng giấy phép lái xe theo quy định Việt Nam, phần liên quan tới xe tải. */
export const LICENSE_CLASSES = ["B2", "C", "D", "E", "FC"] as const;

export const driverSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2, "Mã nhân sự tối thiểu 2 ký tự")
    .max(30, "Mã nhân sự tối đa 30 ký tự"),
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên").max(120),
  workPhone: z
    .string()
    .trim()
    .refine((v) => normalizePhone(v) !== null, "Số điện thoại không hợp lệ"),

  licenseClass: z.enum(LICENSE_CLASSES).optional(),
  licenseNumber: z.string().trim().max(30).optional(),
  licenseExpiresAt: z.string().date("Ngày không hợp lệ").optional(),

  status: z.enum(DRIVER_STATUSES).default("ACTIVE"),

  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizePhone(v) !== null, "Số điện thoại không hợp lệ")
    .optional(),

  internalNote: z.string().trim().max(1000).optional(),
});

export type DriverInput = z.infer<typeof driverSchema>;

export const AVAILABILITY_KINDS = ["MAINTENANCE", "LEAVE", "RESERVED", "OTHER"] as const;

export const AVAILABILITY_KIND_LABELS: Record<(typeof AVAILABILITY_KINDS)[number], string> = {
  MAINTENANCE: "Bảo trì",
  LEAVE: "Nghỉ phép",
  RESERVED: "Giữ chỗ",
  OTHER: "Khác",
};

export const availabilityBlockSchema = z
  .object({
    vehicleId: z.string().trim().optional(),
    driverProfileId: z.string().trim().optional(),
    kind: z.enum(AVAILABILITY_KINDS).default("OTHER"),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((data) => data.vehicleId || data.driverProfileId, {
    message: "Phải chọn xe hoặc tài xế",
    path: ["vehicleId"],
  })
  .refine((data) => new Date(data.startsAt) < new Date(data.endsAt), {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu",
    path: ["endsAt"],
  });

export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>;

/** Phân công xe và tài xế cho một chuyến (§14.3). */
export const assignmentSchema = z
  .object({
    vehicleId: z.string().trim().min(1, "Vui lòng chọn xe"),
    primaryDriverId: z.string().trim().min(1, "Vui lòng chọn tài xế chính"),
    secondaryDriverId: z.string().trim().optional(),

    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveTo: z.string().datetime({ offset: true }),

    /** Bỏ qua cảnh báo trùng lịch. Bắt buộc kèm lý do (§14.3). */
    overrideConflict: z.boolean().default(false),
    overrideReason: z.string().trim().max(500).optional(),

    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => new Date(data.effectiveFrom) < new Date(data.effectiveTo), {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu",
    path: ["effectiveTo"],
  })
  .refine((data) => !data.overrideConflict || Boolean(data.overrideReason?.trim()), {
    message: "Bỏ qua cảnh báo trùng lịch bắt buộc nhập lý do",
    path: ["overrideReason"],
  })
  .refine((data) => data.primaryDriverId !== data.secondaryDriverId, {
    message: "Tài xế phụ phải khác tài xế chính",
    path: ["secondaryDriverId"],
  });

export type AssignmentInput = z.infer<typeof assignmentSchema>;

export const createShipmentSchema = z.object({
  /** Mã báo giá đã được khách chấp nhận. */
  quoteCode: z.string().trim().min(1, "Thiếu mã báo giá"),
  scheduledPickupAt: z.string().datetime({ offset: true }).optional(),
  estimatedDeliveryAt: z.string().datetime({ offset: true }).optional(),
  instructions: z.string().trim().max(2000).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const changeShipmentStatusSchema = z.object({
  toStatus: z.string().trim().min(1, "Vui lòng chọn trạng thái"),
  reason: z.string().trim().max(1000).optional(),
  reasonCode: z.string().trim().max(50).optional(),
});

export type ChangeShipmentStatusInput = z.infer<typeof changeShipmentStatusSchema>;
