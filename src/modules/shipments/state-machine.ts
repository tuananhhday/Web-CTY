import { appError } from "@/lib/errors";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";

/**
 * State machine cho đơn hàng vận chuyển (§15).
 *
 * Module thuần, không chạm database.
 *
 * §15 nói rõ: "Không bắt buộc mọi chuyến đi qua mọi trạng thái". Vì vậy bảng dưới đây
 * cho phép nhiều đường đi — một chuyến giao hàng đơn giản có thể nhảy từ `LOADING` thẳng
 * tới `IN_TRANSIT` mà không qua `SECURED_ON_VEHICLE`. Nhưng bốn ràng buộc cứng sau luôn
 * được giữ:
 *
 *   1. Không `IN_TRANSIT` trước khi có mặt ở điểm lấy hàng.
 *   2. Không `COMPLETED` khi chưa có bằng chứng giao hàng (kiểm tra ở service).
 *   3. Tài xế không tự quay ngược trạng thái.
 *   4. Hủy hoặc thất bại bắt buộc có mã lý do.
 */

export const SHIPMENT_STATUSES = [
  "CREATED",
  "CONFIRMED",
  "SCHEDULED",
  "DRIVER_ASSIGNED",
  "EN_ROUTE_TO_PICKUP",
  "AT_PICKUP",
  "PICKUP_INSPECTION",
  "PACKING",
  "LOADING",
  "SECURED_ON_VEHICLE",
  "IN_TRANSIT",
  "AT_DELIVERY",
  "UNLOADING",
  "DELIVERED_PENDING_CONFIRMATION",
  "COMPLETED",
  "ON_HOLD",
  "INCIDENT",
  "FAILED",
  "CANCELLED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/**
 * Vai trò trong ngữ cảnh vận chuyển.
 * `DRIVER` chỉ đẩy trạng thái tiến lên; `DISPATCHER` sửa được cả tiến lẫn lùi khi có lý do.
 */
type ShipmentActor = "DRIVER" | "DISPATCHER" | "SYSTEM";

interface Transition {
  to: ShipmentStatus;
  by: ShipmentActor[];
  requiresReason?: boolean;
}

/** Trạng thái tài xế đã có mặt tại điểm lấy hàng — mốc để cho phép IN_TRANSIT. */
const PICKUP_REACHED: ShipmentStatus[] = [
  "AT_PICKUP",
  "PICKUP_INSPECTION",
  "PACKING",
  "LOADING",
  "SECURED_ON_VEHICLE",
];

/** Trạng thái tạm dừng: quay lại được luồng chính khi xử lý xong. */
const RESUMABLE: ShipmentStatus[] = ["ON_HOLD", "INCIDENT"];

/** Bước tạm dừng và kết thúc mà hầu hết trạng thái đang chạy đều dùng được. */
const ESCAPE_HATCHES: Transition[] = [
  { to: "ON_HOLD", by: ["DISPATCHER"], requiresReason: true },
  { to: "INCIDENT", by: ["DRIVER", "DISPATCHER"], requiresReason: true },
  { to: "FAILED", by: ["DISPATCHER"], requiresReason: true },
  { to: "CANCELLED", by: ["DISPATCHER"], requiresReason: true },
];

const TRANSITIONS: Record<ShipmentStatus, Transition[]> = {
  CREATED: [
    { to: "CONFIRMED", by: ["DISPATCHER"] },
    { to: "CANCELLED", by: ["DISPATCHER"], requiresReason: true },
  ],

  CONFIRMED: [
    { to: "SCHEDULED", by: ["DISPATCHER"] },
    { to: "CANCELLED", by: ["DISPATCHER"], requiresReason: true },
  ],

  SCHEDULED: [
    { to: "DRIVER_ASSIGNED", by: ["DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  DRIVER_ASSIGNED: [
    { to: "EN_ROUTE_TO_PICKUP", by: ["DRIVER", "DISPATCHER"] },
    // Dispatcher đổi tài xế: quay về SCHEDULED để phân công lại.
    { to: "SCHEDULED", by: ["DISPATCHER"], requiresReason: true },
    ...ESCAPE_HATCHES,
  ],

  EN_ROUTE_TO_PICKUP: [
    { to: "AT_PICKUP", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  AT_PICKUP: [
    { to: "PICKUP_INSPECTION", by: ["DRIVER", "DISPATCHER"] },
    { to: "LOADING", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  PICKUP_INSPECTION: [
    { to: "PACKING", by: ["DRIVER", "DISPATCHER"] },
    { to: "LOADING", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  PACKING: [
    { to: "LOADING", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  LOADING: [
    { to: "SECURED_ON_VEHICLE", by: ["DRIVER", "DISPATCHER"] },
    // Chuyến đơn giản không cần bước chằng buộc riêng.
    { to: "IN_TRANSIT", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  SECURED_ON_VEHICLE: [
    { to: "IN_TRANSIT", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  IN_TRANSIT: [
    { to: "AT_DELIVERY", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  AT_DELIVERY: [
    { to: "UNLOADING", by: ["DRIVER", "DISPATCHER"] },
    { to: "DELIVERED_PENDING_CONFIRMATION", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  UNLOADING: [
    { to: "DELIVERED_PENDING_CONFIRMATION", by: ["DRIVER", "DISPATCHER"] },
    ...ESCAPE_HATCHES,
  ],

  DELIVERED_PENDING_CONFIRMATION: [
    // Service kiểm tra ProofOfDelivery trước khi cho phép bước này (§15).
    { to: "COMPLETED", by: ["DRIVER", "DISPATCHER", "SYSTEM"] },
    { to: "INCIDENT", by: ["DRIVER", "DISPATCHER"], requiresReason: true },
    { to: "FAILED", by: ["DISPATCHER"], requiresReason: true },
  ],

  ON_HOLD: [
    // Quay lại luồng chính. Dispatcher chọn trạng thái phù hợp; service kiểm tra hợp lệ.
    { to: "SCHEDULED", by: ["DISPATCHER"], requiresReason: true },
    { to: "DRIVER_ASSIGNED", by: ["DISPATCHER"], requiresReason: true },
    { to: "EN_ROUTE_TO_PICKUP", by: ["DISPATCHER"], requiresReason: true },
    { to: "IN_TRANSIT", by: ["DISPATCHER"], requiresReason: true },
    { to: "CANCELLED", by: ["DISPATCHER"], requiresReason: true },
    { to: "FAILED", by: ["DISPATCHER"], requiresReason: true },
  ],

  INCIDENT: [
    { to: "ON_HOLD", by: ["DISPATCHER"], requiresReason: true },
    { to: "EN_ROUTE_TO_PICKUP", by: ["DISPATCHER"], requiresReason: true },
    { to: "IN_TRANSIT", by: ["DISPATCHER"], requiresReason: true },
    { to: "AT_DELIVERY", by: ["DISPATCHER"], requiresReason: true },
    { to: "DELIVERED_PENDING_CONFIRMATION", by: ["DISPATCHER"], requiresReason: true },
    { to: "FAILED", by: ["DISPATCHER"], requiresReason: true },
    { to: "CANCELLED", by: ["DISPATCHER"], requiresReason: true },
  ],

  // Ba trạng thái kết thúc.
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isTerminal(status: ShipmentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function allowedTransitions(status: ShipmentStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

/** Chuyến đang trên đường — dùng để quyết định có nhận vị trí GPS hay không (§17). */
export function isActiveOnRoad(status: ShipmentStatus): boolean {
  return [
    "EN_ROUTE_TO_PICKUP",
    "AT_PICKUP",
    "PICKUP_INSPECTION",
    "PACKING",
    "LOADING",
    "SECURED_ON_VEHICLE",
    "IN_TRANSIT",
    "AT_DELIVERY",
    "UNLOADING",
  ].includes(status);
}

/** Đã tới điểm lấy hàng chưa. Ràng buộc số 1 của §15. */
export function hasReachedPickup(status: ShipmentStatus): boolean {
  return (
    PICKUP_REACHED.includes(status) ||
    ["IN_TRANSIT", "AT_DELIVERY", "UNLOADING", "DELIVERED_PENDING_CONFIRMATION", "COMPLETED"].includes(
      status
    )
  );
}

export function isPaused(status: ShipmentStatus): boolean {
  return RESUMABLE.includes(status);
}

export function shipmentActorOf(actor: Actor): ShipmentActor {
  if (!isAuthenticated(actor)) {
    // Khách hàng không đổi được trạng thái vận chuyển; trả DRIVER để mọi bước cần
    // DISPATCHER đều bị từ chối, và bước của DRIVER vẫn bị chặn bởi kiểm tra assignment.
    return "DRIVER";
  }
  return actor.permissions.has("shipment.dispatch") ? "DISPATCHER" : "DRIVER";
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  by: ShipmentActor,
  options: { reason?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: `Đơn hàng đã ở trạng thái kết thúc (${from}), không thể chuyển tiếp.`,
    };
  }

  const transition = TRANSITIONS[from].find((t) => t.to === to);
  if (!transition) {
    return { allowed: false, reason: `Không thể chuyển đơn hàng từ ${from} sang ${to}.` };
  }

  if (!transition.by.includes(by)) {
    const who = by === "DRIVER" ? "Tài xế" : by === "DISPATCHER" ? "Điều phối" : "Hệ thống";
    return { allowed: false, reason: `${who} không được phép thực hiện bước này.` };
  }

  if (transition.requiresReason && !options.reason?.trim()) {
    return { allowed: false, reason: "Bước chuyển này bắt buộc nhập lý do." };
  }

  return { allowed: true };
}

export function assertTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  by: ShipmentActor,
  options: { reason?: string | null } = {}
): void {
  const result = canTransition(from, to, by, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

/**
 * Bước kế tiếp tự nhiên cho tài xế — dùng để hiện MỘT nút CTA duy nhất trên app tài xế
 * thay vì bắt họ chọn trong danh sách 19 trạng thái (§26.2).
 */
export function nextDriverStep(status: ShipmentStatus): ShipmentStatus | null {
  const NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
    DRIVER_ASSIGNED: "EN_ROUTE_TO_PICKUP",
    EN_ROUTE_TO_PICKUP: "AT_PICKUP",
    AT_PICKUP: "LOADING",
    PICKUP_INSPECTION: "LOADING",
    PACKING: "LOADING",
    LOADING: "IN_TRANSIT",
    SECURED_ON_VEHICLE: "IN_TRANSIT",
    IN_TRANSIT: "AT_DELIVERY",
    AT_DELIVERY: "UNLOADING",
    UNLOADING: "DELIVERED_PENDING_CONFIRMATION",
  };
  return NEXT[status] ?? null;
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: "Mới tạo",
  CONFIRMED: "Đã xác nhận",
  SCHEDULED: "Đã lên lịch",
  DRIVER_ASSIGNED: "Đã phân công tài xế",
  EN_ROUTE_TO_PICKUP: "Đang tới điểm lấy hàng",
  AT_PICKUP: "Đã tới điểm lấy hàng",
  PICKUP_INSPECTION: "Đang kiểm tra hàng",
  PACKING: "Đang đóng gói",
  LOADING: "Đang xếp hàng",
  SECURED_ON_VEHICLE: "Đã chằng buộc xong",
  IN_TRANSIT: "Đang vận chuyển",
  AT_DELIVERY: "Đã tới điểm giao",
  UNLOADING: "Đang dỡ hàng",
  DELIVERED_PENDING_CONFIRMATION: "Đã giao, chờ xác nhận",
  COMPLETED: "Hoàn tất",
  ON_HOLD: "Tạm dừng",
  INCIDENT: "Có sự cố",
  FAILED: "Không thực hiện được",
  CANCELLED: "Đã hủy",
};

/**
 * Mốc hiển thị cho khách hàng.
 *
 * Khách không cần thấy đủ 19 trạng thái nội bộ — gom về 5 mốc dễ hiểu, đúng tinh thần
 * §15: "Hiển thị timeline thân thiện cho khách, nhưng giữ mã trạng thái nội bộ ổn định".
 */
export const CUSTOMER_MILESTONES = [
  { key: "confirmed", label: "Đã xác nhận đơn hàng" },
  { key: "picked_up", label: "Đã lấy hàng" },
  { key: "in_transit", label: "Đang vận chuyển" },
  { key: "delivered", label: "Đã giao hàng" },
  { key: "completed", label: "Hoàn tất" },
] as const;

export type CustomerMilestone = (typeof CUSTOMER_MILESTONES)[number]["key"];

/** Mốc khách đang thấy, tương ứng trạng thái nội bộ hiện tại. */
export function customerMilestoneOf(status: ShipmentStatus): CustomerMilestone | "pending" {
  if (["CREATED"].includes(status)) return "pending";
  if (["CONFIRMED", "SCHEDULED", "DRIVER_ASSIGNED", "EN_ROUTE_TO_PICKUP"].includes(status)) {
    return "confirmed";
  }
  if (PICKUP_REACHED.includes(status)) return "picked_up";
  if (status === "IN_TRANSIT") return "in_transit";
  if (["AT_DELIVERY", "UNLOADING", "DELIVERED_PENDING_CONFIRMATION"].includes(status)) {
    return "delivered";
  }
  if (status === "COMPLETED") return "completed";
  // ON_HOLD, INCIDENT, FAILED, CANCELLED hiển thị riêng, không nằm trên trục mốc.
  return "pending";
}

export const SHIPMENT_STATUS_TONE: Record<
  ShipmentStatus,
  "neutral" | "orange" | "success" | "warning" | "error"
> = {
  CREATED: "neutral",
  CONFIRMED: "orange",
  SCHEDULED: "orange",
  DRIVER_ASSIGNED: "orange",
  EN_ROUTE_TO_PICKUP: "orange",
  AT_PICKUP: "orange",
  PICKUP_INSPECTION: "orange",
  PACKING: "orange",
  LOADING: "orange",
  SECURED_ON_VEHICLE: "orange",
  IN_TRANSIT: "orange",
  AT_DELIVERY: "orange",
  UNLOADING: "orange",
  DELIVERED_PENDING_CONFIRMATION: "warning",
  COMPLETED: "success",
  ON_HOLD: "warning",
  INCIDENT: "error",
  FAILED: "error",
  CANCELLED: "neutral",
};

/**
 * Điều kiện tiên quyết dựa trên DỮ LIỆU chứ không phải bảng chuyển trạng thái (§15).
 *
 * Tách riêng khỏi `canTransition` vì hai loại kiểm tra khác nhau về bản chất: bảng chuyển
 * trả lời "bước này có tồn tại không", còn hàm này trả lời "dữ liệu đã đủ để đi bước này
 * chưa". Giữ nó thuần để test được mà không cần database; service nạp dữ liệu rồi gọi vào.
 */
export function checkStatusPreconditions(input: {
  to: ShipmentStatus;
  reasonCode?: string | null;
  hasProofOfDelivery: boolean;
}): TransitionCheck {
  // Ràng buộc 2: không đóng đơn khi chưa có bằng chứng giao hàng.
  if (input.to === "COMPLETED" && !input.hasProofOfDelivery) {
    return {
      allowed: false,
      reason:
        "Chưa có bằng chứng giao hàng. Cần lập biên bản giao hàng trước khi hoàn tất đơn.",
    };
  }

  // Ràng buộc 4: hủy và thất bại phải chọn mã lý do trong danh mục, không nhập tự do.
  if (REASON_CODE_REQUIRED_STATUSES.includes(input.to)) {
    const code = input.reasonCode?.trim();
    if (!code) {
      return {
        allowed: false,
        reason: "Hủy hoặc đánh dấu thất bại bắt buộc chọn mã lý do.",
      };
    }
    if (!SHIPMENT_FAILURE_REASONS.some((reason) => reason.code === code)) {
      return { allowed: false, reason: "Mã lý do không hợp lệ." };
    }
  }

  return { allowed: true };
}

/** Trạng thái bắt buộc kèm mã lý do (§15 ràng buộc 4). */
export const REASON_CODE_REQUIRED_STATUSES: ShipmentStatus[] = ["CANCELLED", "FAILED"];

/** Mã lý do hủy hoặc thất bại (§15: bắt buộc có reason code). */
export const SHIPMENT_FAILURE_REASONS = [
  { code: "CUSTOMER_CANCELLED", label: "Khách hàng hủy" },
  { code: "CUSTOMER_UNAVAILABLE", label: "Không liên hệ được khách" },
  { code: "CARGO_NOT_READY", label: "Hàng chưa sẵn sàng" },
  { code: "CARGO_REFUSED", label: "Từ chối vận chuyển hàng" },
  { code: "VEHICLE_BREAKDOWN", label: "Xe gặp sự cố" },
  { code: "ACCESS_BLOCKED", label: "Không tiếp cận được địa điểm" },
  { code: "WEATHER", label: "Thời tiết không cho phép" },
  { code: "OTHER", label: "Lý do khác" },
] as const;
