import { Decimal } from "decimal.js";
import { money, add, multiply, percentOf, subtract, ZERO } from "@/lib/money";

/**
 * Tính tiền báo giá (§13.3, §24.9).
 *
 * Module thuần: không chạm database, kiểm thử được độc lập.
 *
 * TUYỆT ĐỐI không dùng Float. Mọi phép tính đi qua Decimal.js — cộng dồn hàng chục dòng
 * với số tiền hàng triệu đồng bằng Float sẽ sai lệch từng đồng, và sai lệch đó xuất hiện
 * trên chứng từ gửi khách.
 */

export interface LineItemInput {
  description: string;
  category: string;
  /** Số lượng có thể lẻ, ví dụ 2,5 tấn hoặc 1,5 giờ. */
  quantity: number;
  unit: string;
  unitPrice: string | number;
  discountAmount?: string | number;
  /** Phần trăm thuế, ví dụ 8 nghĩa là 8%. */
  taxPercent?: number;
}

export interface LineItemTotals {
  /** Thành tiền trước giảm giá: đơn giá × số lượng. */
  subtotal: Decimal;
  discount: Decimal;
  tax: Decimal;
  /** Tổng dòng sau giảm giá và thuế. */
  lineTotal: Decimal;
}

export interface QuoteTotals {
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  /** Tỷ lệ giảm giá trên tổng thành tiền, dùng để so với ngưỡng duyệt. */
  discountPercent: number;
}

/**
 * Tính một dòng báo giá.
 *
 * Thứ tự bắt buộc: thành tiền → trừ giảm giá → tính thuế TRÊN PHẦN CÒN LẠI.
 * Tính thuế trước khi trừ giảm giá sẽ khiến khách phải trả thuế cho phần được giảm.
 */
export function calculateLineItem(input: LineItemInput): LineItemTotals {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error(`Số lượng phải là số dương: ${input.quantity}`);
  }

  const subtotal = multiply(input.unitPrice, input.quantity);
  const discount = money(input.discountAmount ?? 0);

  if (discount.isNegative()) {
    throw new Error("Giảm giá không được âm.");
  }
  if (discount.greaterThan(subtotal)) {
    throw new Error("Giảm giá của một dòng không được lớn hơn thành tiền của dòng đó.");
  }

  const afterDiscount = subtract(subtotal, discount);

  const taxPercent = input.taxPercent ?? 0;
  if (taxPercent < 0 || taxPercent > 100) {
    throw new Error(`Thuế suất không hợp lệ: ${taxPercent}%`);
  }

  const tax = taxPercent > 0 ? percentOf(afterDiscount, taxPercent) : ZERO;

  return {
    subtotal,
    discount,
    tax,
    lineTotal: add(afterDiscount, tax),
  };
}

/**
 * Tổng hợp toàn bộ báo giá từ danh sách dòng.
 *
 * @param extraDiscount giảm giá áp cho cả báo giá, ngoài phần giảm của từng dòng
 */
export function calculateQuoteTotals(
  items: LineItemInput[],
  extraDiscount: string | number = 0
): QuoteTotals {
  if (items.length === 0) {
    throw new Error("Báo giá phải có ít nhất một dòng.");
  }

  let subtotal = ZERO;
  let lineDiscounts = ZERO;
  let taxAmount = ZERO;

  for (const item of items) {
    const totals = calculateLineItem(item);
    subtotal = add(subtotal, totals.subtotal);
    lineDiscounts = add(lineDiscounts, totals.discount);
    taxAmount = add(taxAmount, totals.tax);
  }

  const wholeQuoteDiscount = money(extraDiscount);
  if (wholeQuoteDiscount.isNegative()) {
    throw new Error("Giảm giá tổng không được âm.");
  }

  const discountAmount = add(lineDiscounts, wholeQuoteDiscount);
  if (discountAmount.greaterThan(subtotal)) {
    throw new Error("Tổng giảm giá không được lớn hơn tổng thành tiền.");
  }

  const totalAmount = add(subtract(subtotal, discountAmount), taxAmount);

  // Chia cho 0 khi tổng thành tiền bằng 0 — trả về 0% thay vì NaN.
  const discountPercent = subtotal.isZero()
    ? 0
    : Number(discountAmount.dividedBy(subtotal).times(100).toFixed(2));

  return { subtotal, discountAmount, taxAmount, totalAmount, discountPercent };
}

// -----------------------------------------------------------------------------
// Ngưỡng duyệt (§13.3)
// -----------------------------------------------------------------------------

export interface ApprovalThresholds {
  /** Tổng tiền vượt mức này thì phải có người duyệt. */
  maxAmountWithoutApproval: string | number;
  /** Tỷ lệ giảm giá vượt mức này thì phải có người duyệt. */
  maxDiscountPercent: number;
}

export interface ApprovalDecision {
  required: boolean;
  /** Lý do cần duyệt, hiển thị cho người lập báo giá biết vì sao. */
  reasons: string[];
}

/**
 * Báo giá này có cần người duyệt trước khi gửi khách không.
 *
 * Kiểm tra ĐỘC LẬP hai điều kiện và gộp lý do — người lập cần biết chính xác vì sao,
 * không chỉ biết "cần duyệt".
 */
export function requiresApproval(
  totals: Pick<QuoteTotals, "totalAmount" | "discountPercent">,
  thresholds: ApprovalThresholds
): ApprovalDecision {
  const reasons: string[] = [];

  const amountLimit = money(thresholds.maxAmountWithoutApproval);
  if (totals.totalAmount.greaterThan(amountLimit)) {
    reasons.push(
      `Tổng tiền vượt ngưỡng ${amountLimit.toFixed(0)} đ được phép gửi không cần duyệt.`
    );
  }

  if (totals.discountPercent > thresholds.maxDiscountPercent) {
    reasons.push(
      `Mức giảm giá ${totals.discountPercent}% vượt ngưỡng ${thresholds.maxDiscountPercent}%.`
    );
  }

  return { required: reasons.length > 0, reasons };
}

/**
 * Báo giá đã hết hạn chưa (§13.3).
 * Không có hạn thì coi như còn hiệu lực — nghiệp vụ tự quyết định có đặt hạn hay không.
 */
export function isQuoteExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/** Số ngày còn lại tới hạn. Trả về null khi không đặt hạn, số âm khi đã quá hạn. */
export function daysUntilExpiry(expiresAt: Date | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
}
