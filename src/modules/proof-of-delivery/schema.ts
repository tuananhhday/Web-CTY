import { z } from "zod";
import { normalizePhone } from "@/lib/normalize";

/** Zod schema cho bằng chứng lấy hàng và giao hàng (§18). */

export const DELIVERY_OUTCOMES = ["DELIVERED_FULL", "DELIVERED_PARTIAL", "REFUSED"] as const;

export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];

export const DELIVERY_OUTCOME_LABELS: Record<DeliveryOutcome, string> = {
  DELIVERED_FULL: "Giao đủ hàng",
  DELIVERED_PARTIAL: "Giao một phần",
  REFUSED: "Người nhận từ chối",
};

/** Trường hợp bất thường bắt buộc giải thích — giao thiếu và bị từ chối đều phải có lý do. */
const OUTCOMES_NEEDING_REASON: DeliveryOutcome[] = ["DELIVERED_PARTIAL", "REFUSED"];

export function outcomeNeedsReason(outcome: string): boolean {
  return OUTCOMES_NEEDING_REASON.includes(outcome as DeliveryOutcome);
}

const receiverName = z
  .string()
  .trim()
  .min(2, "Vui lòng nhập tên người nhận")
  .max(120, "Tên người nhận tối đa 120 ký tự");

/** Bằng chứng lấy hàng — tuỳ chọn theo loại chuyến (§18). */
export const proofOfPickupSchema = z.object({
  trackingCode: z.string().trim().min(1),
  senderName: z.string().trim().min(2, "Vui lòng nhập tên người giao").max(120),
  senderRelation: z.string().trim().max(80).optional(),
  packageCount: z
    .number()
    .int("Số kiện phải là số nguyên")
    .min(0, "Số kiện không được âm")
    .max(100_000)
    .optional(),
  condition: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type ProofOfPickupInput = z.infer<typeof proofOfPickupSchema>;

/** Yêu cầu gửi OTP tới người nhận. */
export const requestOtpSchema = z.object({
  trackingCode: z.string().trim().min(1),
  /**
   * Số nhận OTP. Bỏ trống thì hệ thống dùng số liên hệ của điểm giao — tránh việc tài xế
   * tự nhập số của chính mình để bỏ qua bước xác nhận của người nhận.
   */
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || normalizePhone(value) !== null, "Số điện thoại không hợp lệ")
    .optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

/** Lập biên bản giao hàng (§18). */
export const proofOfDeliverySchema = z
  .object({
    trackingCode: z.string().trim().min(1),

    receiverName,
    receiverRelation: z.string().trim().max(80).optional(),

    outcome: z.enum(DELIVERY_OUTCOMES, { message: "Vui lòng chọn kết quả giao hàng" }),
    exceptionReason: z.string().trim().max(1000).optional(),

    condition: z.string().trim().max(500).optional(),
    note: z.string().trim().max(1000).optional(),

    /** Mã người nhận đọc cho tài xế. Bắt buộc trừ khi người nhận từ chối nhận hàng. */
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Mã xác nhận gồm 6 chữ số")
      .optional(),

    /** Toạ độ lúc lập biên bản. Chỉ là dữ liệu bổ trợ, KHÔNG phải bằng chứng duy nhất (§18). */
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine((data) => !outcomeNeedsReason(data.outcome) || Boolean(data.exceptionReason?.trim()), {
    message: "Giao thiếu hoặc bị từ chối bắt buộc ghi rõ lý do",
    path: ["exceptionReason"],
  })
  .refine((data) => data.outcome === "REFUSED" || Boolean(data.otp), {
    // Người nhận từ chối thì không có ai đọc mã cho tài xế — đòi OTP là bế tắc.
    message: "Vui lòng nhập mã xác nhận người nhận đọc cho bạn",
    path: ["otp"],
  });

export type ProofOfDeliveryInput = z.infer<typeof proofOfDeliverySchema>;

/** Sửa biên bản đã chốt — phải qua quy trình correction, có lý do và audit (§18). */
export const correctProofSchema = z.object({
  trackingCode: z.string().trim().min(1),
  correctionReason: z
    .string()
    .trim()
    .min(10, "Lý do sửa phải nêu rõ, tối thiểu 10 ký tự")
    .max(1000),
  receiverName,
  receiverRelation: z.string().trim().max(80).optional(),
  outcome: z.enum(DELIVERY_OUTCOMES),
  exceptionReason: z.string().trim().max(1000).optional(),
  condition: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type CorrectProofInput = z.infer<typeof correctProofSchema>;
