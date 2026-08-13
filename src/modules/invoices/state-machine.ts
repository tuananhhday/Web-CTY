import Decimal from "decimal.js";
import { appError } from "@/lib/errors";

/**
 * Vòng đời hóa đơn (§20).
 *
 * Module thuần, không chạm database.
 *
 * Điểm khác biệt so với các state machine trước: phần lớn trạng thái hóa đơn KHÔNG do người
 * dùng chọn mà SUY RA TỪ SỐ TIỀN. Trả đủ thì `PAID`, trả một phần thì `PARTIALLY_PAID`, quá
 * hạn mà chưa trả đủ thì `OVERDUE`. Để nhân viên tự đặt trạng thái là mở đường cho sổ sách
 * lệch với thực tế thu tiền.
 */

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Nháp",
  ISSUED: "Đã phát hành",
  PARTIALLY_PAID: "Đã thanh toán một phần",
  PAID: "Đã thanh toán đủ",
  OVERDUE: "Quá hạn",
  VOID: "Đã hủy",
};

export const INVOICE_STATUS_TONE: Record<
  InvoiceStatus,
  "neutral" | "orange" | "success" | "warning" | "error"
> = {
  DRAFT: "neutral",
  ISSUED: "orange",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  VOID: "neutral",
};

/** Hóa đơn nháp còn sửa được nội dung; đã phát hành thì không. */
export function isEditable(status: InvoiceStatus): boolean {
  return status === "DRAFT";
}

/** Hóa đơn đã khép lại — không nhận thanh toán mới. */
export function isClosed(status: InvoiceStatus): boolean {
  return status === "PAID" || status === "VOID";
}

/**
 * Trạng thái suy ra từ số tiền và hạn thanh toán.
 *
 * `DRAFT` và `VOID` không suy ra được — chúng là quyết định của con người, nên hàm giữ
 * nguyên nếu hóa đơn đang ở một trong hai trạng thái đó.
 */
export function deriveStatus(input: {
  current: InvoiceStatus;
  totalAmount: string;
  paidAmount: string;
  dueAt: Date | null;
  now?: Date;
}): InvoiceStatus {
  if (input.current === "DRAFT" || input.current === "VOID") return input.current;

  const total = new Decimal(input.totalAmount);
  const paid = new Decimal(input.paidAmount);
  const now = input.now ?? new Date();

  // Trả đủ hoặc thừa đều là đã thanh toán xong; phần thừa xử lý riêng ở nghiệp vụ hoàn tiền.
  if (paid.greaterThanOrEqualTo(total) && total.greaterThan(0)) return "PAID";

  // Quá hạn xét TRƯỚC trả một phần: hóa đơn trả 10% và đã quá hạn thì vấn đề là quá hạn.
  if (input.dueAt !== null && input.dueAt.getTime() < now.getTime()) return "OVERDUE";

  if (paid.greaterThan(0)) return "PARTIALLY_PAID";

  return "ISSUED";
}

interface Transition {
  to: InvoiceStatus;
  requiresReason?: boolean;
}

/**
 * Chuyển trạng thái THỦ CÔNG.
 *
 * Chỉ có hai bước: phát hành hóa đơn nháp, và hủy hóa đơn. Mọi thay đổi khác đi qua
 * `deriveStatus` khi ghi nhận thanh toán.
 */
const TRANSITIONS: Record<InvoiceStatus, Transition[]> = {
  DRAFT: [{ to: "ISSUED" }, { to: "VOID", requiresReason: true }],
  ISSUED: [{ to: "VOID", requiresReason: true }],
  PARTIALLY_PAID: [{ to: "VOID", requiresReason: true }],
  OVERDUE: [{ to: "VOID", requiresReason: true }],

  // Đã thu đủ tiền thì không hủy được. Cần điều chỉnh thì lập chứng từ hoàn tiền —
  // hủy hóa đơn đã thanh toán sẽ làm mất dấu khoản tiền đã nhận (§20).
  PAID: [],
  VOID: [],
};

export function allowedInvoiceTransitions(status: InvoiceStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransitionInvoice(
  from: InvoiceStatus,
  to: InvoiceStatus,
  options: { reason?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  const transition = TRANSITIONS[from].find((candidate) => candidate.to === to);
  if (!transition) {
    if (from === "PAID") {
      return {
        allowed: false,
        reason: "Hóa đơn đã thanh toán đủ. Cần điều chỉnh thì lập chứng từ hoàn tiền.",
      };
    }
    return { allowed: false, reason: "Không thể chuyển hóa đơn sang trạng thái này." };
  }

  if (transition.requiresReason && !options.reason?.trim()) {
    return { allowed: false, reason: "Hủy hóa đơn bắt buộc ghi rõ lý do." };
  }

  return { allowed: true };
}

export function assertInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
  options: { reason?: string | null } = {}
): void {
  const result = canTransitionInvoice(from, to, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

// -----------------------------------------------------------------------------
// Thanh toán
// -----------------------------------------------------------------------------

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "OTHER"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  OTHER: "Khác",
};

export const PAYMENT_STATUSES = ["PENDING", "CONFIRMED", "REVERSED"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Chờ đối chiếu",
  CONFIRMED: "Đã xác nhận",
  REVERSED: "Đã hoàn/hủy",
};

export const PAYMENT_STATUS_TONE: Record<
  PaymentStatus,
  "neutral" | "warning" | "success" | "error"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REVERSED: "error",
};

/**
 * Hóa đơn có nhận được thanh toán mới không.
 *
 * Nháp thì chưa: khách chưa nhận được chứng từ nào để mà trả. Đã hủy hoặc đã trả đủ thì
 * cũng không.
 */
export function canAcceptPayment(status: InvoiceStatus): TransitionCheck {
  if (status === "DRAFT") {
    return { allowed: false, reason: "Hóa đơn chưa phát hành, chưa ghi nhận thanh toán được." };
  }
  if (status === "VOID") {
    return { allowed: false, reason: "Hóa đơn đã hủy." };
  }
  if (status === "PAID") {
    return { allowed: false, reason: "Hóa đơn đã thanh toán đủ." };
  }
  return { allowed: true };
}

/**
 * Đảo một khoản thanh toán đã ghi nhận.
 *
 * Không xóa bản ghi mà chuyển sang `REVERSED` kèm lý do: khoản tiền đã từng được ghi nhận
 * là sự kiện có thật, xóa đi là làm mất dấu vết đối chiếu (§20).
 */
export function canReversePayment(status: PaymentStatus): TransitionCheck {
  if (status === "REVERSED") {
    return { allowed: false, reason: "Khoản này đã được đảo trước đó." };
  }
  return { allowed: true };
}
