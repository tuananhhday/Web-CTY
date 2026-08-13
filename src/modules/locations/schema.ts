import { z } from "zod";

/** Zod schema cho vị trí chuyến (§17). */

const latitude = z
  .number()
  .min(-90, "Vĩ độ không hợp lệ")
  .max(90, "Vĩ độ không hợp lệ");

const longitude = z
  .number()
  .min(-180, "Kinh độ không hợp lệ")
  .max(180, "Kinh độ không hợp lệ");

const pingSchema = z.object({
  latitude,
  longitude,
  accuracyM: z.number().min(0).max(100_000).optional(),
  speedKph: z.number().min(0).max(400).optional(),
  heading: z.number().min(0).max(360).optional(),
  /** Thời điểm thiết bị ghi nhận. Server đối chiếu lại, không tin tuyệt đối (§17). */
  recordedAt: z.string().datetime({ offset: true }),
});

/**
 * Gửi vị trí theo lô (§17).
 *
 * Thiết bị gom nhiều điểm rồi gửi một lần thay vì mỗi điểm một request: tiết kiệm pin, chịu
 * được vùng mất sóng, và giảm số lần chạm database.
 */
export const locationBatchSchema = z.object({
  trackingCode: z.string().trim().min(1, "Thiếu mã chuyến"),
  pings: z
    .array(pingSchema)
    .min(1, "Lô phải có ít nhất một điểm")
    .max(100, "Mỗi lô tối đa 100 điểm"),
});

export type LocationBatchInput = z.infer<typeof locationBatchSchema>;
export type PingInput = z.infer<typeof pingSchema>;

/** Bật/tắt chia sẻ vị trí cho khách xem — cờ theo sự cố hoặc chính sách (§17). */
export const locationSharingSchema = z.object({
  trackingCode: z.string().trim().min(1),
  enabled: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export type LocationSharingInput = z.infer<typeof locationSharingSchema>;
