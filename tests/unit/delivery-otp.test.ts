import { describe, it, expect } from "vitest";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  otpExpiresAt,
  maskPhone,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type OtpRecord,
} from "@/modules/proof-of-delivery/otp";

/** Bốn quy tắc an toàn OTP của §18: chỉ lưu hash, có hạn, giới hạn số lần thử, dùng một lần. */

const SHIPMENT = "shp-1";
const NOW = new Date("2026-09-01T10:00:00Z");

function record(otp: string, overrides: Partial<OtpRecord> = {}): OtpRecord {
  return {
    otpHash: hashOtp(otp, SHIPMENT),
    expiresAt: new Date(NOW.getTime() + 10 * 60_000),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    consumedAt: null,
    ...overrides,
  };
}

describe("generateOtp", () => {
  it("luôn sinh đúng 6 chữ số", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("giữ số 0 ở đầu thay vì rút ngắn", () => {
    // Sinh nhiều lần để chắc chắn có trường hợp giá trị nhỏ.
    const all = Array.from({ length: 500 }, () => generateOtp());
    expect(all.every((otp) => otp.length === 6)).toBe(true);
  });

  it("không lặp lại một giá trị cố định", () => {
    const unique = new Set(Array.from({ length: 100 }, () => generateOtp()));
    expect(unique.size).toBeGreaterThan(90);
  });
});

describe("hashOtp", () => {
  it("không bao giờ trả về chính mã gốc", () => {
    const otp = "123456";
    expect(hashOtp(otp, SHIPMENT)).not.toContain(otp);
  });

  it("cùng mã ở hai chuyến khác nhau cho hash khác nhau", () => {
    // Muối bằng shipmentId: đọc được bảng cũng không suy ra chuyến nào dùng mã nào.
    expect(hashOtp("123456", "shp-1")).not.toBe(hashOtp("123456", "shp-2"));
  });

  it("ổn định với cùng đầu vào", () => {
    expect(hashOtp("123456", SHIPMENT)).toBe(hashOtp("123456", SHIPMENT));
  });
});

describe("verifyOtp", () => {
  it("chấp nhận mã đúng", () => {
    expect(verifyOtp(record("123456"), "123456", SHIPMENT, NOW)).toEqual({ ok: true });
  });

  it("bỏ qua khoảng trắng người dùng gõ thừa", () => {
    expect(verifyOtp(record("123456"), " 123456 ", SHIPMENT, NOW).ok).toBe(true);
  });

  it("từ chối mã sai", () => {
    const result = verifyOtp(record("123456"), "654321", SHIPMENT, NOW);
    expect(result).toMatchObject({ ok: false, reason: "MISMATCH" });
  });

  it("từ chối mã đúng nhưng của chuyến khác", () => {
    const result = verifyOtp(record("123456"), "123456", "shp-khac", NOW);
    expect(result).toMatchObject({ ok: false, reason: "MISMATCH" });
  });

  it("từ chối khi đã hết hạn", () => {
    const expired = record("123456", { expiresAt: new Date(NOW.getTime() - 1000) });
    expect(verifyOtp(expired, "123456", SHIPMENT, NOW)).toMatchObject({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("hết hạn đúng tại thời điểm biên", () => {
    const atBoundary = record("123456", { expiresAt: NOW });
    expect(verifyOtp(atBoundary, "123456", SHIPMENT, NOW).ok).toBe(false);
  });

  it("từ chối khi đã dùng rồi", () => {
    const used = record("123456", { consumedAt: new Date(NOW.getTime() - 60_000) });
    expect(verifyOtp(used, "123456", SHIPMENT, NOW)).toMatchObject({
      ok: false,
      reason: "CONSUMED",
    });
  });

  it("từ chối khi vượt số lần thử, kể cả khi nhập đúng", () => {
    const exhausted = record("123456", { attempts: OTP_MAX_ATTEMPTS });
    expect(verifyOtp(exhausted, "123456", SHIPMENT, NOW)).toMatchObject({
      ok: false,
      reason: "TOO_MANY_ATTEMPTS",
    });
  });

  it("xét đã dùng và hết hạn TRƯỚC khi so mã", () => {
    // Nếu so mã trước, người thử dùng được thời gian phản hồi để biết mã nào đúng dù bản
    // ghi đã hết hiệu lực.
    const used = record("123456", { consumedAt: NOW });
    expect(verifyOtp(used, "654321", SHIPMENT, NOW)).toMatchObject({ reason: "CONSUMED" });

    const expired = record("123456", { expiresAt: new Date(NOW.getTime() - 1) });
    expect(verifyOtp(expired, "654321", SHIPMENT, NOW)).toMatchObject({ reason: "EXPIRED" });
  });

  it("mọi trường hợp từ chối đều có thông báo tiếng Việt", () => {
    const cases = [
      record("123456", { consumedAt: NOW }),
      record("123456", { expiresAt: new Date(NOW.getTime() - 1) }),
      record("123456", { attempts: 99 }),
      record("123456"),
    ];

    for (const [index, rec] of cases.entries()) {
      const result = verifyOtp(rec, index === 3 ? "000000" : "123456", SHIPMENT, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
    }
  });
});

describe("otpExpiresAt", () => {
  it("hết hạn sau đúng số phút cấu hình", () => {
    const expires = otpExpiresAt(NOW);
    expect(expires.getTime() - NOW.getTime()).toBe(OTP_TTL_MINUTES * 60_000);
  });

  it("thời hạn đủ ngắn — không quá 30 phút", () => {
    expect(OTP_TTL_MINUTES).toBeLessThanOrEqual(30);
  });
});

describe("maskPhone", () => {
  it("chỉ để lộ 4 số cuối", () => {
    expect(maskPhone("0912345678")).toBe("******5678");
  });

  it("bỏ qua ký tự phân cách khi đếm — 11 chữ số nên 7 dấu sao", () => {
    expect(maskPhone("+84 912 345 678")).toBe("*******5678");
  });

  it("cùng một số viết hai cách cho kết quả che giống nhau ở phần đuôi", () => {
    expect(maskPhone("0912345678").slice(-4)).toBe(maskPhone("+84912345678").slice(-4));
  });

  it("số quá ngắn thì che hết", () => {
    expect(maskPhone("123")).toBe("***");
    expect(maskPhone("")).toBe("***");
  });
});
