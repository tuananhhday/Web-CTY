import { z } from "zod";

/**
 * Zod schema cho báo giá (§13.3).
 *
 * Tiền nhận dưới dạng CHUỖI số nguyên đồng, không phải number. Số nguyên lớn hơn
 * 2^53 mất chính xác khi qua JSON; chuỗi thì không. Server chuyển sang Decimal để tính.
 */

/** Số tiền VND: chuỗi chỉ gồm chữ số, không âm, không phần thập phân. */
const moneyString = z
  .string()
  .regex(/^\d+$/, "Số tiền phải là số nguyên dương, không có dấu phẩy hay chữ")
  .refine((v) => v.length <= 15, "Số tiền vượt mức xử lý");

/**
 * Số tiền không bắt buộc.
 *
 * Ô nhập để trống trả về chuỗi rỗng chứ không phải `undefined`, nên `moneyString.optional()`
 * đơn thuần sẽ bắt lỗi chính cái trường mà người dùng được phép bỏ qua. Quy chuỗi rỗng về
 * `undefined` trước khi kiểm tra.
 */
const optionalMoneyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  moneyString.optional()
);

/** Số không bắt buộc: ô `type="number"` để trống cũng trả về chuỗi rỗng. */
function optionalNumber(schema: z.ZodType<number>) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional()
  );
}

export const QUOTE_LINE_CATEGORIES = [
  "TRANSPORT",
  "LABOR",
  "PACKING",
  "SURCHARGE",
  "OTHER",
] as const;

export const QUOTE_LINE_CATEGORY_LABELS: Record<
  (typeof QUOTE_LINE_CATEGORIES)[number],
  string
> = {
  TRANSPORT: "Cước vận chuyển",
  LABOR: "Nhân công bốc xếp",
  PACKING: "Đóng gói",
  SURCHARGE: "Phụ phí",
  OTHER: "Khác",
};

export const QUOTE_UNITS = [
  "chuyến",
  "km",
  "giờ",
  "ca",
  "tấn",
  "m³",
  "kiện",
  "người",
  "tầng",
  "lần",
] as const;

export const quoteLineItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "Vui lòng mô tả nội dung dòng")
    .max(300, "Mô tả tối đa 300 ký tự"),
  category: z.enum(QUOTE_LINE_CATEGORIES, { message: "Vui lòng chọn nhóm chi phí" }),
  quantity: z
    .number()
    .positive("Số lượng phải lớn hơn 0")
    .max(1_000_000, "Số lượng quá lớn"),
  unit: z.string().trim().min(1, "Vui lòng chọn đơn vị tính").max(30),
  unitPrice: moneyString,
  discountAmount: optionalMoneyString,
  taxPercent: optionalNumber(
    z
      .number()
      .min(0, "Thuế suất không được âm")
      .max(100, "Thuế suất không vượt quá 100%")
  ),
  note: z.string().trim().max(300).optional(),
});

export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;

/** Tạo báo giá mới, hoặc tạo revision mới cho báo giá đã có. */
export const quoteRevisionSchema = z.object({
  lineItems: z
    .array(quoteLineItemSchema)
    .min(1, "Báo giá phải có ít nhất một dòng chi phí")
    .max(50, "Tối đa 50 dòng trong một báo giá"),

  /** Giảm giá áp cho cả báo giá, ngoài phần giảm của từng dòng. */
  discountAmount: optionalMoneyString,

  /** Số ngày hiệu lực tính từ lúc gửi. */
  validityDays: optionalNumber(
    z
      .number()
      .int("Số ngày phải là số nguyên")
      .min(1, "Hiệu lực tối thiểu 1 ngày")
      .max(365, "Hiệu lực tối đa 365 ngày")
  ),

  terms: z.string().trim().max(3000, "Điều khoản tối đa 3000 ký tự").optional(),
  note: z.string().trim().max(1000).optional(),
});

export type QuoteRevisionInput = z.infer<typeof quoteRevisionSchema>;

export const createQuoteSchema = quoteRevisionSchema.extend({
  /** Mã yêu cầu dịch vụ mà báo giá này trả lời. */
  serviceRequestCode: z.string().trim().min(1, "Thiếu mã yêu cầu"),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/** Khách chấp nhận — bắt buộc nêu rõ revision nào để tránh chấp nhận nhầm bản cũ (§13.3). */
export const acceptQuoteSchema = z.object({
  revisionNumber: z.number().int().min(1, "Thiếu số hiệu phiên bản báo giá"),
});

export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

export const declineQuoteSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Vui lòng cho biết lý do để chúng tôi điều chỉnh phương án")
    .max(1000),
});

export type DeclineQuoteInput = z.infer<typeof declineQuoteSchema>;

export const quoteMessageSchema = z.object({
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(2000, "Tối đa 2000 ký tự"),
  /** Ghi chú nội bộ không hiển thị cho khách (§19). */
  internal: z.boolean().default(false),
});

export type QuoteMessageInput = z.infer<typeof quoteMessageSchema>;

export const listQuotesQuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "PENDING_APPROVAL",
      "SENT",
      "VIEWED",
      "NEGOTIATING",
      "ACCEPTED",
      "DECLINED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;
