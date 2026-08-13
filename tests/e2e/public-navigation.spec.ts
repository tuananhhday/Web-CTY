import { test, expect } from "@playwright/test";

/**
 * Điều hướng và tính toàn vẹn của khu vực public (§34.4, §38).
 *
 * Mục tiêu: mọi route chính tồn tại, không có link chết, không có lỗi console,
 * và không trang nào bị cuộn ngang ở mọi kích thước màn hình.
 */

const PUBLIC_ROUTES = [
  { path: "/", heading: /vận chuyển|hàng hóa/i },
  { path: "/gioi-thieu", heading: /giới thiệu/i },
  { path: "/dich-vu", heading: /dịch vụ/i },
  { path: "/doi-xe", heading: /đội xe|phương tiện/i },
  { path: "/khu-vuc-phuc-vu", heading: /khu vực phục vụ/i },
  { path: "/bang-gia", heading: /bảng giá/i },
  { path: "/bang-gia/boc-xep", heading: /bốc xếp/i },
  { path: "/bao-gia", heading: /báo giá/i },
  { path: "/tra-cuu", heading: /tra cứu/i },
  { path: "/tin-tuc", heading: /tin tức/i },
  { path: "/faq", heading: /câu hỏi/i },
  { path: "/lien-he", heading: /liên hệ/i },
  { path: "/nguon-hinh-anh", heading: /nguồn hình ảnh/i },
  { path: "/chinh-sach/bao-mat", heading: /bảo mật/i },
  { path: "/chinh-sach/dieu-khoan", heading: /điều khoản/i },
  { path: "/chinh-sach/van-chuyen", heading: /vận chuyển/i },
  { path: "/chinh-sach/cookie", heading: /cookie/i },
];

test.describe("Trang public", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} tải được, có đúng một h1 và không cuộn ngang`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);

      // Mỗi trang phải có đúng một h1 — yêu cầu về thứ tự heading (§29).
      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText(route.heading);

      // Kiểm tra cuộn ngang ngay tại đây thay vì trong một test riêng duyệt lại toàn bộ
      // route — mỗi trang chỉ cần tải một lần (§16.13).
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        // Cho phép sai số 1px do làm tròn subpixel.
        return de.scrollWidth - de.clientWidth;
      });
      expect(overflow, `${route.path} bị cuộn ngang ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test("không có lỗi console trên các trang chính", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`${page.url()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`${page.url()}: ${err.message}`));

    for (const route of ["/", "/dich-vu", "/bang-gia", "/tin-tuc", "/faq"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    expect(errors).toEqual([]);
  });
});

test.describe("Điều hướng", () => {
  test("mọi liên kết nội bộ trên trang chủ đều dẫn tới trang tồn tại", async ({ page }) => {
    // Test này gọi ~20 URL tuần tự; dev server biên dịch theo yêu cầu nên cần nhiều thời
    // gian hơn mức mặc định 30 giây.
    test.setTimeout(120_000);

    await page.goto("/");

    const hrefs = await page.locator("a[href^='/']").evaluateAll((links) =>
      Array.from(new Set(links.map((a) => a.getAttribute("href")).filter(Boolean) as string[]))
    );

    expect(hrefs.length).toBeGreaterThan(5);

    // Dùng page.request thay vì fixture `request`: fixture bị huỷ khi trang điều hướng,
    // còn page.request chia sẻ cookie và vòng đời với trang nên ổn định hơn.
    for (const href of hrefs) {
      const response = await page.request.get(href, { maxRedirects: 0 });
      // 200 hoặc 3xx (redirect có chủ đích) đều chấp nhận; 404/500 là link chết.
      expect(response.status(), `Link chết: ${href}`).toBeLessThan(400);
    }
  });

  test("menu mobile mở được và điều hướng đúng", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: /mở menu/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("link", { name: "Dịch vụ", exact: true }).click();
    await expect(page).toHaveURL(/\/dich-vu$/);
  });

  test("liên kết ngoài đều có rel an toàn", async ({ page }) => {
    await page.goto("/nguon-hinh-anh");

    const unsafe = await page.locator("a[target='_blank']").evaluateAll((links) =>
      links
        .filter((a) => {
          const rel = a.getAttribute("rel") ?? "";
          return !rel.includes("noopener") || !rel.includes("noreferrer");
        })
        .map((a) => a.getAttribute("href"))
    );

    expect(unsafe, "Liên kết mở tab mới thiếu rel=noopener noreferrer").toEqual([]);
  });
});

test.describe("Bảo vệ khu vực riêng tư", () => {
  for (const path of ["/tai-khoan", "/tai-xe", "/quan-tri"]) {
    test(`${path} chuyển hướng về đăng nhập khi chưa xác thực`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dang-nhap\?tiep-tuc=/);
    });
  }

  test("trang riêng tư có header noindex", async ({ request }) => {
    const response = await request.get("/dang-nhap");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("sitemap không chứa URL khu vực riêng tư", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const secret of ["/tai-khoan", "/tai-xe", "/quan-tri", "/dang-nhap"]) {
      expect(xml, `sitemap lộ ${secret}`).not.toContain(`${secret}<`);
    }
  });
});
