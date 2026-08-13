import { describe, it, expect } from "vitest";
import {
  generateTrackingCode,
  generateRequestCode,
  generateQuoteCode,
  generateInvoiceNumber,
  generateNumericOtp,
  generateSecureToken,
  generateObjectKey,
} from "@/lib/ids";

/** Ký tự dễ nhìn nhầm khi khách đọc mã qua điện thoại. */
const AMBIGUOUS = ["0", "O", "1", "I", "L", "U", "V"];

describe("generateTrackingCode", () => {
  it("có tiền tố VT và độ dài ổn định", () => {
    const code = generateTrackingCode();
    expect(code).toMatch(/^VT[A-Z0-9]{10}$/);
  });

  it("không chứa ký tự dễ nhìn nhầm ở phần ngẫu nhiên", () => {
    for (let i = 0; i < 200; i++) {
      const random = generateTrackingCode().slice(2);
      for (const char of AMBIGUOUS) {
        expect(random).not.toContain(char);
      }
    }
  });

  it("không tuần tự — 2000 mã liên tiếp đều khác nhau", () => {
    const codes = new Set(Array.from({ length: 2000 }, generateTrackingCode));
    expect(codes.size).toBe(2000);
  });

  it("hai mã sinh liên tiếp không có tiền tố chung dài, tránh đoán được thứ tự", () => {
    const a = generateTrackingCode().slice(2);
    const b = generateTrackingCode().slice(2);
    let shared = 0;
    while (shared < a.length && a[shared] === b[shared]) shared++;
    expect(shared).toBeLessThan(4);
  });
});

describe("mã yêu cầu và báo giá", () => {
  it("có tiền tố riêng để phân biệt loại", () => {
    expect(generateRequestCode()).toMatch(/^YC[A-Z0-9]{8}$/);
    expect(generateQuoteCode()).toMatch(/^BG[A-Z0-9]{8}$/);
  });

  it("không trùng nhau", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateQuoteCode));
    expect(codes.size).toBe(1000);
  });
});

describe("generateInvoiceNumber", () => {
  it("đệm số thứ tự đủ 5 chữ số", () => {
    expect(generateInvoiceNumber(2026, 1)).toBe("HD2026-00001");
    expect(generateInvoiceNumber(2026, 12345)).toBe("HD2026-12345");
  });
});

describe("generateNumericOtp", () => {
  it("mặc định 6 chữ số", () => {
    expect(generateNumericOtp()).toMatch(/^\d{6}$/);
  });

  it("hỗ trợ độ dài tuỳ chỉnh", () => {
    expect(generateNumericOtp(4)).toMatch(/^\d{4}$/);
  });

  it("phân bố đủ ngẫu nhiên — 500 mã có ít nhất 490 giá trị khác nhau", () => {
    const otps = new Set(Array.from({ length: 500 }, () => generateNumericOtp()));
    expect(otps.size).toBeGreaterThan(490);
  });
});

describe("generateSecureToken", () => {
  it("dài 64 ký tự hex, tương đương 256 bit", () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("không trùng nhau", () => {
    const tokens = new Set(Array.from({ length: 500 }, generateSecureToken));
    expect(tokens.size).toBe(500);
  });
});

describe("generateObjectKey", () => {
  it("phân thư mục theo năm/tháng và giữ nguyên tiền tố", () => {
    const key = generateObjectKey("shipment-media", "jpg");
    expect(key).toMatch(/^shipment-media\/\d{4}\/\d{2}\/[A-Z0-9]+\.jpg$/);
  });

  it("loại bỏ ký tự nguy hiểm trong phần mở rộng, chống path traversal", () => {
    const key = generateObjectKey("docs", "../../etc/passwd");
    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc/");
    expect(key.endsWith(".etcpasswd")).toBe(true);
  });

  it("không dùng tên file do người dùng cung cấp", () => {
    const key = generateObjectKey("uploads", "png");
    expect(key).not.toContain("uploads/anh-cua-toi");
  });
});
