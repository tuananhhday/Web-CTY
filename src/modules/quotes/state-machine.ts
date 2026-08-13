import { appError } from "@/lib/errors";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";

/**
 * State machine cho báo giá (§13.3).
 *
 * Module thuần, không chạm database.
 *
 * Nguyên tắc quan trọng nhất: **revision đã được khách chấp nhận không bao giờ bị sửa**.
 * Muốn đổi thì tạo revision mới. Nhờ vậy hai bên luôn đối chiếu được đúng thứ đã thống nhất.
 */

export const QUOTE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SENT",
  "VIEWED",
  "NEGOTIATING",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/**
 * Vai trò trong ngữ cảnh báo giá.
 *
 * Tách `PREPARER` (người lập) khỏi `APPROVER` (người duyệt) vì §13.3 yêu cầu báo giá
 * vượt ngưỡng phải có người CÓ QUYỀN duyệt — không để người lập tự duyệt báo giá của mình.
 */
type QuoteActor = "CUSTOMER" | "PREPARER" | "APPROVER" | "SYSTEM";

interface Transition {
  to: QuoteStatus;
  by: QuoteActor[];
  requiresReason?: boolean;
}

const TRANSITIONS: Record<QuoteStatus, Transition[]> = {
  DRAFT: [
    // Vượt ngưỡng thì phải qua duyệt; dưới ngưỡng gửi thẳng. Service quyết định đích đến.
    { to: "PENDING_APPROVAL", by: ["PREPARER", "APPROVER"] },
    { to: "SENT", by: ["PREPARER", "APPROVER"] },
    { to: "CANCELLED", by: ["PREPARER", "APPROVER"], requiresReason: true },
  ],

  PENDING_APPROVAL: [
    { to: "SENT", by: ["APPROVER"] },
    // Người duyệt trả về để người lập sửa lại.
    { to: "DRAFT", by: ["APPROVER"], requiresReason: true },
    { to: "CANCELLED", by: ["APPROVER"], requiresReason: true },
  ],

  SENT: [
    // Hệ thống ghi nhận khi khách mở xem lần đầu.
    { to: "VIEWED", by: ["SYSTEM", "CUSTOMER"] },
    { to: "ACCEPTED", by: ["CUSTOMER"] },
    { to: "DECLINED", by: ["CUSTOMER"], requiresReason: true },
    { to: "NEGOTIATING", by: ["CUSTOMER", "PREPARER", "APPROVER"] },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["PREPARER", "APPROVER"], requiresReason: true },
  ],

  VIEWED: [
    { to: "ACCEPTED", by: ["CUSTOMER"] },
    { to: "DECLINED", by: ["CUSTOMER"], requiresReason: true },
    { to: "NEGOTIATING", by: ["CUSTOMER", "PREPARER", "APPROVER"] },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["PREPARER", "APPROVER"], requiresReason: true },
  ],

  NEGOTIATING: [
    // Nhân viên gửi revision mới: quay lại SENT hoặc chờ duyệt nếu vượt ngưỡng.
    { to: "SENT", by: ["PREPARER", "APPROVER"] },
    { to: "PENDING_APPROVAL", by: ["PREPARER"] },
    { to: "ACCEPTED", by: ["CUSTOMER"] },
    { to: "DECLINED", by: ["CUSTOMER"], requiresReason: true },
    { to: "EXPIRED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["PREPARER", "APPROVER"], requiresReason: true },
  ],

  // Ba trạng thái kết thúc.
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function isTerminal(status: QuoteStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Nhân viên còn sửa được nội dung báo giá không.
 * Sau khi gửi đi thì phải tạo revision mới thay vì sửa bản đang có (§13.3).
 */
export function isEditable(status: QuoteStatus): boolean {
  return status === "DRAFT";
}

/** Khách hàng thấy được báo giá ở những trạng thái nào. */
export function isVisibleToCustomer(status: QuoteStatus): boolean {
  return !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(status);
}

export function allowedTransitions(status: QuoteStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

/**
 * Xác định vai trò của actor.
 * `quote.approve` là quyền quyết định — chỉ ADMIN và SUPER_ADMIN có (§8).
 */
export function quoteActorOf(actor: Actor): QuoteActor {
  if (!isAuthenticated(actor)) return "CUSTOMER";
  if (actor.permissions.has("quote.approve")) return "APPROVER";
  if (actor.permissions.has("quote.create")) return "PREPARER";
  return "CUSTOMER";
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  by: QuoteActor,
  options: { reason?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: `Báo giá đã ở trạng thái kết thúc (${from}). Tạo báo giá mới nếu cần thay đổi.`,
    };
  }

  const transition = TRANSITIONS[from].find((t) => t.to === to);
  if (!transition) {
    return { allowed: false, reason: `Không thể chuyển báo giá từ ${from} sang ${to}.` };
  }

  if (!transition.by.includes(by)) {
    return { allowed: false, reason: `Vai trò ${by} không được phép thực hiện bước này.` };
  }

  if (transition.requiresReason && !options.reason?.trim()) {
    return { allowed: false, reason: "Bước chuyển này bắt buộc nhập lý do." };
  }

  return { allowed: true };
}

export function assertTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  by: QuoteActor,
  options: { reason?: string | null } = {}
): void {
  const result = canTransition(from, to, by, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  SENT: "Đã gửi khách",
  VIEWED: "Khách đã xem",
  NEGOTIATING: "Đang thương lượng",
  ACCEPTED: "Khách đã chấp nhận",
  DECLINED: "Khách đã từ chối",
  EXPIRED: "Đã hết hạn",
  CANCELLED: "Đã hủy",
};

export const QUOTE_STATUS_HINTS: Record<QuoteStatus, string> = {
  DRAFT: "Báo giá đang soạn, khách hàng chưa nhìn thấy.",
  PENDING_APPROVAL: "Đang chờ người có thẩm quyền duyệt trước khi gửi khách.",
  SENT: "Đã gửi tới khách hàng, đang chờ phản hồi.",
  VIEWED: "Khách hàng đã mở xem báo giá.",
  NEGOTIATING: "Hai bên đang trao đổi để điều chỉnh phương án.",
  ACCEPTED: "Khách đã chấp nhận. Có thể tạo đơn hàng từ báo giá này.",
  DECLINED: "Khách đã từ chối. Xem lý do trong lịch sử.",
  EXPIRED: "Báo giá đã quá hạn hiệu lực. Cần lập báo giá mới nếu khách vẫn quan tâm.",
  CANCELLED: "Báo giá đã bị hủy.",
};

export const QUOTE_STATUS_TONE: Record<
  QuoteStatus,
  "neutral" | "orange" | "success" | "warning" | "error"
> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  SENT: "orange",
  VIEWED: "orange",
  NEGOTIATING: "warning",
  ACCEPTED: "success",
  DECLINED: "error",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};
