import Decimal from "decimal.js";
import { toStorage } from "@/lib/money";

/**
 * Tính tiền hóa đơn (§20).
 *
 * Module thuần, không chạm database.
 *
 * Dùng Decimal cho mọi phép tính, KHÔNG dùng Float — cùng quy tắc với báo giá (§24.9).
 * Thứ tự tính cố định và giống hệt báo giá: thành tiền dòng → trừ giảm giá → tính thuế trên
 * phần còn lại. Đổi thứ tự sẽ ra số khác, và hóa đơn lệch báo giá là chuyện không giải thích
 * được với khách.
 */

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unit: string;
  /** Chuỗi số nguyên đồng. */
  unitPrice: string;
  discountAmount?: string;
  taxPercent?: number;
}

export interface LineTotals {
  /** Đơn giá × số lượng, trước giảm giá. */
  gross: string;
  discountAmount: string;
  /** Phần chịu thuế sau khi trừ giảm giá dòng. */
  taxable: string;
  taxAmount: string;
  /** Thành tiền dòng đã gồm thuế. */
  lineTotal: string;
}

/**
 * Làm tròn về đồng.
 *
 * VND không có đơn vị nhỏ hơn đồng nên mọi kết quả trung gian phải quy về số nguyên trước
 * khi cộng dồn — cộng các số lẻ rồi mới làm tròn sẽ lệch so với hóa đơn giấy.
 */
function round(value: Decimal): Decimal {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function calculateLine(input: InvoiceLineInput): LineTotals {
  const unitPrice = new Decimal(input.unitPrice);
  const quantity = new Decimal(input.quantity);

  const gross = round(unitPrice.times(quantity));

  const requestedDiscount = new Decimal(input.discountAmount || "0");
  // Giảm giá không vượt quá thành tiền — dòng âm là dấu hiệu nhập sai, không phải hoàn tiền.
  const discountAmount = Decimal.min(requestedDiscount, gross);

  const taxable = gross.minus(discountAmount);
  const taxPercent = new Decimal(input.taxPercent ?? 0);
  const taxAmount = round(taxable.times(taxPercent).dividedBy(100));

  return {
    gross: gross.toFixed(0),
    discountAmount: discountAmount.toFixed(0),
    taxable: taxable.toFixed(0),
    taxAmount: taxAmount.toFixed(0),
    lineTotal: taxable.plus(taxAmount).toFixed(0),
  };
}

export interface InvoiceTotals {
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
}

/**
 * Tổng hóa đơn.
 *
 * `subtotal` là tổng thành tiền TRƯỚC mọi khoản giảm — khớp với cách đọc hóa đơn thông
 * thường, nơi người xem thấy tổng hàng rồi mới thấy các khoản trừ.
 *
 * Giảm giá toàn hóa đơn phân bổ theo tỷ lệ vào phần chịu thuế của từng dòng. Không phân bổ
 * mà trừ thẳng vào tổng cuối sẽ khiến thuế tính trên số tiền khách không thực trả.
 */
export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  invoiceDiscount = "0"
): InvoiceTotals {
  const computed = lines.map(calculateLine);

  const subtotal = computed.reduce((sum, line) => sum.plus(line.gross), new Decimal(0));
  const lineDiscounts = computed.reduce(
    (sum, line) => sum.plus(line.discountAmount),
    new Decimal(0)
  );
  const taxableBase = computed.reduce((sum, line) => sum.plus(line.taxable), new Decimal(0));

  const requestedInvoiceDiscount = new Decimal(invoiceDiscount || "0");
  const extraDiscount = Decimal.min(requestedInvoiceDiscount, taxableBase);

  // Không có phần chịu thuế thì không phân bổ được — tránh chia cho 0.
  const ratio = taxableBase.isZero()
    ? new Decimal(0)
    : taxableBase.minus(extraDiscount).dividedBy(taxableBase);

  const taxAmount = computed.reduce((sum, line) => {
    const adjustedTax = new Decimal(line.taxAmount).times(ratio);
    return sum.plus(round(adjustedTax));
  }, new Decimal(0));

  const totalDiscount = lineDiscounts.plus(extraDiscount);
  const totalAmount = subtotal.minus(totalDiscount).plus(taxAmount);

  return {
    subtotal: subtotal.toFixed(0),
    discountAmount: totalDiscount.toFixed(0),
    taxAmount: taxAmount.toFixed(0),
    totalAmount: totalAmount.toFixed(0),
  };
}

/**
 * Số tiền đã thanh toán và còn nợ.
 *
 * Chỉ tính bản ghi `CONFIRMED`. Khoản `PENDING` là tiền khách báo đã chuyển nhưng kế toán
 * chưa đối chiếu được — coi như đã trả sẽ làm sổ sách sai, và tệ hơn là để đơn hàng đi tiếp
 * dựa trên khoản tiền chưa về (§20).
 */
export function calculateBalance(input: {
  totalAmount: string;
  payments: { amount: string; status: string }[];
}): { paidAmount: string; balanceAmount: string } {
  const paid = input.payments
    .filter((payment) => payment.status === "CONFIRMED")
    .reduce((sum, payment) => sum.plus(new Decimal(payment.amount)), new Decimal(0));

  const total = new Decimal(input.totalAmount);

  return {
    paidAmount: paid.toFixed(0),
    // Trả thừa thì số dư âm — giữ nguyên để kế toán nhìn thấy và xử lý, không kẹp về 0.
    balanceAmount: total.minus(paid).toFixed(0),
  };
}

/** Chuyển chuỗi tiền sang giá trị lưu database. */
export { toStorage };
