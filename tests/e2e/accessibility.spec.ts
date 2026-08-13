import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Kiểm thử accessibility tự động theo WCAG 2.2 AA (§29, §34.5).
 *
 * Axe bắt được khoảng 30–40% vấn đề a11y. Phần còn lại — thứ tự tab hợp lý, nội dung
 * alt có ý nghĩa, focus không bị bẫy — vẫn cần kiểm tra thủ công. Test này là sàn tối
 * thiểu, không phải bằng chứng đã đạt chuẩn hoàn toàn.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const CORE_ROUTES = [
  "/",
  "/dich-vu",
  "/doi-xe",
  "/bang-gia",
  "/bao-gia",
  "/tra-cuu",
  "/faq",
  "/lien-he",
  "/khu-vuc-phuc-vu",
  "/chinh-sach/bao-mat",
  "/dang-nhap",
  "/dang-ky",
];

test.describe("Accessibility — WCAG 2.2 AA", () => {
  for (const route of CORE_ROUTES) {
    test(`${route} không có vi phạm axe`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      // In chi tiết vi phạm để sửa được ngay mà không phải mở báo cáo HTML.
      if (results.violations.length > 0) {
        const summary = results.violations
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.help}\n` +
              v.nodes.map((n) => `    → ${n.target.join(" ")}`).join("\n")
          )
          .join("\n");
        console.error(`\nVi phạm a11y tại ${route}:\n${summary}\n`);
      }

      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("Điều hướng bàn phím", () => {
  test("skip link xuất hiện khi nhấn Tab và nhảy tới nội dung chính", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /bỏ qua đến nội dung chính/i });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#noi-dung-chinh$/);
  });

  test("mọi phần tử tương tác trên trang chủ đều có focus nhìn thấy được", async ({ page }) => {
    await page.goto("/");

    // Duyệt 15 điểm dừng tab đầu tiên, kiểm tra từng phần tử có outline hoặc ring.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { visible: true, describe: "(body)" };

        const style = window.getComputedStyle(el);
        const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        const hasBoxShadow = style.boxShadow !== "none";

        return {
          visible: hasOutline || hasBoxShadow,
          describe: `<${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 40)}" class="${el.className}"`,
        };
      });

      expect(
        focused.visible,
        `Điểm dừng tab thứ ${i + 1} không có focus nhìn thấy được: ${focused.describe}`
      ).toBe(true);
    }
  });

  test("menu mobile giữ focus bên trong và đóng được bằng Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: /mở menu/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Focus phải nằm trong dialog sau khi mở.
    const focusInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return dialogEl?.contains(document.activeElement) ?? false;
    });
    expect(focusInsideDialog).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Kích thước vùng chạm trên mobile", () => {
  test("nút và liên kết điều hướng đạt tối thiểu 24x24px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // WCAG 2.2 tiêu chí 2.5.8 (Target Size Minimum) yêu cầu 24x24 CSS pixel.
    const tooSmall = await page.locator("button:visible, header a:visible").evaluateAll((els) =>
      els
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && (rect.width < 24 || rect.height < 24);
        })
        .map((el) => `${el.tagName}: ${el.textContent?.trim().slice(0, 30) || el.className}`)
    );

    expect(tooSmall).toEqual([]);
  });
});
