import { test, expect } from "@playwright/test";

/**
 * Kiểm tra responsive ở các kích thước bắt buộc (§6, §34.5).
 *
 * Chỉ chạy trên project desktop-chromium vì test tự đặt viewport; chạy thêm trên
 * mobile-chrome sẽ lặp lại vô ích.
 */

const BREAKPOINTS = [
  { width: 390, height: 844, label: "điện thoại nhỏ" },
  { width: 768, height: 1024, label: "máy tính bảng dọc" },
  { width: 1024, height: 768, label: "máy tính bảng ngang" },
  { width: 1366, height: 768, label: "laptop" },
  { width: 1440, height: 900, label: "màn hình lớn" },
];

const ROUTES = [
  "/",
  "/dich-vu",
  "/doi-xe",
  "/bang-gia",
  "/bang-gia/boc-xep",
  "/khu-vuc-phuc-vu",
  "/faq",
  "/lien-he",
  "/tra-cuu",
  "/bao-gia",
  "/chinh-sach/bao-mat",
];

test.describe("Responsive", () => {
  // Test tự đặt viewport nên chạy trên project thứ hai chỉ lặp lại vô ích.
  test.skip(
    ({ isMobile }) => isMobile === true,
    "Bộ test này tự đặt viewport, không cần chạy lại trên project mobile"
  );

  for (const bp of BREAKPOINTS) {
    test(`${bp.width}px (${bp.label}) — không trang nào cuộn ngang`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const offenders: string[] = [];

      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(() => {
          const de = document.documentElement;
          return de.scrollWidth - de.clientWidth;
        });

        if (overflow > 1) offenders.push(`${route} (+${overflow}px)`);
      }

      expect(offenders, `Cuộn ngang tại ${bp.width}px`).toEqual([]);
    });
  }

  test("390px — menu mobile hiển thị, menu desktop bị ẩn", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /mở menu/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeHidden();
  });

  test("1440px — menu desktop hiển thị, nút mở menu bị ẩn", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
    await expect(page.getByRole("button", { name: /mở menu/i })).toBeHidden();
  });

  test("bảng giá cuộn ngang trong khung riêng, không đẩy cả trang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/bang-gia");
    await page.waitForLoadState("networkidle");

    const pageOverflow = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });

    expect(pageOverflow, "Trang bảng giá không được cuộn ngang").toBeLessThanOrEqual(1);
  });
});
