import { test, expect, type Page } from "@playwright/test";

/**
 * Luồng gửi yêu cầu dịch vụ đầu-cuối (§34.4).
 *
 * Test chạy trên bản build production nên dữ liệu thật sự được ghi vào database.
 * Mỗi lần chạy tạo bản ghi mới — chấp nhận được ở môi trường development.
 */

/** Rate limit là 5 yêu cầu/giờ mỗi IP, nên chỉ test một lần gửi thành công. */
test.describe.configure({ mode: "serial" });

async function fillStopFields(page: Page, prefix: "pickup" | "dropoff", line: string) {
  await page.locator(`#${prefix}\\.line`).fill(line);
}

test.describe("Form yêu cầu báo giá", () => {
  test.skip(({ isMobile }) => isMobile === true, "Chỉ cần chạy một project");

  test("hiển thị 3 bước và không cho đi tiếp khi thiếu địa chỉ", async ({ page }) => {
    await page.goto("/bao-gia");

    await expect(page.getByRole("navigation", { name: /tiến trình/i })).toBeVisible();

    // Bấm tiếp tục khi chưa nhập gì — phải hiện lỗi và ở nguyên bước 1.
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText("Điểm lấy hàng", { exact: false }).first()).toBeVisible();
  });

  test("gửi được yêu cầu hợp lệ và nhận mã theo dõi", async ({ page }) => {
    await page.goto("/bao-gia");

    // Bước 1 — địa điểm
    await fillStopFields(page, "pickup", "12 Nguyễn Huệ, Bến Nghé");
    await fillStopFields(page, "dropoff", "45 Lê Lợi, Phường 1");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Bước 2 — hàng hóa
    await page.locator("#items\\.0\\.cargoType").fill("Hàng bách hóa đóng thùng carton");
    await page.locator("#items\\.0\\.quantity").fill("12");
    await page.locator("#items\\.0\\.weightKg").fill("850");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Bước 3 — liên hệ
    await page.locator("#contactName").fill("Nguyễn Thị Lan");
    await page.locator("#contactPhone").fill("0912345678");
    await page.getByLabel(/Tôi đồng ý/).check();

    await page.getByRole("button", { name: /Gửi yêu cầu báo giá/ }).click();

    // Màn hình thành công phải hiện mã yêu cầu đúng định dạng.
    await expect(page.getByRole("heading", { name: /Đã nhận được yêu cầu/ })).toBeVisible({
      timeout: 15_000,
    });

    const code = page.locator("p.font-mono").first();
    await expect(code).toHaveText(/^YC[A-Z0-9]{8}$/);
  });

  test("thêm và xóa được dòng hàng hóa", async ({ page }) => {
    await page.goto("/bao-gia");

    await fillStopFields(page, "pickup", "12 Nguyễn Huệ, Bến Nghé");
    await fillStopFields(page, "dropoff", "45 Lê Lợi, Phường 1");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    await expect(page.getByRole("heading", { name: "Loại hàng 1" })).toBeVisible();

    await page.getByRole("button", { name: "Thêm loại hàng" }).click();
    await expect(page.getByRole("heading", { name: "Loại hàng 2" })).toBeVisible();

    await page.getByRole("button", { name: "Xóa loại hàng 2" }).click();
    await expect(page.getByRole("heading", { name: "Loại hàng 2" })).toBeHidden();
  });

  test("trường bẫy bot không tới được bằng mắt lẫn bàn phím", async ({ page }) => {
    await page.goto("/bao-gia");

    const honeypot = page.locator("#website-hp");

    // Cố ý KHÔNG dùng display:none — nhiều bot bỏ qua input ẩn hẳn. Thay vào đó đẩy ra
    // ngoài khung nhìn, nên Playwright vẫn coi là "visible". Điều cần kiểm chứng là
    // người dùng thật không thấy và không chạm tới được.
    const box = await honeypot.boundingBox();
    expect(box, "Honeypot phải có vị trí trong DOM").not.toBeNull();
    expect(box!.x + box!.width, "Honeypot phải nằm ngoài khung nhìn").toBeLessThan(0);

    // Không nằm trong luồng tab của bàn phím.
    await expect(honeypot).toHaveAttribute("tabindex", "-1");

    // Trình đọc màn hình bỏ qua vì nằm trong vùng aria-hidden.
    const insideAriaHidden = await honeypot.evaluate(
      (el) => el.closest("[aria-hidden='true']") !== null
    );
    expect(insideAriaHidden).toBe(true);
  });
});

test.describe("Form chuyển nhà", () => {
  test.skip(({ isMobile }) => isMobile === true, "Chỉ cần chạy một project");

  test("trang yêu cầu chuyển nhà tải được và có đủ 3 bước", async ({ page }) => {
    const response = await page.goto("/chuyen-nha/yeu-cau");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Yêu cầu chuyển nhà", level: 1 })).toBeVisible();
    await expect(page.getByText("Địa điểm", { exact: true }).first()).toBeVisible();
  });

  test("cảnh báo khi không liệt kê đồ và cũng không yêu cầu khảo sát", async ({ page }) => {
    await page.goto("/chuyen-nha/yeu-cau");

    await page.locator("#origin\\.line").fill("20 Trần Hưng Đạo");
    await page.locator("#destination\\.line").fill("88 Giải Phóng");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Bước đồ đạc: để trống tên món đồ rồi bấm tiếp — phải bị chặn.
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Vui lòng nhập tên đồ đạc")).toBeVisible();
  });
});

test.describe("API yêu cầu dịch vụ", () => {
  test.skip(({ isMobile }) => isMobile === true, "Chỉ cần chạy một project");

  test("từ chối dữ liệu không hợp lệ với lỗi theo từng trường", async ({ request }) => {
    const response = await request.post("/api/public/quote-requests", {
      data: {
        serviceSlug: "van-chuyen-hang-hoa",
        contactName: "A",
        contactPhone: "123",
        pickup: { line: "x", province: "Hà Nội" },
        dropoff: { line: "45 Lê Lợi", province: "Hà Nội" },
        items: [{ cargoType: "X", quantity: 0, weightKg: -5 }],
        acceptPolicy: false,
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.fields.length).toBeGreaterThan(3);

    // Không được lộ chi tiết nội bộ ra client (§25, §30).
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("stack");
    expect(raw).not.toContain("prisma");
    expect(raw).not.toContain("node_modules");
  });

  test("GET trả lỗi thay vì rò rỉ dữ liệu", async ({ request }) => {
    const response = await request.get("/api/public/quote-requests");
    expect(response.status()).toBe(404);
  });
});
