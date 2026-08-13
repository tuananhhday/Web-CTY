import { test, expect, type APIResponse } from "@playwright/test";

/**
 * Header bảo mật và health check trên bản build production (§25, §30.1, §38).
 *
 * Vì sao phải là E2E chứ không phải test đơn vị: `src/lib/security-headers.ts` đã có test
 * đơn vị đầy đủ, nhưng nó chỉ kiểm được chuỗi CSP dựng ra đúng hay không. Nó KHÔNG kiểm
 * được middleware có gắn header lên response thật không, có chọn đúng mức cho từng khu vực
 * không, và quan trọng nhất — Next.js có thực sự nhúng nonce vào các thẻ script nó sinh ra
 * hay không.
 *
 * Điểm cuối đó chỉ quan sát được ở bản build production. Sai là trang trắng hoàn toàn.
 */

/** Tách chuỗi CSP thành map để khẳng định theo directive, không so khớp cả chuỗi. */
function parseCsp(csp: string | null): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of (csp ?? "").split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) map.set(tokens[0], tokens.slice(1));
  }
  return map;
}

const commonHeaders = (res: APIResponse) => res.headers();

test.describe("Header bảo mật — trang public (mức static)", () => {
  test("có đủ header bảo mật cơ bản", async ({ request }) => {
    const res = await request.get("/");
    const headers = commonHeaders(res);

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("microphone=()");
  });

  test("CSP khoá các directive quan trọng", async ({ request }) => {
    const res = await request.get("/");
    const csp = parseCsp(res.headers()["content-security-policy"]);

    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
  });

  test("trang prerender KHÔNG dùng nonce", async ({ request }) => {
    /*
     * Đây là bất biến then chốt. HTML prerender sinh lúc build không mang được nonce của
     * request hiện tại; nếu CSP có nonce thì trình duyệt chặn script khởi động của Next.js
     * và trang mất sạch tương tác.
     */
    const res = await request.get("/");
    const scriptSrc = parseCsp(res.headers()["content-security-policy"]).get("script-src");

    expect(scriptSrc?.join(" ")).not.toContain("nonce-");
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  test("trang public hydrate được và không có vi phạm CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Menu mobile là component client — mở được nghĩa là React đã hydrate.
    await expect(page.locator("main")).toBeVisible();
    expect(violations).toEqual([]);
  });
});

test.describe("Header bảo mật — khu vực riêng tư (mức strict)", () => {
  test("trang đăng nhập dùng CSP nonce, không mở unsafe-inline cho script", async ({
    request,
  }) => {
    const res = await request.get("/dang-nhap");
    const scriptSrc = parseCsp(res.headers()["content-security-policy"]).get("script-src");

    expect(scriptSrc?.join(" ")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test("MỌI thẻ script inline đều mang đúng nonce của response", async ({ request }) => {
    /*
     * Test quan trọng nhất trong file này. Nó xác nhận Next.js thực sự đọc được nonce từ
     * header request mà middleware đặt vào, và gắn nó lên script nó sinh ra. Thiếu một thẻ
     * là trang trắng.
     */
    const res = await request.get("/dang-nhap");
    const nonce = (res.headers()["content-security-policy"].match(/'nonce-([^']+)'/) ??
      [])[1];
    expect(nonce).toBeTruthy();

    const html = await res.text();
    const scriptTags = html.match(/<script[^>]*>/g) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);

    const inlineWithoutNonce = scriptTags.filter(
      (tag) => !tag.includes("src=") && !tag.includes(`nonce="${nonce}"`)
    );
    expect(inlineWithoutNonce).toEqual([]);
  });

  test("nonce khác nhau giữa hai request", async ({ request }) => {
    const nonceOf = async (path: string) => {
      const res = await request.get(path);
      return (res.headers()["content-security-policy"].match(/'nonce-([^']+)'/) ?? [])[1];
    };

    expect(await nonceOf("/dang-nhap")).not.toBe(await nonceOf("/dang-nhap"));
  });

  test("trang đăng nhập hydrate được, không bị CSP chặn", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });

    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    expect(violations).toEqual([]);
  });

  test("redirect từ khu vực bảo vệ vẫn mang header bảo mật", async ({ request }) => {
    const res = await request.get("/quan-tri", { maxRedirects: 0 });

    expect(res.status()).toBe(307);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toBeTruthy();
  });
});

test.describe("Header bảo mật — /api", () => {
  test("route API có nosniff và CSP đóng hoàn toàn", async ({ request }) => {
    /*
     * Middleware không chạm /api (matcher loại ra), nên header ở đây đến từ next.config.ts.
     * `nosniff` quan trọng nhất với /api/media/[id]: route đó trả tệp người dùng tải lên.
     */
    const res = await request.get("/api/media/khong-ton-tai");
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'; sandbox"
    );
  });
});

test.describe("Health check", () => {
  test("liveness trả ok và không cache", async ({ request }) => {
    const res = await request.get("/api/health/live");

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("readiness kiểm tra database thật", async ({ request }) => {
    const res = await request.get("/api/health/ready");
    const body = await res.json();

    expect(res.status()).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toContainEqual(
      expect.objectContaining({ name: "database", status: "ok" })
    );
  });

  test("readiness không rò rỉ thông tin nội bộ", async ({ request }) => {
    const raw = await (await request.get("/api/health/ready")).text();

    // Không lộ chuỗi kết nối, tên người dùng database hay đường dẫn máy chủ.
    expect(raw).not.toMatch(/postgres(ql)?:\/\//);
    expect(raw).not.toMatch(/\b5432\b/);
    expect(raw.toLowerCase()).not.toContain("prisma");
  });
});

test.describe("Endpoint nội bộ", () => {
  test("từ chối khi thiếu khoá", async ({ request }) => {
    const res = await request.post("/api/internal/scheduler/run");
    expect(res.status()).toBe(403);
  });

  test("từ chối khi sai khoá, cùng phản hồi với thiếu khoá", async ({ request }) => {
    const res = await request.post("/api/internal/scheduler/run", {
      headers: { "x-internal-key": "sai-hoan-toan" },
    });
    expect(res.status()).toBe(403);
  });

  test("GET trả 404, không xác nhận endpoint tồn tại", async ({ request }) => {
    const res = await request.get("/api/internal/scheduler/run");
    expect(res.status()).toBe(404);
  });
});
