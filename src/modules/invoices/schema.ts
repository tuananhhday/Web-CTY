import { z } from "zod";
import { PAYMENT_METHODS } from "@/modules/invoices/state-machine";

/** Zod schema cho hóa đơn và ghi nhận thanh toán (§20). */

/** Số tiền VND: chuỗi chỉ gồm chữ số. Cùng quy ước với báo giá (§24.9). */
const moneyString = z
  .string()
  .regex(/^\d+$/, "Số tiền phải là số nguyên dương, không có dấu phẩy hay chữ")
  .refine((value) => value.length <= 15, "Số tiền vượt mức xử lý");

/** Ô nhập để trống trả về chuỗi rỗng chứ không phải undefined. */
const optionalMoneyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  moneyString.optional()
);

function optionalNumber(schema: z.ZodType<number>) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional()
  );
}

export const invoiceLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "Vui lòng mô tả nội dung dòng")
    .max(300, "Mô tả tối đa 300 ký tự"),
  quantity: z.number().positive("Số lượng phải lớn hơn 0").max(1_000_000),
  unit: z.string().trim().min(1, "Vui lòng nhập đơn vị tính").max(30),
  unitPrice: moneyString,
  discountAmount: optionalMoneyString,
  taxPercent: optionalNumber(
    z.number().min(0, "Thuế suất không được âm").max(100, "Thuế suất không vượt quá 100%")
  ),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

/**
 * Tạo hóa đơn.
 *
 * Thông tin xuất hóa đơn là SNAPSHOT tại thời điểm lập, không tham chiếu tới hồ sơ khách
 * hàng (§20). Khách đổi địa chỉ sau này thì hóa đơn cũ phải giữ nguyên địa chỉ đã in.
 */
export const createInvoiceSchema = z.object({
  /** Lập từ một chuyến đã hoàn tất. Không bắt buộc — có hóa đơn dịch vụ ngoài chuyến. */
  trackingCode: z.string().trim().optional(),

  billingName: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập tên đơn vị xuất hóa đơn")
    .max(200, "Tên tối đa 200 ký tự"),
  billingTaxCode: z
    .string()
    .trim()
    .max(20, "Mã số thuế tối đa 20 ký tự")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  billingAddress: z.string().trim().max(300).optional(),
  billingEmail: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  lines: z
    .array(invoiceLineSchema)
    .min(1, "Hóa đơn phải có ít nhất một dòng")
    .max(100, "Tối đa 100 dòng trong một hóa đơn"),

  discountAmount: optionalMoneyString,

  /** Số ngày tới hạn thanh toán, tính từ lúc phát hành. */
  paymentTermDays: optionalNumber(
    z.number().int().min(0, "Số ngày không được âm").max(365, "Tối đa 365 ngày")
  ),

  note: z.string().trim().max(2000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const issueInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1),
});

export const voidInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(5, "Lý do hủy phải nêu rõ, tối thiểu 5 ký tự")
    .max(1000),
});

export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

/**
 * Ghi nhận thanh toán (§20).
 *
 * KHÔNG có trường nào chứa dữ liệu thẻ. Hệ thống chỉ ghi nhận khoản tiền đã nhận qua tiền
 * mặt hoặc chuyển khoản; không có cổng thanh toán online trong phiên bản này.
 */
export const recordPaymentSchema = z.object({
  invoiceNumber: z.string().trim().min(1),
  amount: moneyString.refine((value) => value !== "0", "Số tiền phải lớn hơn 0"),
  method: z.enum(PAYMENT_METHODS, { message: "Vui lòng chọn phương thức" }),

  /** Mã giao dịch ngân hàng hoặc số phiếu thu, để đối chiếu sao kê. */
  referenceCode: z.string().trim().max(100).optional(),

  paidAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(500).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const confirmPaymentSchema = z.object({
  paymentId: z.string().trim().min(1),
});

export const reversePaymentSchema = z.object({
  paymentId: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(5, "Lý do đảo khoản phải nêu rõ, tối thiểu 5 ký tự")
    .max(1000),
});

export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
