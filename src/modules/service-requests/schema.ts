import { z } from "zod";
import { normalizePhone } from "@/lib/normalize";

/**
 * Zod schema cho yêu cầu dịch vụ (§11, §12).
 *
 * Dùng CHUNG cho client và server: client validate để phản hồi nhanh, server validate lại
 * vì không bao giờ tin dữ liệu từ trình duyệt (§30.1).
 *
 * Thông báo lỗi viết bằng tiếng Việt, nói rõ cần sửa gì chứ không chỉ báo "không hợp lệ".
 */

// -----------------------------------------------------------------------------
// Trường dùng lại
// -----------------------------------------------------------------------------

const vietnamesePhone = z
  .string()
  .min(1, "Vui lòng nhập số điện thoại")
  .refine((value) => normalizePhone(value) !== null, {
    message: "Số điện thoại không hợp lệ. Ví dụ: 0912 345 678",
  });

const optionalEmail = z
  .string()
  .trim()
  .email("Email không hợp lệ")
  .optional()
  .or(z.literal("").transform(() => undefined));

const contactName = z
  .string()
  .trim()
  .min(2, "Họ tên tối thiểu 2 ký tự")
  .max(120, "Họ tên tối đa 120 ký tự");

const addressLine = z
  .string()
  .trim()
  .min(5, "Địa chỉ quá ngắn, vui lòng ghi rõ số nhà và tên đường")
  .max(300, "Địa chỉ tối đa 300 ký tự");

const province = z.string().trim().min(1, "Vui lòng chọn tỉnh/thành phố");

/** Toạ độ tuỳ chọn, chỉ có khi người dùng chọn điểm trên bản đồ (§17). */
const latitude = z
  .number()
  .min(-90, "Vĩ độ không hợp lệ")
  .max(90, "Vĩ độ không hợp lệ")
  .optional();

const longitude = z
  .number()
  .min(-180, "Kinh độ không hợp lệ")
  .max(180, "Kinh độ không hợp lệ")
  .optional();

/**
 * Điều kiện tiếp cận tại một điểm. Ảnh hưởng trực tiếp tới chi phí bốc xếp nên
 * validate chặt: tầng âm là tầng hầm (hợp lệ), nhưng không cho phép giá trị vô lý.
 */
const accessConditions = {
  floorNumber: z
    .number()
    .int("Số tầng phải là số nguyên")
    .min(-5, "Số tầng không hợp lệ")
    .max(100, "Số tầng không hợp lệ")
    .optional(),
  hasElevator: z.boolean().optional(),
  carryDistanceM: z
    .number()
    .int("Khoảng cách phải là số nguyên")
    .min(0, "Khoảng cách không được âm")
    .max(1000, "Khoảng cách quá lớn, vui lòng liên hệ để khảo sát riêng")
    .optional(),
  accessNote: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
};

const stopSchema = z.object({
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizePhone(v) !== null, "Số điện thoại không hợp lệ")
    .optional(),
  line: addressLine,
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  province,
  latitude,
  longitude,
  ...accessConditions,
});

export type StopInput = z.infer<typeof stopSchema>;

// -----------------------------------------------------------------------------
// Hàng hóa
// -----------------------------------------------------------------------------

const cargoItemSchema = z.object({
  cargoType: z
    .string()
    .trim()
    .min(2, "Vui lòng mô tả loại hàng")
    .max(200, "Mô tả tối đa 200 ký tự"),
  quantity: z
    .number()
    .int("Số kiện phải là số nguyên")
    .min(1, "Số kiện tối thiểu là 1")
    .max(100_000, "Số kiện quá lớn, vui lòng liên hệ để khảo sát riêng"),
  weightKg: z
    .number()
    .min(0, "Khối lượng không được âm")
    .max(100_000, "Khối lượng vượt mức xử lý tự động, vui lòng liên hệ trực tiếp"),
  lengthCm: z.number().int().min(0).max(30_000).optional(),
  widthCm: z.number().int().min(0).max(10_000).optional(),
  heightCm: z.number().int().min(0).max(10_000).optional(),
  isFragile: z.boolean().default(false),
  isValuable: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

export type CargoItemInput = z.infer<typeof cargoItemSchema>;

// -----------------------------------------------------------------------------
// Yêu cầu vận chuyển hàng hóa (§11)
// -----------------------------------------------------------------------------

export const freightRequestSchema = z
  .object({
    serviceSlug: z.string().trim().min(1, "Vui lòng chọn loại dịch vụ"),

    contactName,
    contactPhone: vietnamesePhone,
    contactEmail: optionalEmail,
    companyName: z.string().trim().max(200).optional(),

    pickup: stopSchema,
    dropoff: stopSchema,

    preferredPickupAt: z.string().datetime({ offset: true }).optional(),
    preferredDeliveryAt: z.string().datetime({ offset: true }).optional(),

    requestedVehicleTypeSlug: z.string().trim().optional(),

    items: z
      .array(cargoItemSchema)
      .min(1, "Vui lòng khai báo ít nhất một loại hàng")
      .max(50, "Tối đa 50 dòng hàng trong một yêu cầu"),

    needsLoading: z.boolean().default(false),
    needsPacking: z.boolean().default(false),
    needsAssembly: z.boolean().default(false),
    needsHoisting: z.boolean().default(false),

    declaredValue: z
      .number()
      .min(0, "Giá trị khai báo không được âm")
      .max(100_000_000_000, "Giá trị khai báo quá lớn")
      .optional(),

    note: z.string().trim().max(2000, "Ghi chú tối đa 2000 ký tự").optional(),

    /** Bắt buộc đồng ý chính sách dữ liệu trước khi gửi (§11, §31). */
    acceptPolicy: z.literal(true, {
      message: "Bạn cần đồng ý với chính sách xử lý dữ liệu để tiếp tục",
    }),

    /**
     * Bẫy bot (§23). Schema CHẤP NHẬN mọi giá trị — nếu Zod từ chối ở đây, phản hồi lỗi
     * sẽ tiết lộ rằng trường này bị kiểm tra và bot chỉ cần bỏ trống là qua được.
     * Route handler kiểm tra riêng và trả về như thành công mà không tạo bản ghi.
     */
    website: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.preferredPickupAt ||
      !data.preferredDeliveryAt ||
      new Date(data.preferredPickupAt) <= new Date(data.preferredDeliveryAt),
    { message: "Thời gian giao phải sau thời gian lấy hàng", path: ["preferredDeliveryAt"] }
  );

export type FreightRequestInput = z.infer<typeof freightRequestSchema>;

// -----------------------------------------------------------------------------
// Yêu cầu chuyển nhà / chuyển văn phòng (§12)
// -----------------------------------------------------------------------------

export const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "ROOM", "OFFICE"] as const;

export const PROPERTY_TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  HOUSE: "Nhà riêng",
  APARTMENT: "Căn hộ chung cư",
  ROOM: "Phòng trọ",
  OFFICE: "Văn phòng",
};

export const INVENTORY_CATEGORIES = [
  "FURNITURE",
  "APPLIANCE",
  "ELECTRONICS",
  "BOX",
  "FRAGILE",
  "OTHER",
] as const;

export const INVENTORY_CATEGORY_LABELS: Record<(typeof INVENTORY_CATEGORIES)[number], string> = {
  FURNITURE: "Nội thất",
  APPLIANCE: "Thiết bị gia dụng",
  ELECTRONICS: "Thiết bị điện tử",
  BOX: "Thùng carton",
  FRAGILE: "Đồ dễ vỡ",
  OTHER: "Khác",
};

/**
 * Một món đồ trong danh sách chuyển nhà.
 * §12 yêu cầu inventory CÓ CẤU TRÚC — không nhét tất cả vào một ô text.
 */
const inventoryItemSchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES, { message: "Vui lòng chọn nhóm đồ đạc" }),
  name: z.string().trim().min(1, "Vui lòng nhập tên đồ đạc").max(200),
  quantity: z
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng tối thiểu là 1")
    .max(10_000, "Số lượng quá lớn"),
  estimatedWeightKg: z.number().min(0, "Khối lượng không được âm").max(10_000).optional(),
  isFragile: z.boolean().default(false),
  isHighValue: z.boolean().default(false),
  needsDisassembly: z.boolean().default(false),
  note: z.string().trim().max(300).optional(),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const movingRequestSchema = z.object({
  contactName,
  contactPhone: vietnamesePhone,
  contactEmail: optionalEmail,
  companyName: z.string().trim().max(200).optional(),

  propertyType: z.enum(PROPERTY_TYPES, { message: "Vui lòng chọn loại hình" }),

  origin: stopSchema,
  destination: stopSchema,

  preferredDate: z.string().date("Ngày không hợp lệ").optional(),
  preferredTimeSlot: z.string().trim().max(60).optional(),

  inventoryItems: z
    .array(inventoryItemSchema)
    .max(200, "Tối đa 200 dòng đồ đạc. Nếu nhiều hơn, vui lòng yêu cầu khảo sát trực tiếp."),

  needsCartons: z.boolean().default(false),
  cartonQuantity: z.number().int().min(0).max(1000).optional(),
  needsPacking: z.boolean().default(false),
  needsDisassembly: z.boolean().default(false),
  needsCleaning: z.boolean().default(false),

  requestsSiteSurvey: z.boolean().default(false),

  note: z.string().trim().max(2000, "Ghi chú tối đa 2000 ký tự").optional(),

  acceptPolicy: z.literal(true, {
    message: "Bạn cần đồng ý với chính sách xử lý dữ liệu để tiếp tục",
  }),

  /** Bẫy bot — xem ghi chú ở freightRequestSchema. */
  website: z.string().optional(),
}).refine(
  // Không có món đồ nào VÀ không yêu cầu khảo sát thì nhân viên không có gì để làm việc.
  (data) => data.inventoryItems.length > 0 || data.requestsSiteSurvey,
  {
    message:
      "Vui lòng liệt kê ít nhất một món đồ, hoặc chọn yêu cầu khảo sát trực tiếp để chúng tôi tới xem.",
    path: ["inventoryItems"],
  }
);

export type MovingRequestInput = z.infer<typeof movingRequestSchema>;

// -----------------------------------------------------------------------------
// Đổi trạng thái (dùng ở API quản trị)
// -----------------------------------------------------------------------------

export const changeStatusSchema = z.object({
  toStatus: z.enum([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "NEED_MORE_INFO",
    "QUOTED",
    "NEGOTIATING",
    "ACCEPTED",
    "CONVERTED_TO_SHIPMENT",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
  ]),
  reason: z.string().trim().max(1000).optional(),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// -----------------------------------------------------------------------------
// Bộ lọc danh sách (allowlist, chống injection qua query — §25)
// -----------------------------------------------------------------------------

export const listRequestsQuerySchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEED_MORE_INFO", "QUOTED", "NEGOTIATING", "ACCEPTED", "CONVERTED_TO_SHIPMENT", "REJECTED", "EXPIRED", "CANCELLED"]).optional(),
  kind: z.enum(["FREIGHT", "MOVING"]).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  // Giới hạn cứng để một request không kéo cả bảng (§25).
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
