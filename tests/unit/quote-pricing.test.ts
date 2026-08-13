import { describe, it, expect } from "vitest";
import {
  calculateLineItem,
  calculateQuoteTotals,
  requiresApproval,
  isQuoteExpired,
  daysUntilExpiry,
  type LineItemInput,
} from "@/modules/quotes/pricing";

function line(overrides: Partial<LineItemInput> = {}): LineItemInput {
  return {
    description: "Cước vận chuyển",
    category: "TRANSPORT",
    quantity: 1,
    unit: "chuyến",
    unitPrice: "1000000",
    ...overrides,
  };
}

describe("calculateLineItem — thứ tự tính", () => {
  it("tính thuế TRÊN phần còn lại sau giảm giá, không phải trên thành tiền", () => {
    const result = calculateLineItem(
      line({ unitPrice: "1000000", quantity: 2, discountAmount: "200000", taxPercent: 8 })
    );

    expect(result.subtotal.toString()).toBe("2000000");
    expect(result.discount.toString()).toBe("200000");
    // 8% của 1.800.000 = 144.000. Nếu tính trên 2.000.000 sẽ ra 160.000 — khách phải
    // trả thuế cho cả phần được giảm.
    expect(result.tax.toString()).toBe("144000");
    expect(result.lineTotal.toString()).toBe("1944000");
  });

  it("không thuế thì tổng dòng bằng thành tiền trừ giảm giá", () => {
    const result = calculateLineItem(line({ unitPrice: "500000", quantity: 3, discountAmount: "100000" }));
    expect(result.lineTotal.toString()).toBe("1400000");
  });

  it("hỗ trợ số lượng lẻ, ví dụ 2,5 tấn", () => {
    const result = calculateLineItem(line({ unitPrice: "400000", quantity: 2.5, unit: "tấn" }));
    expect(result.lineTotal.toString()).toBe("1000000");
  });
});

describe("calculateLineItem — chặn giá trị vô lý", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("từ chối số lượng %s", (quantity) => {
    expect(() => calculateLineItem(line({ quantity }))).toThrow(/Số lượng/);
  });

  it("từ chối giảm giá âm", () => {
    expect(() => calculateLineItem(line({ discountAmount: "-1000" }))).toThrow(/không được âm/);
  });

  it("từ chối giảm giá lớn hơn thành tiền của dòng", () => {
    expect(() =>
      calculateLineItem(line({ unitPrice: "100000", quantity: 1, discountAmount: "200000" }))
    ).toThrow(/lớn hơn thành tiền/);
  });

  it.each([-5, 101, 150])("từ chối thuế suất %s%%", (taxPercent) => {
    expect(() => calculateLineItem(line({ taxPercent }))).toThrow(/Thuế suất/);
  });

  it("chấp nhận thuế suất biên 0% và 100%", () => {
    expect(() => calculateLineItem(line({ taxPercent: 0 }))).not.toThrow();
    expect(() => calculateLineItem(line({ taxPercent: 100 }))).not.toThrow();
  });
});

describe("calculateQuoteTotals", () => {
  it("cộng dồn nhiều dòng chính xác", () => {
    const totals = calculateQuoteTotals([
      line({ unitPrice: "1500000", quantity: 1 }),
      line({ description: "Bốc xếp", category: "LABOR", unitPrice: "300000", quantity: 4, unit: "giờ" }),
    ]);

    expect(totals.subtotal.toString()).toBe("2700000");
    expect(totals.totalAmount.toString()).toBe("2700000");
  });

  it("không sai số khi cộng dồn nhiều dòng lẻ", () => {
    // 33 dòng × 333.333 đ. Float sẽ tích luỹ sai số; Decimal thì không.
    const items = Array.from({ length: 33 }, () => line({ unitPrice: "333333", quantity: 1 }));
    const totals = calculateQuoteTotals(items);
    expect(totals.subtotal.toString()).toBe("10999989");
  });

  it("gộp giảm giá từng dòng với giảm giá toàn báo giá", () => {
    const totals = calculateQuoteTotals(
      [
        line({ unitPrice: "1000000", quantity: 1, discountAmount: "100000" }),
        line({ unitPrice: "1000000", quantity: 1 }),
      ],
      "300000"
    );

    expect(totals.subtotal.toString()).toBe("2000000");
    expect(totals.discountAmount.toString()).toBe("400000");
    expect(totals.totalAmount.toString()).toBe("1600000");
  });

  it("tính đúng tỷ lệ giảm giá để đối chiếu ngưỡng duyệt", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "1000000", quantity: 1 })], "150000");
    expect(totals.discountPercent).toBe(15);
  });

  it("từ chối báo giá rỗng", () => {
    expect(() => calculateQuoteTotals([])).toThrow(/ít nhất một dòng/);
  });

  it("từ chối tổng giảm giá vượt tổng thành tiền", () => {
    expect(() =>
      calculateQuoteTotals([line({ unitPrice: "1000000", quantity: 1 })], "1500000")
    ).toThrow(/lớn hơn tổng thành tiền/);
  });

  it("từ chối giảm giá tổng âm", () => {
    expect(() => calculateQuoteTotals([line()], "-100")).toThrow(/không được âm/);
  });

  it("tỷ lệ giảm giá bằng 0 khi tổng bằng 0, không trả NaN", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "0", quantity: 1 })]);
    expect(totals.discountPercent).toBe(0);
    expect(Number.isNaN(totals.discountPercent)).toBe(false);
  });
});

describe("requiresApproval — ngưỡng duyệt (§13.3)", () => {
  const thresholds = { maxAmountWithoutApproval: "20000000", maxDiscountPercent: 15 };

  it("không cần duyệt khi dưới cả hai ngưỡng", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "5000000", quantity: 1 })]);
    const decision = requiresApproval(totals, thresholds);
    expect(decision.required).toBe(false);
    expect(decision.reasons).toEqual([]);
  });

  it("cần duyệt khi tổng tiền vượt ngưỡng", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "25000000", quantity: 1 })]);
    const decision = requiresApproval(totals, thresholds);
    expect(decision.required).toBe(true);
    expect(decision.reasons[0]).toMatch(/Tổng tiền vượt ngưỡng/);
  });

  it("cần duyệt khi giảm giá vượt ngưỡng, dù tổng tiền nhỏ", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "1000000", quantity: 1 })], "250000");
    const decision = requiresApproval(totals, thresholds);
    expect(decision.required).toBe(true);
    expect(decision.reasons[0]).toMatch(/giảm giá/i);
  });

  it("nêu đủ CẢ HAI lý do khi vượt cả hai ngưỡng", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "30000000", quantity: 1 })], "6000000");
    const decision = requiresApproval(totals, thresholds);
    expect(decision.required).toBe(true);
    expect(decision.reasons).toHaveLength(2);
  });

  it("đúng bằng ngưỡng thì KHÔNG cần duyệt", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "20000000", quantity: 1 })]);
    expect(requiresApproval(totals, thresholds).required).toBe(false);
  });

  it("vượt ngưỡng dù chỉ 1 đồng vẫn phải duyệt", () => {
    const totals = calculateQuoteTotals([line({ unitPrice: "20000001", quantity: 1 })]);
    expect(requiresApproval(totals, thresholds).required).toBe(true);
  });
});

describe("hạn hiệu lực báo giá", () => {
  const now = new Date("2026-09-01T10:00:00Z");

  it("chưa hết hạn khi còn thời gian", () => {
    expect(isQuoteExpired(new Date("2026-09-08T10:00:00Z"), now)).toBe(false);
  });

  it("đúng thời điểm hết hạn tính là đã hết hạn", () => {
    expect(isQuoteExpired(new Date("2026-09-01T10:00:00Z"), now)).toBe(true);
  });

  it("không đặt hạn thì coi như còn hiệu lực", () => {
    expect(isQuoteExpired(null, now)).toBe(false);
  });

  it("đếm đúng số ngày còn lại", () => {
    expect(daysUntilExpiry(new Date("2026-09-08T10:00:00Z"), now)).toBe(7);
  });

  it("trả số âm khi đã quá hạn", () => {
    expect(daysUntilExpiry(new Date("2026-08-29T10:00:00Z"), now)).toBe(-3);
  });

  it("trả null khi không đặt hạn", () => {
    expect(daysUntilExpiry(null, now)).toBeNull();
  });
});
