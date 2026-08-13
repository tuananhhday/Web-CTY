import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },

  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  /**
   * Chạy trên bản build production, KHÔNG dùng dev server.
   *
   * Dev server biên dịch từng route theo yêu cầu, khiến lần truy cập đầu mất vài giây —
   * nhiều worker chạy song song sẽ gây timeout ngẫu nhiên và test trở nên không tin cậy.
   * Bản build cũng đúng với thứ người dùng thực sự nhận được.
   *
   * Script `test:e2e` đã chạy `next build` trước khi gọi Playwright.
   */
  webServer: {
    command: "pnpm start",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
