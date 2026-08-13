import { z } from "zod";
import { normalizePhone } from "@/lib/normalize";
import { TICKET_TYPES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/modules/support/state-machine";

/** Zod schema cho hỗ trợ và liên hệ (§19, §23). */

// -----------------------------------------------------------------------------
// Phiếu hỗ trợ
// -----------------------------------------------------------------------------

/**
 * Khách tạo phiếu.
 *
 * KHÔNG có trường `priority`: khách tự chọn thì ai cũng chọn "khẩn cấp". Hệ thống suy ra
 * từ loại phiếu qua `defaultPriorityFor` (§19).
 */
export const createTicketSchema = z.object({
  type: z.enum(TICKET_TYPES, { message: "Vui lòng chọn loại yêu cầu" }),

  subject: z
    .string()
    .trim()
    .min(5, "Tiêu đề tối thiểu 5 ký tự")
    .max(200, "Tiêu đề tối đa 200 ký tự"),

  body: z
    .string()
    .trim()
    .min(20, "Vui lòng mô tả rõ hơn, tối thiểu 20 ký tự")
    .max(5000, "Nội dung tối đa 5000 ký tự"),

  /** Gắn phiếu vào một chuyến cụ thể. Không bắt buộc — có câu hỏi chung không thuộc đơn nào. */
  trackingCode: z.string().trim().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const replyTicketSchema = z.object({
  code: z.string().trim().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nội dung")
    .max(5000, "Nội dung tối đa 5000 ký tự"),
  /**
   * Chỉ nhân viên gửi được ghi chú nội bộ. Service kiểm tra lại quyền — không tin cờ này
   * từ client (§19).
   */
  internal: z.boolean().default(false),
});

export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;

export const changeTicketStatusSchema = z.object({
  code: z.string().trim().min(1),
  toStatus: z.enum(TICKET_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export type ChangeTicketStatusInput = z.infer<typeof changeTicketStatusSchema>;

export const assignTicketSchema = z.object({
  code: z.string().trim().min(1),
  assigneeId: z.string().trim().min(1).nullable(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

// -----------------------------------------------------------------------------
// Liên hệ từ trang công khai (§23)
// -----------------------------------------------------------------------------

export const contactInquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập họ tên")
    .max(120, "Họ tên tối đa 120 ký tự"),

  phone: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số điện thoại")
    .refine((value) => normalizePhone(value) !== null, {
      message: "Số điện thoại không hợp lệ. Ví dụ: 0912 345 678",
    }),

  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  subject: z
    .string()
    .trim()
    .min(3, "Vui lòng nhập tiêu đề")
    .max(200, "Tiêu đề tối đa 200 ký tự"),

  message: z
    .string()
    .trim()
    .min(10, "Vui lòng mô tả rõ hơn, tối thiểu 10 ký tự")
    .max(3000, "Nội dung tối đa 3000 ký tự"),

  /**
   * Bẫy bot (§23). Schema CHẤP NHẬN mọi giá trị — từ chối ở đây sẽ trả lỗi lộ ra rằng
   * trường này bị kiểm tra, và bot chỉ cần bỏ trống là qua được. Route handler kiểm tra
   * riêng và trả về như thành công mà không tạo bản ghi.
   */
  website: z.string().optional(),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;

export const CONTACT_INQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"] as const;

export const CONTACT_INQUIRY_STATUS_LABELS: Record<
  (typeof CONTACT_INQUIRY_STATUSES)[number],
  string
> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  SPAM: "Spam",
};
