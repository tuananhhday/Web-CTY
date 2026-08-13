import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * OTP xác nhận giao hàng (§18).
 *
 * Module thuần, không chạm database — kiểm thử được toàn bộ quy tắc mà không cần hạ tầng.
 *
 * Bốn quy tắc an toàn của §18, mã hoá thành code chứ không chỉ ghi trong tài liệu:
 *   1. Chỉ lưu HASH. Mã thô chỉ tồn tại trong bộ nhớ đúng một lần rồi gửi qua SMS.
 *   2. Có hạn sử dụng.
 *   3. Giới hạn số lần thử.
 *   4. Dùng một lần; đã dùng thì không dùng lại.
 */

/** 6 chữ số: đủ khó đoán trong 5 lần thử, đủ ngắn để đọc qua điện thoại. */
const OTP_LENGTH = 6;

export const OTP_TTL_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Sinh mã OTP.
 *
 * Dùng `randomInt` của `node:crypto` chứ không phải `Math.random()`: `Math.random` không
 * phải nguồn ngẫu nhiên an toàn, chuỗi sinh ra đoán được nếu biết vài giá trị trước đó.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Hash OTP trước khi lưu.
 *
 * SHA-256 kèm muối là mã chuyến: hai chuyến có cùng OTP vẫn cho hash khác nhau, nên đọc
 * được bảng cũng không suy ra chuyến nào đang dùng mã nào. Không dùng bcrypt/argon2 ở đây vì
 * OTP sống 15 phút và chỉ có 10^6 khả năng — chi phí hash chậm không mua thêm được an toàn
 * đáng kể, trong khi tài xế phải chờ ở điểm giao.
 */
export function hashOtp(otp: string, shipmentId: string): string {
  return createHash("sha256").update(`${shipmentId}:${otp}`).digest("hex");
}

export interface OtpRecord {
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  consumedAt: Date | null;
}

export type OtpVerification =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "CONSUMED" | "TOO_MANY_ATTEMPTS" | "MISMATCH"; message: string };

const REASON_MESSAGES: Record<Exclude<OtpVerification, { ok: true }>["reason"], string> = {
  EXPIRED: "Mã xác nhận đã hết hạn. Vui lòng gửi lại mã mới.",
  CONSUMED: "Mã xác nhận này đã được sử dụng.",
  TOO_MANY_ATTEMPTS: "Đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã mới.",
  MISMATCH: "Mã xác nhận không đúng.",
};

/**
 * Kiểm tra OTP người nhận đọc cho tài xế.
 *
 * Thứ tự kiểm tra có chủ ý: hết hạn và đã dùng xét TRƯỚC khi so mã. Nếu so mã trước thì
 * người thử có thể dùng thời gian phản hồi để biết mã nào đúng dù bản ghi đã hết hạn.
 */
export function verifyOtp(
  record: OtpRecord,
  input: string,
  shipmentId: string,
  now: Date = new Date()
): OtpVerification {
  const fail = (reason: Exclude<OtpVerification, { ok: true }>["reason"]): OtpVerification => ({
    ok: false,
    reason,
    message: REASON_MESSAGES[reason],
  });

  if (record.consumedAt !== null) return fail("CONSUMED");
  if (record.expiresAt.getTime() <= now.getTime()) return fail("EXPIRED");
  if (record.attempts >= record.maxAttempts) return fail("TOO_MANY_ATTEMPTS");

  const candidate = hashOtp(input.trim(), shipmentId);

  // So sánh theo thời gian hằng định: so chuỗi thông thường dừng ở ký tự khác đầu tiên,
  // để lộ thông tin qua thời gian phản hồi.
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(record.otpHash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return fail("MISMATCH");
  }

  return { ok: true };
}

export function otpExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
}

/**
 * Che số điện thoại khi báo cho tài xế biết mã được gửi tới đâu.
 *
 * Tài xế cần biết mã đã gửi tới đúng số hay chưa, nhưng không cần đọc trọn số của người
 * nhận — đó là dữ liệu của khách, không phải của chuyến (§31).
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
