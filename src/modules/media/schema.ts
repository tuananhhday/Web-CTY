import { z } from "zod";
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES, kindOfMimeType } from "@/modules/media/file-types";

/** Zod schema cho media theo giai đoạn (§16.2, §16.3). */

export const MEDIA_STAGES = [
  "BEFORE_PICKUP",
  "PICKUP_INSPECTION",
  "PACKING",
  "LOADING",
  "SECURING",
  "IN_TRANSIT",
  "UNLOADING",
  "DELIVERY",
  "DAMAGE_EVIDENCE",
  "PROOF_OF_DELIVERY",
] as const;

export type MediaStage = (typeof MEDIA_STAGES)[number];

export const MEDIA_STAGE_LABELS: Record<MediaStage, string> = {
  BEFORE_PICKUP: "Trước khi lấy hàng",
  PICKUP_INSPECTION: "Kiểm tra hàng",
  PACKING: "Đóng gói",
  LOADING: "Xếp hàng lên xe",
  SECURING: "Chằng buộc",
  IN_TRANSIT: "Trên đường",
  UNLOADING: "Dỡ hàng",
  DELIVERY: "Giao hàng",
  DAMAGE_EVIDENCE: "Bằng chứng hư hỏng",
  PROOF_OF_DELIVERY: "Biên bản giao hàng",
};

/**
 * Giai đoạn media gợi ý theo trạng thái chuyến hiện tại.
 *
 * Tài xế đang dỡ hàng thì mặc định nên chụp cho giai đoạn `UNLOADING`. Vẫn cho phép đổi:
 * bằng chứng hư hỏng có thể phát hiện ở bất kỳ lúc nào.
 */
export function suggestedStageFor(shipmentStatus: string): MediaStage {
  const MAP: Record<string, MediaStage> = {
    CREATED: "BEFORE_PICKUP",
    CONFIRMED: "BEFORE_PICKUP",
    SCHEDULED: "BEFORE_PICKUP",
    DRIVER_ASSIGNED: "BEFORE_PICKUP",
    EN_ROUTE_TO_PICKUP: "BEFORE_PICKUP",
    AT_PICKUP: "PICKUP_INSPECTION",
    PICKUP_INSPECTION: "PICKUP_INSPECTION",
    PACKING: "PACKING",
    LOADING: "LOADING",
    SECURED_ON_VEHICLE: "SECURING",
    IN_TRANSIT: "IN_TRANSIT",
    AT_DELIVERY: "DELIVERY",
    UNLOADING: "UNLOADING",
    DELIVERED_PENDING_CONFIRMATION: "PROOF_OF_DELIVERY",
    INCIDENT: "DAMAGE_EVIDENCE",
  };

  return MAP[shipmentStatus] ?? "IN_TRANSIT";
}

export const MEDIA_VISIBILITIES = ["INTERNAL", "CUSTOMER"] as const;

export const MEDIA_VISIBILITY_LABELS: Record<(typeof MEDIA_VISIBILITIES)[number], string> = {
  INTERNAL: "Chỉ nội bộ",
  CUSTOMER: "Khách hàng xem được",
};

/**
 * Bước 1 của luồng upload: xin quyền tải lên (§16.3).
 *
 * Client khai báo TRƯỚC những gì nó định gửi. Server dùng thông tin này để từ chối sớm —
 * không có lý do gì để một file 300MB đi hết đường truyền rồi mới bị loại. Nhưng khai báo
 * chỉ là khai báo: bước confirm kiểm tra lại bằng nội dung thật.
 */
export const uploadIntentSchema = z
  .object({
    trackingCode: z.string().trim().min(1, "Thiếu mã chuyến"),
    stage: z.enum(MEDIA_STAGES, { message: "Giai đoạn không hợp lệ" }),

    mimeType: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]], {
      message: "Định dạng tệp không được hỗ trợ",
    }),

    sizeBytes: z
      .number()
      .int("Dung lượng phải là số nguyên")
      .positive("Dung lượng phải lớn hơn 0"),

    caption: z.string().trim().max(300, "Chú thích tối đa 300 ký tự").optional(),
    visibility: z.enum(MEDIA_VISIBILITIES).default("INTERNAL"),

    /** Thời điểm chụp lấy từ metadata ảnh, nếu client đọc được. */
    capturedAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (data) => {
      const kind = kindOfMimeType(data.mimeType);
      return kind !== null && data.sizeBytes <= MAX_SIZE_BYTES[kind];
    },
    {
      message: "Tệp vượt quá dung lượng cho phép",
      path: ["sizeBytes"],
    }
  );

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

/** Bước 5: client báo đã tải xong, server bắt đầu xác minh. */
export const confirmUploadSchema = z.object({
  mediaId: z.string().trim().min(1, "Thiếu mã tệp"),
  /** SHA-256 client tính được, để đối chiếu. Không bắt buộc vì tính hash tốn pin. */
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "Checksum không đúng định dạng SHA-256")
    .optional(),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const updateMediaSchema = z.object({
  mediaId: z.string().trim().min(1),
  caption: z.string().trim().max(300).optional(),
  visibility: z.enum(MEDIA_VISIBILITIES).optional(),
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

/** Số tệp tối đa cho một giai đoạn của một chuyến (§16.3 bước 2). */
export const MAX_MEDIA_PER_STAGE = 20;
