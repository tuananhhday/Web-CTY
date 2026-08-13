import { appError } from "@/lib/errors";

/**
 * Vòng đời phiếu hỗ trợ (§19).
 *
 * Module thuần, không chạm database.
 *
 * Khác với state machine của đơn hàng vốn do người dùng chủ động đẩy từng bước, trạng thái
 * phiếu hỗ trợ phần lớn tự suy ra từ HÀNH ĐỘNG: khách nhắn thì tới lượt nhân viên, nhân
 * viên trả lời thì tới lượt khách. Ép người dùng tự chọn trạng thái ở đây là bắt họ làm
 * việc của hệ thống.
 */

export const TICKET_STATUSES = [
  "OPEN",
  "WAITING_FOR_STAFF",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Mới tạo",
  WAITING_FOR_STAFF: "Chờ chúng tôi phản hồi",
  WAITING_FOR_CUSTOMER: "Chờ bạn phản hồi",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
};

export const TICKET_STATUS_TONE: Record<
  TicketStatus,
  "neutral" | "orange" | "success" | "warning"
> = {
  OPEN: "orange",
  WAITING_FOR_STAFF: "warning",
  WAITING_FOR_CUSTOMER: "orange",
  RESOLVED: "success",
  CLOSED: "neutral",
};

/** Phiếu đã kết thúc thì không nhận tin nhắn mới. */
export function isTicketClosed(status: TicketStatus): boolean {
  return status === "CLOSED";
}

/** Phiếu đang chờ nhân viên xử lý — dùng để xếp hàng chờ và tính SLA. */
export function needsStaffAttention(status: TicketStatus): boolean {
  return status === "OPEN" || status === "WAITING_FOR_STAFF";
}

export type Party = "CUSTOMER" | "STAFF";

/**
 * Trạng thái sau khi một bên gửi tin nhắn.
 *
 * Ghi chú nội bộ của nhân viên KHÔNG đổi trạng thái: đó là trao đổi giữa nhân viên với
 * nhau, khách vẫn đang chờ câu trả lời như trước.
 */
export function statusAfterMessage(
  current: TicketStatus,
  author: Party,
  visibility: "INTERNAL" | "CUSTOMER_VISIBLE"
): TicketStatus {
  if (isTicketClosed(current)) return current;

  if (author === "STAFF" && visibility === "INTERNAL") return current;

  if (author === "CUSTOMER") return "WAITING_FOR_STAFF";

  // Nhân viên trả lời khách: bóng sang sân khách.
  return "WAITING_FOR_CUSTOMER";
}

interface Transition {
  to: TicketStatus;
  by: Party[];
  requiresNote?: boolean;
}

/**
 * Chuyển trạng thái THỦ CÔNG.
 *
 * Chỉ dành cho những bước không suy ra được từ tin nhắn: đánh dấu đã xử lý, đóng phiếu,
 * hoặc mở lại khi khách chưa hài lòng.
 */
const TRANSITIONS: Record<TicketStatus, Transition[]> = {
  OPEN: [
    { to: "RESOLVED", by: ["STAFF"], requiresNote: true },
    { to: "CLOSED", by: ["STAFF", "CUSTOMER"] },
  ],

  WAITING_FOR_STAFF: [
    { to: "RESOLVED", by: ["STAFF"], requiresNote: true },
    { to: "CLOSED", by: ["STAFF", "CUSTOMER"] },
  ],

  WAITING_FOR_CUSTOMER: [
    { to: "RESOLVED", by: ["STAFF"], requiresNote: true },
    { to: "CLOSED", by: ["STAFF", "CUSTOMER"] },
  ],

  RESOLVED: [
    // Khách mở lại khi chưa thỏa mãn — không bắt họ tạo phiếu mới và kể lại từ đầu.
    { to: "WAITING_FOR_STAFF", by: ["CUSTOMER"], requiresNote: true },
    { to: "CLOSED", by: ["STAFF", "CUSTOMER"] },
  ],

  // Đóng là kết thúc. Cần tiếp thì tạo phiếu mới, giữ lịch sử từng phiếu rõ ràng.
  CLOSED: [],
};

export function allowedTicketTransitions(status: TicketStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransitionTicket(
  from: TicketStatus,
  to: TicketStatus,
  by: Party,
  options: { note?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  const transition = TRANSITIONS[from].find((candidate) => candidate.to === to);
  if (!transition) {
    return { allowed: false, reason: "Không thể chuyển phiếu sang trạng thái này." };
  }

  if (!transition.by.includes(by)) {
    return {
      allowed: false,
      reason: by === "CUSTOMER" ? "Bạn không thực hiện được bước này." : "Vai trò không phù hợp.",
    };
  }

  if (transition.requiresNote && !options.note?.trim()) {
    return { allowed: false, reason: "Bước này bắt buộc kèm nội dung giải thích." };
  }

  return { allowed: true };
}

export function assertTicketTransition(
  from: TicketStatus,
  to: TicketStatus,
  by: Party,
  options: { note?: string | null } = {}
): void {
  const result = canTransitionTicket(from, to, by, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

// -----------------------------------------------------------------------------
// SLA
// -----------------------------------------------------------------------------

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

/**
 * Hạn phản hồi lần đầu, tính bằng giờ (§19).
 *
 * Đây là SLA NỘI BỘ để xếp thứ tự hàng chờ, KHÔNG phải cam kết với khách hàng. Cam kết dịch
 * vụ là nội dung pháp lý, phải do doanh nghiệp quyết định và công bố (§1) — không hiển thị
 * con số này ở giao diện khách.
 */
const SLA_HOURS: Record<TicketPriority, number> = {
  URGENT: 2,
  HIGH: 8,
  NORMAL: 24,
  LOW: 72,
};

export function slaDueAt(priority: TicketPriority, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3_600_000);
}

/** Phiếu đã quá hạn phản hồi nội bộ. */
export function isOverdue(
  ticket: { status: TicketStatus; slaDueAt: Date | null; firstRespondedAt: Date | null },
  now: Date = new Date()
): boolean {
  if (!ticket.slaDueAt) return false;
  if (ticket.firstRespondedAt !== null) return false;
  if (!needsStaffAttention(ticket.status)) return false;

  return ticket.slaDueAt.getTime() < now.getTime();
}

export const TICKET_TYPES = ["QUESTION", "COMPLAINT", "COMPENSATION", "INVOICE", "OTHER"] as const;

export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  QUESTION: "Câu hỏi",
  COMPLAINT: "Khiếu nại",
  COMPENSATION: "Yêu cầu bồi thường",
  INVOICE: "Hóa đơn, thanh toán",
  OTHER: "Khác",
};

/**
 * Mức ưu tiên mặc định theo loại phiếu.
 *
 * Khách KHÔNG tự chọn mức ưu tiên: ai cũng sẽ chọn "khẩn cấp" và mức ưu tiên mất hết ý
 * nghĩa. Hệ thống suy ra từ loại phiếu, nhân viên điều chỉnh sau nếu cần.
 */
export function defaultPriorityFor(type: TicketType): TicketPriority {
  const MAP: Record<TicketType, TicketPriority> = {
    COMPLAINT: "HIGH",
    COMPENSATION: "HIGH",
    INVOICE: "NORMAL",
    QUESTION: "NORMAL",
    OTHER: "NORMAL",
  };
  return MAP[type];
}
