/**
 * Định dạng đơn vị đo lường hiển thị cho người dùng.
 *
 * Thời gian: xem @/lib/datetime (được re-export bên dưới cho tiện dùng).
 * Tiền tệ: xem @/lib/money.
 */

export {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekday,
  formatRelative,
  BUSINESS_TIMEZONE,
} from "@/lib/datetime";

const numberFormatter = new Intl.NumberFormat("vi-VN");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Khối lượng: dưới 1000 kg hiển thị kg, từ 1 tấn trở lên hiển thị tấn cho dễ đọc. */
export function formatWeight(kg: number): string {
  if (kg >= 1000) {
    const tonnes = kg / 1000;
    const rounded = Number.isInteger(tonnes) ? tonnes : Number(tonnes.toFixed(2));
    return `${numberFormatter.format(rounded)} tấn`;
  }
  return `${numberFormatter.format(kg)} kg`;
}

export function formatVolume(cubicMeters: number): string {
  return `${numberFormatter.format(cubicMeters)} m³`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${numberFormatter.format(Number((meters / 1000).toFixed(1)))} km`;
  }
  return `${numberFormatter.format(Math.round(meters))} m`;
}

/** Kích thước tệp cho giao diện upload. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
