/**
 * Thời gian (§1, §24.9).
 *
 * Quy tắc: database luôn lưu UTC. Chỉ chuyển sang Asia/Ho_Chi_Minh tại lớp hiển thị.
 * Không bao giờ lưu chuỗi thời gian đã đổi múi giờ vào database.
 */

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh" as const;

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BUSINESS_TIMEZONE,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: BUSINESS_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BUSINESS_TIMEZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: BUSINESS_TIMEZONE,
});

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Giá trị thời gian không hợp lệ: ${String(value)}`);
  }
  return date;
}

export function formatDateTime(value: DateInput): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatDate(value: DateInput): string {
  return dateFormatter.format(toDate(value));
}

export function formatTime(value: DateInput): string {
  return timeFormatter.format(toDate(value));
}

export function formatWeekday(value: DateInput): string {
  return weekdayFormatter.format(toDate(value));
}

/** Thời gian tương đối tiếng Việt: "3 phút trước", "2 ngày nữa". */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const diffMs = toDate(value).getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

  if (absSeconds < 60) return rtf.format(diffSeconds, "second");
  if (absSeconds < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (absSeconds < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (absSeconds < 2592000) return rtf.format(Math.round(diffSeconds / 86400), "day");
  if (absSeconds < 31536000) return rtf.format(Math.round(diffSeconds / 2592000), "month");
  return rtf.format(Math.round(diffSeconds / 31536000), "year");
}

/** Kiểm tra hai khoảng thời gian có giao nhau không — dùng để chặn double-booking (§14.3). */
export function hasOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Kiểm tra khoảng thời gian hợp lệ: bắt đầu phải trước kết thúc (§24.9). */
export function isValidTimeWindow(start: Date, end: Date): boolean {
  return start.getTime() < end.getTime();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Hai mốc có cùng một ngày làm việc hay không.
 *
 * So sánh theo giờ Việt Nam chứ không theo UTC: chuyến lấy hàng lúc 06:00 sáng ở Việt Nam
 * là 23:00 hôm trước theo UTC, so sánh sai múi giờ sẽ xếp nhầm sang "ngày mai" (§24.9).
 */
export function isSameDay(a: DateInput, b: DateInput): boolean {
  return dateFormatter.format(toDate(a)) === dateFormatter.format(toDate(b));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isExpired(expiresAt: DateInput, now: Date = new Date()): boolean {
  return toDate(expiresAt).getTime() <= now.getTime();
}
