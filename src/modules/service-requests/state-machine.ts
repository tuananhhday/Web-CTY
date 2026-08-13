import { appError } from "@/lib/errors";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";

/**
 * State machine cho yêu cầu dịch vụ (§11).
 *
 * Module thuần: không import database, kiểm thử được độc lập.
 *
 * Quy tắc bất di bất dịch (§11):
 *   - CHỈ service nghiệp vụ được đổi trạng thái, không đổi trực tiếp qua repository.
 *   - Mỗi lần đổi phải lưu người thực hiện, thời gian và lý do.
 *   - Không có chuyển trạng thái nào ngoài bảng dưới đây.
 */

export const REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
  "QUOTED",
  "NEGOTIATING",
  "ACCEPTED",
  "CONVERTED_TO_SHIPMENT",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Ai được phép thực hiện một bước chuyển. */
type TransitionActor = "CUSTOMER" | "STAFF" | "SYSTEM";

interface Transition {
  to: RequestStatus;
  by: TransitionActor[];
  /** Bắt buộc nhập lý do khi chuyển sang trạng thái này. */
  requiresReason?: boolean;
}

/**
 * Bảng chuyển trạng thái hợp lệ.
 *
 * Trạng thái kết thúc (`CONVERTED_TO_SHIPMENT`, `REJECTED`, `EXPIRED`, `CANCELLED`)
 * không có lối ra — muốn làm tiếp phải tạo yêu cầu mới. Điều này giữ cho lịch sử
 * không bị viết lại.
 */
const TRANSITIONS: Record<RequestStatus, Transition[]> = {
  DRAFT: [
    { to: "SUBMITTED", by: ["CUSTOMER", "STAFF"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  SUBMITTED: [
    { to: "UNDER_REVIEW", by: ["STAFF"] },
    { to: "NEED_MORE_INFO", by: ["STAFF"], requiresReason: true },
    { to: "REJECTED", by: ["STAFF"], requiresReason: true },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  UNDER_REVIEW: [
    { to: "NEED_MORE_INFO", by: ["STAFF"], requiresReason: true },
    { to: "QUOTED", by: ["STAFF"] },
    { to: "REJECTED", by: ["STAFF"], requiresReason: true },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  NEED_MORE_INFO: [
    // Khách bổ sung thông tin xong thì quay lại hàng chờ xử lý.
    { to: "UNDER_REVIEW", by: ["CUSTOMER", "STAFF"] },
    { to: "REJECTED", by: ["STAFF"], requiresReason: true },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  QUOTED: [
    { to: "NEGOTIATING", by: ["CUSTOMER", "STAFF"] },
    { to: "ACCEPTED", by: ["CUSTOMER"] },
    { to: "REJECTED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  NEGOTIATING: [
    // Nhân viên gửi báo giá phiên bản mới.
    { to: "QUOTED", by: ["STAFF"] },
    { to: "ACCEPTED", by: ["CUSTOMER"] },
    { to: "REJECTED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"], requiresReason: true },
  ],

  ACCEPTED: [
    // Chỉ dispatcher tạo được đơn hàng từ yêu cầu đã chấp nhận.
    { to: "CONVERTED_TO_SHIPMENT", by: ["STAFF"] },
    { to: "CANCELLED", by: ["STAFF"], requiresReason: true },
  ],

  // Bốn trạng thái kết thúc.
  CONVERTED_TO_SHIPMENT: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

/** Trạng thái không còn chuyển đi đâu được nữa. */
export function isTerminal(status: RequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Trạng thái khách hàng còn có thể chỉnh sửa nội dung yêu cầu. */
export function isEditableByCustomer(status: RequestStatus): boolean {
  return status === "DRAFT" || status === "NEED_MORE_INFO";
}

export function allowedTransitions(status: RequestStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

/** Xác định vai trò của actor trong ngữ cảnh state machine. */
export function transitionActorOf(actor: Actor): TransitionActor {
  if (!isAuthenticated(actor)) {
    // Khách chưa đăng nhập thao tác qua magic link vẫn tính là CUSTOMER.
    return "CUSTOMER";
  }
  return actor.permissions.has("request.manage") ? "STAFF" : "CUSTOMER";
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: RequestStatus,
  to: RequestStatus,
  by: TransitionActor,
  options: { reason?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: `Yêu cầu đã ở trạng thái kết thúc (${from}), không thể chuyển tiếp.`,
    };
  }

  const transition = TRANSITIONS[from].find((t) => t.to === to);
  if (!transition) {
    return { allowed: false, reason: `Không thể chuyển từ ${from} sang ${to}.` };
  }

  if (!transition.by.includes(by)) {
    return { allowed: false, reason: `Vai trò ${by} không được phép thực hiện bước này.` };
  }

  if (transition.requiresReason && !options.reason?.trim()) {
    return { allowed: false, reason: "Bước chuyển này bắt buộc nhập lý do." };
  }

  return { allowed: true };
}

/**
 * @throws INVALID_STATE_TRANSITION khi bước chuyển không hợp lệ.
 */
export function assertTransition(
  from: RequestStatus,
  to: RequestStatus,
  by: TransitionActor,
  options: { reason?: string | null } = {}
): void {
  const result = canTransition(from, to, by, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

/** Nhãn tiếng Việt hiển thị cho khách hàng. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã gửi",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  QUOTED: "Đã có báo giá",
  NEGOTIATING: "Đang trao đổi",
  ACCEPTED: "Đã chấp nhận báo giá",
  CONVERTED_TO_SHIPMENT: "Đã tạo đơn hàng",
  REJECTED: "Đã từ chối",
  EXPIRED: "Đã hết hạn",
  CANCELLED: "Đã hủy",
};

/** Mô tả cho khách biết cần làm gì tiếp theo. */
export const REQUEST_STATUS_HINTS: Record<RequestStatus, string> = {
  DRAFT: "Yêu cầu chưa được gửi. Hoàn tất thông tin rồi bấm gửi.",
  SUBMITTED: "Chúng tôi đã nhận được yêu cầu và sẽ liên hệ xác nhận thông tin hàng hóa.",
  UNDER_REVIEW: "Đội ngũ vận hành đang kiểm tra thông tin để lập báo giá.",
  NEED_MORE_INFO: "Cần bạn bổ sung thêm thông tin trước khi chúng tôi báo giá.",
  QUOTED: "Báo giá đã sẵn sàng. Vui lòng xem và phản hồi.",
  NEGOTIATING: "Hai bên đang trao đổi để thống nhất phương án.",
  ACCEPTED: "Bạn đã chấp nhận báo giá. Chúng tôi đang chuẩn bị điều phối phương tiện.",
  CONVERTED_TO_SHIPMENT: "Đơn hàng đã được tạo. Theo dõi tiến trình trong mục Đơn hàng.",
  REJECTED: "Yêu cầu đã bị từ chối. Xem lý do bên dưới.",
  EXPIRED: "Yêu cầu đã quá hạn xử lý. Bạn có thể tạo yêu cầu mới.",
  CANCELLED: "Yêu cầu đã được hủy.",
};

/** Nhóm màu hiển thị badge trạng thái. */
export const REQUEST_STATUS_TONE: Record<
  RequestStatus,
  "neutral" | "orange" | "success" | "warning" | "error"
> = {
  DRAFT: "neutral",
  SUBMITTED: "orange",
  UNDER_REVIEW: "orange",
  NEED_MORE_INFO: "warning",
  QUOTED: "orange",
  NEGOTIATING: "warning",
  ACCEPTED: "success",
  CONVERTED_TO_SHIPMENT: "success",
  REJECTED: "error",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};
