import {
  CUSTOMER_MILESTONES,
  customerMilestoneOf,
  SHIPMENT_STATUS_LABELS,
  type CustomerMilestone,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";

/**
 * Che dữ liệu cho tra cứu công khai (§16.1).
 *
 * Module thuần, không chạm database — để test được đúng thứ quan trọng nhất: người tra cứu
 * bằng mã vận đơn KHÔNG lấy được thông tin cá nhân.
 *
 * Nguyên tắc: hàm này quyết định cái gì ĐƯỢC hiện, chứ không phải cái gì bị ẩn. Thêm trường
 * mới vào Shipment sẽ không tự động lọt ra ngoài vì mọi trường công khai phải khai báo ở đây.
 */

/** Trạng thái nội bộ mà người ngoài không cần biết chi tiết. */
const EXCEPTION_STATUSES: ShipmentStatus[] = ["ON_HOLD", "INCIDENT", "FAILED", "CANCELLED"];

export interface PublicStop {
  kind: string;
  /** Chỉ tới cấp tỉnh/thành. Quận/huyện đã đủ để suy ra địa chỉ trong nhiều trường hợp. */
  province: string;
}

export interface PublicMilestone {
  key: CustomerMilestone;
  label: string;
  reached: boolean;
  /** Chỉ có mốc đã đi qua mới kèm thời gian. */
  occurredAt: Date | null;
}

export interface PublicTrackingView {
  trackingCode: string;
  /** Nhãn thân thiện, không phải mã trạng thái nội bộ. */
  statusLabel: string;
  /** Có đang gặp vấn đề không — hiện chung chung, không nêu nguyên nhân. */
  hasException: boolean;
  stops: PublicStop[];
  milestones: PublicMilestone[];
  /** Ngày dự kiến giao, làm tròn tới ngày. Giờ chính xác là thông tin vận hành nội bộ. */
  estimatedDeliveryDate: Date | null;
  lastUpdatedAt: Date;
}

export interface ShipmentForMasking {
  trackingCode: string;
  status: string;
  estimatedDeliveryAt: Date | null;
  updatedAt: Date;
  stops: { kind: string; province: string }[];
  statusEvents: { toStatus: string; occurredAt: Date }[];
}

/** Đầu ngày theo giờ Việt Nam — giấu giờ hẹn cụ thể khỏi người tra cứu công khai. */
function toDateOnly(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Thời điểm chuyến lần đầu đạt tới mỗi mốc.
 *
 * Duyệt theo thứ tự thời gian tăng dần và chỉ ghi lần ĐẦU tiên: chuyến bị tạm dừng rồi
 * chạy lại sẽ đi qua cùng một mốc nhiều lần, khách chỉ cần biết lần đầu.
 */
function milestoneTimestamps(
  events: { toStatus: string; occurredAt: Date }[]
): Map<CustomerMilestone, Date> {
  const result = new Map<CustomerMilestone, Date>();

  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  for (const event of sorted) {
    const milestone = customerMilestoneOf(event.toStatus as ShipmentStatus);
    if (milestone === "pending") continue;
    if (!result.has(milestone)) result.set(milestone, event.occurredAt);
  }

  return result;
}

export function toPublicView(shipment: ShipmentForMasking): PublicTrackingView {
  const status = shipment.status as ShipmentStatus;
  const current = customerMilestoneOf(status);
  const timestamps = milestoneTimestamps(shipment.statusEvents);

  // Mốc coi là đã đạt nếu có dấu vết trong lịch sử, hoặc nằm trước mốc hiện tại.
  const currentIndex = CUSTOMER_MILESTONES.findIndex((m) => m.key === current);

  const milestones: PublicMilestone[] = CUSTOMER_MILESTONES.map((milestone, index) => ({
    key: milestone.key,
    label: milestone.label,
    reached: timestamps.has(milestone.key) || (currentIndex >= 0 && index <= currentIndex),
    occurredAt: timestamps.get(milestone.key) ?? null,
  }));

  return {
    trackingCode: shipment.trackingCode,
    statusLabel: SHIPMENT_STATUS_LABELS[status],
    hasException: EXCEPTION_STATUSES.includes(status),
    stops: shipment.stops.map((stop) => ({ kind: stop.kind, province: stop.province })),
    milestones,
    estimatedDeliveryDate: shipment.estimatedDeliveryAt
      ? toDateOnly(shipment.estimatedDeliveryAt)
      : null,
    lastUpdatedAt: shipment.updatedAt,
  };
}

/**
 * Bốn số cuối của điện thoại, dùng làm bước xác minh phụ khi tra cứu công khai (§16.1).
 *
 * So sánh trên chuỗi đã chuẩn hoá để "0912 345 678", "+84912345678" và "0912345678" đều
 * cho cùng kết quả.
 */
export function matchesPhoneSuffix(
  normalizedPhone: string | null,
  input: string
): boolean {
  if (!normalizedPhone) return false;

  const digitsOnly = input.replace(/\D/g, "");
  if (digitsOnly.length !== 4) return false;

  return normalizedPhone.endsWith(digitsOnly);
}
