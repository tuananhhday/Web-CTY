import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  generateNonce,
  securityHeaders,
} from "@/lib/security-headers";

/** Tách chuỗi CSP thành map để khẳng định theo từng directive thay vì so khớp cả chuỗi. */
function parseCsp(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    map.set(tokens[0], tokens.slice(1));
  }
  return map;
}

const strict = (isProduction = true) =>
  parseCsp(buildContentSecurityPolicy({ profile: "strict", nonce: "NONCE123", isProduction }));

const staticProfile = (isProduction = true) =>
  parseCsp(buildContentSecurityPolicy({ profile: "static", isProduction }));

describe("CSP — directive dùng chung cho cả hai mức", () => {
  for (const [label, build] of [
    ["strict", strict],
    ["static", staticProfile],
  ] as const) {
    describe(label, () => {
      it("chặn nhúng iframe từ site khác", () => {
        expect(build().get("frame-ancestors")).toEqual(["'none'"]);
      });

      it("chặn plugin nhúng", () => {
        expect(build().get("object-src")).toEqual(["'none'"]);
      });

      it("khoá form-action về chính mình, chống đổi đích gửi biểu mẫu", () => {
        expect(build().get("form-action")).toEqual(["'self'"]);
      });

      it("khoá base-uri, chống chèn thẻ base để đổi đường dẫn script tương đối", () => {
        expect(build().get("base-uri")).toEqual(["'self'"]);
      });

      it("mặc định đóng mọi thứ chưa khai báo", () => {
        expect(build().get("default-src")).toEqual(["'self'"]);
      });

      it("chỉ nâng cấp lên https ở production", () => {
        expect(build(true).has("upgrade-insecure-requests")).toBe(true);
        expect(build(false).has("upgrade-insecure-requests")).toBe(false);
      });

      it("không cho phép unsafe-eval ở production", () => {
        expect(build(true).get("script-src")).not.toContain("'unsafe-eval'");
      });

      it("cho phép unsafe-eval khi phát triển vì refresh nhanh của Next cần", () => {
        expect(build(false).get("script-src")).toContain("'unsafe-eval'");
      });

      it("mở websocket cho HMR khi phát triển nhưng đóng ở production", () => {
        expect(build(false).get("connect-src")).toContain("ws:");
        expect(build(true).get("connect-src")).toEqual(["'self'"]);
      });

      it("cho phép data: và blob: cho ảnh để xem trước trước khi tải lên", () => {
        expect(build().get("img-src")).toEqual(
          expect.arrayContaining(["'self'", "data:", "blob:"])
        );
      });
    });
  }
});

describe("CSP mức strict — dành cho khu vực đăng nhập", () => {
  it("nhúng nonce vào script-src", () => {
    expect(strict().get("script-src")).toContain("'nonce-NONCE123'");
  });

  it("KHÔNG BAO GIỜ mở unsafe-inline cho script", () => {
    expect(strict(true).get("script-src")).not.toContain("'unsafe-inline'");
    expect(strict(false).get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("dùng strict-dynamic để script được nonce cho phép tải tiếp script khác", () => {
    expect(strict().get("script-src")).toContain("'strict-dynamic'");
  });

  it("từ chối dựng khi thiếu nonce, thay vì lặng lẽ sinh chính sách vô hiệu", () => {
    expect(() =>
      buildContentSecurityPolicy({ profile: "strict", isProduction: true })
    ).toThrow(/nonce/i);
  });
});

describe("CSP mức static — dành cho trang prerender", () => {
  it("chấp nhận unsafe-inline vì HTML prerender không mang được nonce của request", () => {
    expect(staticProfile().get("script-src")).toContain("'unsafe-inline'");
  });

  it("không nhắc tới nonce, tránh vô hiệu hoá unsafe-inline", () => {
    // Trình duyệt BỎ QUA 'unsafe-inline' khi có nonce trong cùng directive.
    // Lẫn hai thứ này là trang trắng.
    expect(staticProfile().get("script-src")?.join(" ")).not.toContain("nonce-");
  });

  it("không dùng strict-dynamic, vì nó cũng vô hiệu hoá unsafe-inline", () => {
    expect(staticProfile().get("script-src")).not.toContain("'strict-dynamic'");
  });

  it("bỏ qua nonce truyền nhầm thay vì trộn vào chính sách", () => {
    const csp = parseCsp(
      buildContentSecurityPolicy({ profile: "static", nonce: "X", isProduction: true })
    );
    expect(csp.get("script-src")?.join(" ")).not.toContain("nonce-");
  });
});

describe("CSP — host ảnh ngoài", () => {
  it("thêm vào img-src mà không nới directive khác", () => {
    const csp = parseCsp(
      buildContentSecurityPolicy({
        profile: "strict",
        nonce: "N",
        isProduction: true,
        imageHosts: ["https://images.unsplash.com"],
      })
    );
    expect(csp.get("img-src")).toContain("https://images.unsplash.com");
    expect(csp.get("connect-src")).not.toContain("https://images.unsplash.com");
    expect(csp.get("script-src")).not.toContain("https://images.unsplash.com");
  });
});

describe("securityHeaders", () => {
  it("đặt HSTS ở production", () => {
    expect(securityHeaders(true)["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains"
    );
  });

  it("KHÔNG đặt HSTS khi phát triển, tránh khoá localhost vào https", () => {
    expect(securityHeaders(false)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("chưa bật preload vì doanh nghiệp chưa đăng ký danh sách preload", () => {
    expect(securityHeaders(true)["Strict-Transport-Security"]).not.toContain("preload");
  });

  it("luôn có nosniff", () => {
    expect(securityHeaders(true)["X-Content-Type-Options"]).toBe("nosniff");
    expect(securityHeaders(false)["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("giữ geolocation và camera cho chính mình vì màn hình tài xế cần", () => {
    const policy = securityHeaders(true)["Permissions-Policy"];
    expect(policy).toContain("geolocation=(self)");
    expect(policy).toContain("camera=(self)");
  });

  it("đóng các API trình duyệt không dùng", () => {
    const policy = securityHeaders(true)["Permissions-Policy"];
    for (const feature of ["microphone", "payment", "usb"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("không rò đường dẫn đầy đủ sang site khác", () => {
    expect(securityHeaders(true)["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("generateNonce", () => {
  it("sinh giá trị khác nhau mỗi lần gọi", () => {
    const values = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(values.size).toBe(100);
  });

  it("là base64 hợp lệ, đủ dài để không đoán được", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    // 16 byte ngẫu nhiên = 128 bit entropy.
    expect(Buffer.from(nonce, "base64")).toHaveLength(16);
  });

  it("không chứa ký tự phá vỡ cú pháp CSP", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateNonce()).not.toMatch(/[;'\s]/);
    }
  });
});
