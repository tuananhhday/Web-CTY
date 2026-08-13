import { z } from "zod";

/** Zod schema cho tra cứu vận đơn (§16.1). */

/**
 * Mã tra cứu do `generateTrackingCode()` sinh: tiền tố VT + chuỗi chữ số ngẫu nhiên.
 * Kiểm tra định dạng ngay tại đây để mã rác bị chặn trước khi chạm database.
 */
export const trackingLookupSchema = z.object({
  trackingCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Mã vận đơn quá ngắn")
    .max(20, "Mã vận đơn quá dài")
    .regex(/^[A-Z0-9-]+$/, "Mã vận đơn chỉ gồm chữ và số"),

  /**
   * Bốn số cuối điện thoại đã đăng ký — bước xác minh phụ chống dò mã (§16.1).
   * Chỉ bốn số chứ không phải cả số: đủ để chứng minh có liên quan, không đủ để lộ thêm.
   */
  phoneSuffix: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Nhập đúng 4 số cuối của điện thoại đã đăng ký"),
});

export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>;
