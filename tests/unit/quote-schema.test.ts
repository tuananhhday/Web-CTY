import { describe, it, expect } from "vitest";
import { quoteRevisionSchema } from "@/modules/quotes/schema";

/**
 * Hồi quy cho một lỗi thật: ô nhập HTML để trống trả về chuỗi rỗng, không phải `undefined`.
 * `moneyString.optional()` vì thế bắt lỗi chính những trường mà nhân viên được phép bỏ qua,
 * khiến không lập nổi báo giá nếu không điền giảm giá và thuế cho từng dòng.
 */

function revision(overrides: Record<string, unknown> = {}) {
  return {
    lineItems: [
      {
        description: "Cước vận chuyển",
        category: "TRANSPORT",
        quantity: 1,
        unit: "chuyến",
        unitPrice: "3500000",
        ...((overrides.lineItem as Record<string, unknown>) ?? {}),
      },
    ],
    ...overrides,
  };
}

describe("quoteRevisionSchema — trường tiền không bắt buộc", () => {
  it("chấp nhận báo giá tối thiểu, không điền trường tùy chọn nào", () => {
    const result = quoteRevisionSchema.safeParse(revision());
    expect(result.success).toBe(true);
  });

  it.each(["discountAmount", "taxPercent", "note"])(
    "dòng chi phí bỏ trống %s vẫn hợp lệ",
    (field) => {
      const result = quoteRevisionSchema.safeParse(revision({ lineItem: { [field]: "" } }));
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  );

  it.each(["discountAmount", "validityDays", "terms", "note"])(
    "báo giá bỏ trống %s vẫn hợp lệ",
    (field) => {
      const result = quoteRevisionSchema.safeParse(revision({ [field]: "" }));
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  );

  it("chuỗi rỗng thành undefined chứ không thành 0", () => {
    const result = quoteRevisionSchema.parse(revision({ discountAmount: "" }));
    expect(result.discountAmount).toBeUndefined();
  });

  it("vẫn từ chối số tiền viết sai định dạng", () => {
    for (const bad of ["3.500.000", "3500000đ", "-100", "1e6", "abc"]) {
      const result = quoteRevisionSchema.safeParse(revision({ discountAmount: bad }));
      expect(result.success, `phải từ chối "${bad}"`).toBe(false);
    }
  });

  it("vẫn bắt buộc đơn giá", () => {
    const result = quoteRevisionSchema.safeParse(revision({ lineItem: { unitPrice: "" } }));
    expect(result.success).toBe(false);
  });

  it("vẫn từ chối thuế suất ngoài khoảng cho phép", () => {
    expect(quoteRevisionSchema.safeParse(revision({ lineItem: { taxPercent: 150 } })).success).toBe(
      false
    );
    expect(quoteRevisionSchema.safeParse(revision({ lineItem: { taxPercent: -1 } })).success).toBe(
      false
    );
  });
});
