import { describe, it, expect } from "vitest";
import {
  money,
  add,
  subtract,
  multiply,
  percentOf,
  assertNonNegative,
  toStorage,
  formatMoney,
  calculateLineTotal,
} from "@/lib/money";

describe("money", () => {
  it("làm tròn về số nguyên đồng", () => {
    expect(money("1500.6").toString()).toBe("1501");
    expect(money(1500.4).toString()).toBe("1500");
  });

  it("từ chối giá trị không hữu hạn", () => {
    expect(() => money(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => money(Number.NaN)).toThrow();
  });
});

describe("phép cộng không sai số dấu phẩy động", () => {
  it("0.1 + 0.2 tính đúng, khác với số thực JavaScript", () => {
    // 0.1 + 0.2 === 0.30000000000000004 nếu dùng Float.
    expect(add("0.1", "0.2").toString()).toBe("0");
    // Kiểm tra ở mức tiền thật: cộng 1000 lần 1 đồng phải ra đúng 1000.
    const values = Array.from({ length: 1000 }, () => "1");
    expect(add(...values).toString()).toBe("1000");
  });

  it("cộng dồn số tiền lớn không mất chính xác", () => {
    const total = add("999999999999", "1");
    expect(total.toString()).toBe("1000000000000");
  });
});

describe("subtract và multiply", () => {
  it("trừ đúng", () => {
    expect(subtract("1000000", "250000").toString()).toBe("750000");
  });

  it("nhân với số lượng lẻ", () => {
    expect(multiply("400000", 2.5).toString()).toBe("1000000");
  });

  it("từ chối số lượng không hợp lệ", () => {
    expect(() => multiply("100", Number.NaN)).toThrow();
  });
});

describe("percentOf", () => {
  it("tính thuế 8%", () => {
    expect(percentOf("1000000", 8).toString()).toBe("80000");
  });

  it("từ chối phần trăm âm", () => {
    expect(() => percentOf("1000", -5)).toThrow();
  });
});

describe("assertNonNegative", () => {
  it("chấp nhận số không âm", () => {
    expect(assertNonNegative("0").toString()).toBe("0");
    expect(assertNonNegative("500").toString()).toBe("500");
  });

  it("từ chối số âm", () => {
    expect(() => assertNonNegative("-1", "Giá cước")).toThrow(/Giá cước không được âm/);
  });
});

describe("toStorage", () => {
  it("trả chuỗi không có phần thập phân để lưu Decimal(18,0)", () => {
    expect(toStorage("1500000.7")).toBe("1500001");
    expect(toStorage(0)).toBe("0");
  });
});

describe("formatMoney", () => {
  it("định dạng theo chuẩn Việt Nam", () => {
    // Intl dùng khoảng trắng không ngắt trước ký hiệu tiền tệ.
    expect(formatMoney("1500000").replace(/ /g, " ")).toBe("1.500.000 ₫");
  });
});

describe("calculateLineTotal", () => {
  it("tính đúng thứ tự: thành tiền, trừ giảm giá, rồi cộng thuế", () => {
    const result = calculateLineTotal({
      unitPrice: "1000000",
      quantity: 2,
      discountAmount: "200000",
      taxPercent: 8,
    });

    expect(result.subtotal.toString()).toBe("2000000");
    expect(result.discount.toString()).toBe("200000");
    // Thuế tính trên 1.800.000 chứ không phải 2.000.000.
    expect(result.tax.toString()).toBe("144000");
    expect(result.total.toString()).toBe("1944000");
  });

  it("không thuế thì tổng bằng thành tiền trừ giảm giá", () => {
    const result = calculateLineTotal({
      unitPrice: "500000",
      quantity: 3,
      discountAmount: "100000",
    });
    expect(result.total.toString()).toBe("1400000");
  });

  it("từ chối giảm giá lớn hơn thành tiền", () => {
    expect(() =>
      calculateLineTotal({ unitPrice: "100000", quantity: 1, discountAmount: "200000" })
    ).toThrow(/Giảm giá không được lớn hơn/);
  });

  it("từ chối giảm giá âm", () => {
    expect(() =>
      calculateLineTotal({ unitPrice: "100000", quantity: 1, discountAmount: "-50000" })
    ).toThrow();
  });
});
