import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  normalizePlateNumber,
  formatPhoneForDisplay,
  maskPhone,
  removeVietnameseTones,
  slugify,
} from "@/lib/normalize";

describe("normalizeEmail", () => {
  it("chuyển về chữ thường và cắt khoảng trắng", () => {
    expect(normalizeEmail("  Nguyen.Van.An@Example.COM ")).toBe("nguyen.van.an@example.com");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["0912345678", "+84912345678"],
    ["84912345678", "+84912345678"],
    ["+84912345678", "+84912345678"],
    ["0912 345 678", "+84912345678"],
    ["0912.345.678", "+84912345678"],
    ["+84 912-345-678", "+84912345678"],
  ])("chuẩn hoá %s thành %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["091234567", "thiếu một chữ số"],
    ["09123456789", "thừa một chữ số"],
    ["1912345678", "không phải định dạng Việt Nam"],
    ["abcdefghij", "không phải số"],
    ["", "chuỗi rỗng"],
  ])("trả null cho %s (%s)", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("cùng một số nhập nhiều kiểu cho ra một giá trị duy nhất", () => {
    const variants = ["0912345678", "84912345678", "+84 912 345 678", "0912.345.678"];
    const normalized = new Set(variants.map(normalizePhone));
    expect(normalized.size).toBe(1);
  });
});

describe("formatPhoneForDisplay", () => {
  it("hiển thị dạng quen thuộc trong nước", () => {
    expect(formatPhoneForDisplay("+84912345678")).toBe("0912 345 678");
  });
});

describe("maskPhone", () => {
  it("che phần giữa của số điện thoại", () => {
    expect(maskPhone("+84912345678")).toBe("0912 *** 678");
  });

  it("không lộ đủ chữ số để đoán ra số gốc", () => {
    const masked = maskPhone("+84912345678");
    expect(masked).not.toContain("345");
  });
});

describe("normalizePlateNumber", () => {
  it.each([
    ["51C-123.45", "51C12345"],
    ["51c 12345", "51C12345"],
    ["51C.123-45", "51C12345"],
    ["  51C12345  ", "51C12345"],
  ])("chuẩn hoá %s thành %s", (input, expected) => {
    expect(normalizePlateNumber(input)).toBe(expected);
  });

  it("các cách viết khác nhau của cùng biển số cho ra một giá trị", () => {
    const variants = ["51C-123.45", "51c 12345", "51C.12345"];
    const normalized = new Set(variants.map(normalizePlateNumber));
    expect(normalized.size).toBe(1);
  });
});

describe("removeVietnameseTones", () => {
  it("bỏ dấu và xử lý đúng chữ đ", () => {
    expect(removeVietnameseTones("Vận chuyển hàng hóa")).toBe("van chuyen hang hoa");
    expect(removeVietnameseTones("Đà Nẵng")).toBe("da nang");
  });
});

describe("slugify", () => {
  it.each([
    ["Vận chuyển hàng hóa", "van-chuyen-hang-hoa"],
    ["Chuyển nhà / Chuyển văn phòng", "chuyen-nha-chuyen-van-phong"],
    ["  Đội xe & Phương tiện  ", "doi-xe-phuong-tien"],
  ])("chuyển %s thành %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("không để dấu gạch ngang thừa ở đầu hoặc cuối", () => {
    expect(slugify("--- Tin tức ---")).toBe("tin-tuc");
  });
});
