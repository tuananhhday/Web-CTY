import { Decimal } from "decimal.js";

/**
 * Tiền tệ VND (§13.1, §24.9).
 *
 * Quy tắc: KHÔNG dùng Float ở bất kỳ đâu. Database lưu Decimal(18,0) — VND không có
 * đơn vị nhỏ hơn đồng nên phần thập phân luôn bằng 0. Mọi phép tính đi qua Decimal.js
 * để tránh sai số cộng dồn khi tính line item, giảm giá và thuế.
 */

export const CURRENCY = "VND" as const;

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

/** Tạo giá trị tiền, làm tròn về số nguyên đồng. */
export function money(value: MoneyInput): Decimal {
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new Error(`Giá trị tiền không hợp lệ: ${String(value)}`);
  }
  return d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export const ZERO = money(0);

export function add(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((sum, v) => sum.plus(money(v)), ZERO);
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return money(money(a).minus(money(b)));
}

/** Nhân tiền với số lượng (số lượng có thể là số lẻ, ví dụ 2.5 tấn). */
export function multiply(amount: MoneyInput, quantity: number): Decimal {
  if (!Number.isFinite(quantity)) {
    throw new Error(`Số lượng không hợp lệ: ${quantity}`);
  }
  return money(money(amount).times(quantity));
}

/** Tính theo phần trăm, ví dụ thuế 8% hoặc giảm giá 10%. */
export function percentOf(amount: MoneyInput, percent: number): Decimal {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error(`Phần trăm không hợp lệ: ${percent}`);
  }
  return money(money(amount).times(percent).dividedBy(100));
}

export function isNegative(value: MoneyInput): boolean {
  return money(value).isNegative();
}

/** Ràng buộc nghiệp vụ: tiền trong hệ thống không được âm (§24.9). */
export function assertNonNegative(value: MoneyInput, label = "Số tiền"): Decimal {
  const d = money(value);
  if (d.isNegative()) {
    throw new Error(`${label} không được âm.`);
  }
  return d;
}

/** Chuỗi để lưu vào cột Decimal của Prisma. */
export function toStorage(value: MoneyInput): string {
  return money(value).toFixed(0);
}

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const plainFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Hiển thị đầy đủ, ví dụ: 1.500.000 ₫ */
export function formatMoney(value: MoneyInput): string {
  return vndFormatter.format(money(value).toNumber());
}

/** Hiển thị không kèm ký hiệu, ví dụ: 1.500.000 */
export function formatAmount(value: MoneyInput): string {
  return plainFormatter.format(money(value).toNumber());
}

/**
 * Tổng hợp một dòng báo giá/hoá đơn.
 * Thứ tự tính: thành tiền → trừ giảm giá → cộng thuế trên phần còn lại.
 */
export function calculateLineTotal(input: {
  unitPrice: MoneyInput;
  quantity: number;
  discountAmount?: MoneyInput;
  taxPercent?: number;
}): { subtotal: Decimal; discount: Decimal; tax: Decimal; total: Decimal } {
  const subtotal = multiply(input.unitPrice, input.quantity);
  const discount = assertNonNegative(input.discountAmount ?? 0, "Giảm giá");

  if (discount.greaterThan(subtotal)) {
    throw new Error("Giảm giá không được lớn hơn thành tiền.");
  }

  const afterDiscount = subtract(subtotal, discount);
  const tax = input.taxPercent ? percentOf(afterDiscount, input.taxPercent) : ZERO;

  return { subtotal, discount, tax, total: add(afterDiscount, tax) };
}
