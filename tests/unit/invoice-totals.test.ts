import { describe, it, expect } from "vitest";
import {
  calculateLine,
  calculateInvoiceTotals,
  calculateBalance,
  type InvoiceLineInput,
} from "@/modules/invoices/totals";

/** Tiền tệ VND: Decimal, không Float, làm tròn về đồng (§20, §24.9). */

function line(overrides: Partial<InvoiceLineInput> = {}): InvoiceLineInput {
  return {
    description: "Cước vận chuyển",
    quantity: 1,
    unit: "chuyến",
    unitPrice: "3500000",
    ...overrides,
  };
}

describe("calculateLine", () => {
  it("nhân đơn giá với số lượng", () => {
    expect(calculateLine(line({ quantity: 3 })).gross).toBe("10500000");
  });

  it("trừ giảm giá trước khi tính thuế", () => {
    const result = calculateLine(line({ discountAmount: "500000", taxPercent: 10 }));

    expect(result.taxable).toBe("3000000");
    expect(result.taxAmount).toBe("300000");
    expect(result.lineTotal).toBe("3300000");
  });

  it("không có thuế thì thành tiền bằng phần chịu thuế", () => {
    const result = calculateLine(line());
    expect(result.taxAmount).toBe("0");
    expect(result.lineTotal).toBe(result.taxable);
  });

  it("giảm giá không vượt quá thành tiền — dòng không bao giờ âm", () => {
    const result = calculateLine(line({ unitPrice: "100000", discountAmount: "999999999" }));

    expect(result.discountAmount).toBe("100000");
    expect(result.taxable).toBe("0");
    expect(result.lineTotal).toBe("0");
  });

  it("làm tròn về đồng, không để lại số lẻ", () => {
    // 1.000.001 × 3 × 8,25% = 247.500,2475 → 247.500
    const result = calculateLine(line({ unitPrice: "1000001", quantity: 3, taxPercent: 8.25 }));

    expect(result.taxAmount).toMatch(/^\d+$/);
    expect(result.lineTotal).toMatch(/^\d+$/);
  });

  it("số lượng thập phân vẫn tính đúng", () => {
    // 2,5 tấn × 400.000 = 1.000.000
    expect(calculateLine(line({ quantity: 2.5, unitPrice: "400000" })).gross).toBe("1000000");
  });

  it("giữ chính xác với số tiền rất lớn — không mất chữ số như Float", () => {
    const result = calculateLine(line({ unitPrice: "999999999999", quantity: 1 }));
    expect(result.gross).toBe("999999999999");
  });
});

describe("calculateInvoiceTotals", () => {
  it("cộng dồn nhiều dòng", () => {
    const totals = calculateInvoiceTotals([
      line({ unitPrice: "1000000" }),
      line({ unitPrice: "2000000" }),
    ]);

    expect(totals.subtotal).toBe("3000000");
    expect(totals.totalAmount).toBe("3000000");
  });

  it("subtotal là tổng TRƯỚC mọi khoản giảm", () => {
    const totals = calculateInvoiceTotals([line({ unitPrice: "1000000", discountAmount: "100000" })]);

    expect(totals.subtotal).toBe("1000000");
    expect(totals.discountAmount).toBe("100000");
    expect(totals.totalAmount).toBe("900000");
  });

  it("cộng cả giảm giá dòng và giảm giá toàn hóa đơn", () => {
    const totals = calculateInvoiceTotals(
      [line({ unitPrice: "1000000", discountAmount: "100000" })],
      "200000"
    );

    expect(totals.discountAmount).toBe("300000");
    expect(totals.totalAmount).toBe("700000");
  });

  it("giảm giá toàn hóa đơn không vượt quá phần chịu thuế", () => {
    const totals = calculateInvoiceTotals([line({ unitPrice: "500000" })], "999999999");

    expect(totals.discountAmount).toBe("500000");
    expect(totals.totalAmount).toBe("0");
  });

  it("giảm giá toàn hóa đơn làm giảm cả thuế theo tỷ lệ", () => {
    // Không giảm: 1.000.000 + 10% = 1.100.000
    const withoutDiscount = calculateInvoiceTotals([line({ unitPrice: "1000000", taxPercent: 10 })]);
    expect(withoutDiscount.taxAmount).toBe("100000");

    // Giảm 50%: thuế cũng phải giảm còn một nửa, vì khách chỉ trả trên phần thực tế.
    const withDiscount = calculateInvoiceTotals(
      [line({ unitPrice: "1000000", taxPercent: 10 })],
      "500000"
    );
    expect(withDiscount.taxAmount).toBe("50000");
    expect(withDiscount.totalAmount).toBe("550000");
  });

  it("hóa đơn rỗng cho toàn số 0, không ném lỗi chia cho 0", () => {
    const totals = calculateInvoiceTotals([], "100000");

    expect(totals.subtotal).toBe("0");
    expect(totals.taxAmount).toBe("0");
    expect(totals.totalAmount).toBe("0");
  });

  it("mọi kết quả đều là chuỗi số nguyên", () => {
    const totals = calculateInvoiceTotals(
      [line({ unitPrice: "333333", quantity: 3, taxPercent: 7.5 })],
      "12345"
    );

    for (const [key, value] of Object.entries(totals)) {
      expect(value, key).toMatch(/^-?\d+$/);
    }
  });
});

describe("calculateBalance", () => {
  it("chỉ tính khoản đã XÁC NHẬN", () => {
    const result = calculateBalance({
      totalAmount: "1000000",
      payments: [
        { amount: "400000", status: "CONFIRMED" },
        { amount: "600000", status: "PENDING" },
      ],
    });

    expect(result.paidAmount).toBe("400000");
    expect(result.balanceAmount).toBe("600000");
  });

  it("khoản đã đảo không tính vào số đã trả", () => {
    const result = calculateBalance({
      totalAmount: "1000000",
      payments: [
        { amount: "1000000", status: "CONFIRMED" },
        { amount: "1000000", status: "REVERSED" },
      ],
    });

    expect(result.paidAmount).toBe("1000000");
    expect(result.balanceAmount).toBe("0");
  });

  it("trả thừa cho số dư ÂM để kế toán nhìn thấy, không kẹp về 0", () => {
    const result = calculateBalance({
      totalAmount: "1000000",
      payments: [{ amount: "1200000", status: "CONFIRMED" }],
    });

    expect(result.balanceAmount).toBe("-200000");
  });

  it("chưa có khoản nào thì nợ toàn bộ", () => {
    const result = calculateBalance({ totalAmount: "1000000", payments: [] });

    expect(result.paidAmount).toBe("0");
    expect(result.balanceAmount).toBe("1000000");
  });

  it("cộng nhiều khoản đã xác nhận", () => {
    const result = calculateBalance({
      totalAmount: "1000000",
      payments: [
        { amount: "300000", status: "CONFIRMED" },
        { amount: "300000", status: "CONFIRMED" },
        { amount: "400000", status: "CONFIRMED" },
      ],
    });

    expect(result.paidAmount).toBe("1000000");
    expect(result.balanceAmount).toBe("0");
  });
});
