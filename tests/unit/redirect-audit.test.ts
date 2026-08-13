import { describe, it, expect } from "vitest";
import { redactSensitive } from "@/modules/audit/redact";

/**
 * `sanitizeRedirect` nằm trong guards.ts vốn import "server-only" nên không nạp được
 * trong Vitest. Sao chép nguyên logic tại đây để kiểm chứng — nếu đổi một bên mà quên
 * bên kia, test này vẫn giữ được đặc tả về hành vi mong muốn.
 */
function sanitizeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

describe("chống open redirect (§9, §30.1)", () => {
  it.each([
    ["https://evil.com", "URL tuyệt đối"],
    ["http://evil.com", "URL tuyệt đối http"],
    ["//evil.com", "protocol-relative"],
    ["//evil.com/lua-dao", "protocol-relative có path"],
    ["/\\evil.com", "backslash sau dấu gạch chéo"],
    ["javascript:alert(1)", "javascript scheme"],
    ["data:text/html,<script>", "data URI"],
    ["evil.com", "không có dấu gạch chéo đầu"],
    ["", "chuỗi rỗng"],
  ])("chặn %s (%s)", (input) => {
    expect(sanitizeRedirect(input)).toBe("/");
  });

  it.each([
    "/tai-khoan",
    "/tai-khoan/don-hang",
    "/tai-khoan/don-hang/VTABC123?tab=timeline",
    "/quan-tri/dieu-phoi",
  ])("cho phép đường dẫn nội bộ %s", (input) => {
    expect(sanitizeRedirect(input)).toBe(input);
  });

  it("null và undefined trả về fallback", () => {
    expect(sanitizeRedirect(null)).toBe("/");
    expect(sanitizeRedirect(undefined)).toBe("/");
    expect(sanitizeRedirect(null, "/tai-khoan")).toBe("/tai-khoan");
  });
});

describe("redactSensitive — lọc dữ liệu nhạy cảm trước khi ghi AuditLog (§30.3)", () => {
  it("ẩn mật khẩu ở cấp một", () => {
    const result = redactSensitive({ email: "a@local.test", password: "SieuBiMat123" });
    expect(result).toEqual({ email: "a@local.test", password: "[ĐÃ ẨN]" });
  });

  it("ẩn cả khi tên trường viết hoa khác nhau", () => {
    const result = redactSensitive({ Password: "x", PASSWORDHASH: "y", accessToken: "z" }) as Record<
      string,
      unknown
    >;
    expect(result.Password).toBe("[ĐÃ ẨN]");
    expect(result.PASSWORDHASH).toBe("[ĐÃ ẨN]");
    expect(result.accessToken).toBe("[ĐÃ ẨN]");
  });

  it("ẩn ở cấp lồng sâu", () => {
    const result = redactSensitive({
      user: { name: "An", credentials: { password: "bimat", otp: "123456" } },
    }) as { user: { name: string; credentials: Record<string, unknown> } };

    expect(result.user.name).toBe("An");
    expect(result.user.credentials.password).toBe("[ĐÃ ẨN]");
    expect(result.user.credentials.otp).toBe("[ĐÃ ẨN]");
  });

  it("ẩn trong mảng object", () => {
    const result = redactSensitive([
      { id: 1, token: "abc" },
      { id: 2, token: "def" },
    ]) as Array<Record<string, unknown>>;

    expect(result[0].id).toBe(1);
    expect(result[0].token).toBe("[ĐÃ ẨN]");
    expect(result[1].token).toBe("[ĐÃ ẨN]");
  });

  it("ẩn presigned URL và chữ ký", () => {
    const result = redactSensitive({
      signedUrl: "https://bucket/x?sig=abc",
      presignedUrl: "https://bucket/y?sig=def",
      signatureKey: "pod/2026/chu-ky.png",
    }) as Record<string, unknown>;

    expect(result.signedUrl).toBe("[ĐÃ ẨN]");
    expect(result.presignedUrl).toBe("[ĐÃ ẨN]");
    expect(result.signatureKey).toBe("[ĐÃ ẨN]");
  });

  it("ẩn số giấy tờ đầy đủ", () => {
    const result = redactSensitive({
      licenseNumber: "790123456789",
      documentNumber: "0123456789",
      licenseClass: "FC",
    }) as Record<string, unknown>;

    expect(result.licenseNumber).toBe("[ĐÃ ẨN]");
    expect(result.documentNumber).toBe("[ĐÃ ẨN]");
    // Hạng bằng lái không nhạy cảm, giữ lại để đối chiếu nghiệp vụ.
    expect(result.licenseClass).toBe("FC");
  });

  it("giữ nguyên dữ liệu nghiệp vụ bình thường", () => {
    const input = {
      trackingCode: "VTABC1234567",
      status: "IN_TRANSIT",
      totalAmount: 1500000,
      isActive: true,
    };
    expect(redactSensitive(input)).toEqual(input);
  });

  it("chuyển Date thành chuỗi ISO để lưu JSON", () => {
    const result = redactSensitive({ at: new Date("2026-09-01T10:00:00Z") }) as Record<string, unknown>;
    expect(result.at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("không đi sâu vô hạn khi gặp object lồng quá nhiều cấp", () => {
    let deep: Record<string, unknown> = { value: "day" };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => redactSensitive(deep)).not.toThrow();
    expect(JSON.stringify(redactSensitive(deep))).toContain("QUÁ SÂU");
  });

  it("loại bỏ hàm khỏi dữ liệu ghi log", () => {
    const result = redactSensitive({ ok: 1, fn: () => "x" }) as Record<string, unknown>;
    expect(result.ok).toBe(1);
    expect(result.fn).toBeNull();
  });
});
