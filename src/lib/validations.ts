import { z } from "zod";

const phoneRegex = /^(0|\+84)\d{8,10}$/;

export const phoneField = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập số điện thoại")
  .refine((v) => phoneRegex.test(v.replace(/[\s.]/g, "")), "Số điện thoại không hợp lệ");

export const emailField = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email")
  .email("Email không hợp lệ");

export const estimateSchema = z.object({
  pickupAddress: z.string().trim().min(3, "Vui lòng nhập điểm lấy hàng"),
  dropoffAddress: z.string().trim().min(3, "Vui lòng nhập điểm giao hàng"),
  cargoType: z.string().trim().min(2, "Vui lòng nhập loại hàng"),
  weightKg: z
    .number({ message: "Vui lòng nhập trọng lượng dự kiến" })
    .positive("Trọng lượng phải lớn hơn 0")
    .max(100000, "Trọng lượng vượt quá giới hạn cho phép"),
});
export type EstimateInput = z.infer<typeof estimateSchema>;

export const trackingSchema = z.object({
  code: z.string().trim().min(3, "Vui lòng nhập mã vận đơn"),
  phone: phoneField,
});
export type TrackingInput = z.infer<typeof trackingSchema>;

export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên"),
  phone: phoneField,
  email: z.string().trim().email("Email không hợp lệ").or(z.literal("")),
  companyName: z.string().trim().optional(),
  serviceSlug: z.string().min(1, "Vui lòng chọn dịch vụ"),
  pickupAddress: z.string().trim().min(3, "Vui lòng nhập điểm lấy hàng"),
  dropoffAddress: z.string().trim().min(3, "Vui lòng nhập điểm giao hàng"),
  cargoType: z.string().trim().min(2, "Vui lòng nhập loại hàng"),
  weightKg: z
    .number({ message: "Vui lòng nhập trọng lượng dự kiến" })
    .positive("Trọng lượng phải lớn hơn 0")
    .max(100000, "Trọng lượng vượt quá giới hạn cho phép"),
  quantity: z
    .number({ message: "Vui lòng nhập số kiện" })
    .int("Số kiện phải là số nguyên")
    .positive("Số kiện phải lớn hơn 0"),
  note: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự").optional(),
});
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên"),
  phone: phoneField,
  email: z.string().trim().email("Email không hợp lệ").or(z.literal("")),
  subject: z.string().trim().min(3, "Vui lòng nhập tiêu đề"),
  message: z
    .string()
    .trim()
    .min(10, "Vui lòng nhập nội dung tối thiểu 10 ký tự")
    .max(2000, "Nội dung tối đa 2000 ký tự"),
});
export type ContactInput = z.infer<typeof contactSchema>;

// Độ dài tối thiểu phải khớp `emailAndPassword.minPasswordLength` trong src/lib/auth.ts,
// nếu không người dùng sẽ qua được validate ở client rồi bị server từ chối.
const passwordField = z
  .string()
  .min(10, "Mật khẩu tối thiểu 10 ký tự")
  .max(128, "Mật khẩu tối đa 128 ký tự")
  .regex(/[a-z]/, "Mật khẩu cần ít nhất 1 chữ thường")
  .regex(/[A-Z]/, "Mật khẩu cần ít nhất 1 chữ hoa")
  .regex(/\d/, "Mật khẩu cần ít nhất 1 chữ số");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên"),
    email: emailField,
    phone: phoneField,
    companyName: z.string().trim().optional(),
    password: passwordField,
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
    acceptTerms: z.literal(true, {
      message: "Bạn cần đồng ý với điều khoản sử dụng",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên"),
  email: emailField,
  phone: phoneField,
  companyName: z.string().trim().optional(),
  address: z.string().trim().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
