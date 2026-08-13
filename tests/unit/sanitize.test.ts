import { describe, it, expect } from "vitest";
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize";

describe("sanitizeRichText — chặn XSS lưu trữ (§30.1)", () => {
  it.each([
    ["<script>alert(1)</script>", "thẻ script"],
    ["<img src=x onerror=alert(1)>", "thuộc tính onerror"],
    ["<iframe src='https://evil.com'></iframe>", "iframe"],
    ["<object data='evil.swf'></object>", "object"],
    ["<embed src='evil.swf'>", "embed"],
    ["<form action='https://evil.com'><input name='pw'></form>", "form đánh cắp dữ liệu"],
    ["<style>body{display:none}</style>", "thẻ style"],
    ["<div onclick='steal()'>bấm</div>", "handler onclick"],
    ["<svg onload='alert(1)'></svg>", "svg onload"],
  ])("loại bỏ %s (%s)", (dirty) => {
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toMatch(/<script|<iframe|<object|<embed|<form|<style|<svg/i);
    expect(clean).not.toMatch(/onerror|onclick|onload/i);
    expect(clean).not.toContain("alert(1)");
  });

  it("không giữ lại nội dung bên trong thẻ script", () => {
    expect(sanitizeRichText("<script>document.cookie</script>")).not.toContain("document.cookie");
  });

  it("chặn javascript: trong href", () => {
    const clean = sanitizeRichText('<a href="javascript:alert(1)">bấm</a>');
    expect(clean).not.toContain("javascript:");
  });

  it("chặn data: URI trong href", () => {
    const clean = sanitizeRichText('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(clean).not.toContain("data:text/html");
  });

  it("loại bỏ thuộc tính style để tránh CSS injection", () => {
    const clean = sanitizeRichText('<p style="position:fixed;top:0">nội dung</p>');
    expect(clean).not.toContain("style=");
    expect(clean).toContain("nội dung");
  });
});

describe("sanitizeRichText — giữ lại nội dung hợp lệ", () => {
  it("giữ các thẻ định dạng cơ bản", () => {
    const html = "<h2>Tiêu đề</h2><p>Đoạn <strong>đậm</strong> và <em>nghiêng</em>.</p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("giữ danh sách", () => {
    const html = "<ul><li>Mục một</li><li>Mục hai</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("giữ bảng", () => {
    const html = "<table><thead><tr><th>Loại xe</th></tr></thead><tbody><tr><td>Xe tải nhẹ</td></tr></tbody></table>";
    expect(sanitizeRichText(html)).toContain("<table>");
    expect(sanitizeRichText(html)).toContain("Xe tải nhẹ");
  });

  it("giữ tiếng Việt có dấu nguyên vẹn", () => {
    const html = "<p>Vận chuyển hàng hóa từ Đà Nẵng đi Hà Nội</p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("giữ ảnh có alt", () => {
    const clean = sanitizeRichText('<img src="/anh.jpg" alt="Xe tải">');
    expect(clean).toContain('src="/anh.jpg"');
    expect(clean).toContain('alt="Xe tải"');
  });
});

describe("sanitizeRichText — liên kết ngoài", () => {
  it("gắn rel=noopener noreferrer cho liên kết ngoài (§5)", () => {
    const clean = sanitizeRichText('<a href="https://unsplash.com">Nguồn ảnh</a>');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });

  it("ghi đè rel do người dùng tự đặt", () => {
    const clean = sanitizeRichText('<a href="https://evil.com" rel="opener">x</a>');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).not.toContain('rel="opener"');
  });

  it("liên kết nội bộ KHÔNG mở tab mới", () => {
    const clean = sanitizeRichText('<a href="/dich-vu">Dịch vụ</a>');
    expect(clean).not.toContain("target=");
    expect(clean).toContain('href="/dich-vu"');
  });

  it("giữ mailto và tel", () => {
    expect(sanitizeRichText('<a href="mailto:a@b.vn">Email</a>')).toContain("mailto:a@b.vn");
    expect(sanitizeRichText('<a href="tel:19006868">Hotline</a>')).toContain("tel:19006868");
  });
});

describe("htmlToPlainText", () => {
  it("bỏ toàn bộ thẻ HTML", () => {
    expect(htmlToPlainText("<h2>Tiêu đề</h2><p>Nội dung</p>")).toBe("Tiêu đềNội dung");
  });

  it("gộp khoảng trắng thừa", () => {
    expect(htmlToPlainText("<p>Nhiều    khoảng   trắng</p>")).toBe("Nhiều khoảng trắng");
  });

  it("cắt theo độ dài tối đa tại ranh giới từ", () => {
    const full = "Dịch vụ vận chuyển hàng hóa nội thành và liên tỉnh trên toàn quốc";
    const result = htmlToPlainText(`<p>${full}</p>`, 30);

    expect(result.length).toBeLessThanOrEqual(31);
    expect(result).toMatch(/…$/);

    // Phần đã cắt phải là tiền tố của chuỗi gốc, và ký tự kế tiếp trong chuỗi gốc
    // phải là khoảng trắng — nghĩa là không có từ nào bị đứt đôi.
    const truncated = result.slice(0, -1);
    expect(full.startsWith(truncated)).toBe(true);
    expect(full[truncated.length]).toBe(" ");
  });

  it("không cắt khi chuỗi ngắn hơn giới hạn", () => {
    expect(htmlToPlainText("<p>Ngắn</p>", 100)).toBe("Ngắn");
  });

  it("loại bỏ cả script khi rút text", () => {
    expect(htmlToPlainText("<p>An toàn</p><script>alert(1)</script>")).toBe("An toàn");
  });
});
