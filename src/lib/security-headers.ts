/**
 * Header bảo mật HTTP (§30.1).
 *
 * Module thuần, không chạm request — kiểm thử được từng chính sách mà không cần dựng server.
 *
 * Đặt ở middleware chứ không ở `next.config.ts` vì CSP nghiêm ngặt cần `nonce` sinh mới cho
 * từng request; cấu hình tĩnh không làm được điều đó.
 */

/**
 * Hai mức CSP, vì một mức không phủ được cả site.
 *
 * - `strict`: dựa trên nonce, không chấp nhận script inline nào ngoài script Next.js được cấp
 *   nonce. Chỉ dùng được cho trang render động, vì nonce phải mới theo từng request.
 *
 * - `static`: dành cho trang prerender. HTML đã sinh sẵn lúc build nên không thể mang nonce
 *   của request hiện tại; ép nonce vào đây sẽ khiến trình duyệt chặn script khởi động của
 *   Next.js và trang mất hoàn toàn tương tác. Mức này buộc phải mở `'unsafe-inline'` cho
 *   script, nhưng vẫn giữ nguyên mọi directive khác.
 */
export type CspProfile = "strict" | "static";

interface CspInput {
  profile: CspProfile;
  isProduction: boolean;
  /** Bắt buộc khi `profile` là `strict`, bỏ qua khi là `static`. */
  nonce?: string;
  /** Host được phép tải ảnh, khớp với `images.remotePatterns` của next/image. */
  imageHosts?: readonly string[];
}

/**
 * Dựng chuỗi Content-Security-Policy (§30.1).
 *
 * Vài lựa chọn cần giải thích, vì nhìn qua sẽ tưởng là lỏng lẻo:
 *
 * - `'strict-dynamic'` cùng nonce: script nào được nonce cho phép thì script nó tải tiếp cũng
 *   được chạy. Đây là cách duy nhất để Next.js hoạt động mà không phải mở `'unsafe-inline'`
 *   cho toàn bộ script. Khi có `'strict-dynamic'`, trình duyệt hỗ trợ sẽ BỎ QUA `'self'` và
 *   `https:` trong `script-src` — hai giá trị đó chỉ còn là dự phòng cho trình duyệt cũ.
 *
 * - `'unsafe-inline'` cho `style-src` ở cả hai mức: Next.js và Tailwind chèn style inline khi
 *   hydrate, và React không truyền nonce vào các thẻ style nó tự tạo. Đây là đánh đổi đã biết
 *   và được chấp nhận rộng rãi — CSS inline không thực thi mã.
 *
 * - `img-src` có `data:` và `blob:`: xem trước ảnh trước khi tải lên cần cả hai.
 *
 * - `frame-ancestors 'none'`: chống clickjacking, thay cho header `X-Frame-Options` cũ.
 *
 * - `upgrade-insecure-requests` chỉ bật ở production; ở local mọi thứ chạy trên http.
 */
export function buildContentSecurityPolicy(input: CspInput): string {
  const { profile, isProduction } = input;
  const imageHosts = input.imageHosts ?? [];

  if (profile === "strict" && !input.nonce) {
    throw new Error("CSP nghiêm ngặt bắt buộc phải có nonce");
  }

  const scriptSrc =
    profile === "strict"
      ? [
          "'self'",
          `'nonce-${input.nonce}'`,
          "'strict-dynamic'",
          // Dự phòng cho trình duyệt không hiểu strict-dynamic.
          "https:",
          ...(isProduction ? [] : ["'unsafe-eval'"]),
        ]
      : [
          // Trang prerender: không có nonce nào áp được, xem ghi chú ở `CspProfile`.
          "'self'",
          "'unsafe-inline'",
          ...(isProduction ? [] : ["'unsafe-eval'"]),
        ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    "script-src": scriptSrc,

    "style-src": ["'self'", "'unsafe-inline'"],

    "img-src": ["'self'", "data:", "blob:", ...imageHosts],

    "font-src": ["'self'", "data:"],

    // Chỉ gọi API về chính mình. Thêm host bên thứ ba ở đây khi tích hợp thật.
    "connect-src": ["'self'", ...(isProduction ? [] : ["ws:", "wss:"])],

    "media-src": ["'self'", "blob:"],

    // Không nhúng plugin, không mở worker từ nguồn ngoài.
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],

    // Form chỉ gửi về chính mình — chặn kiểu tấn công đổi action sang site khác.
    "form-action": ["'self'"],

    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`
  );

  if (isProduction) parts.push("upgrade-insecure-requests");

  return parts.join("; ");
}

/**
 * Header bảo mật không phụ thuộc từng request.
 *
 * `Strict-Transport-Security` CHỈ đặt ở production: bật ở local sẽ khiến trình duyệt ép
 * https cho `localhost` và người phát triển mất truy cập cho tới khi xoá thủ công trong
 * `chrome://net-internals/#hsts`.
 */
export function securityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    // Không đoán lại kiểu nội dung — đoán sai là chạy nhầm HTML từ file người dùng tải lên.
    "X-Content-Type-Options": "nosniff",

    // Không rò rỉ đường dẫn nội bộ sang site khác, nhưng vẫn giữ origin để analytics dùng được.
    "Referrer-Policy": "strict-origin-when-cross-origin",

    /*
     * Tắt sẵn các API trình duyệt không dùng tới.
     *
     * `geolocation=(self)` được giữ lại vì màn hình tài xế cần gửi vị trí (§17), `camera=(self)`
     * vì tài xế chụp ảnh bằng chứng giao hàng (§18); mọi thứ còn lại đóng hoàn toàn.
     */
    "Permissions-Policy": [
      "geolocation=(self)",
      "camera=(self)",
      "microphone=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),

    // Dự phòng cho trình duyệt chưa hỗ trợ frame-ancestors.
    "X-Frame-Options": "DENY",

    // Chặn tài liệu khác truy cập window của trang này qua opener.
    "Cross-Origin-Opener-Policy": "same-origin",
  };

  if (isProduction) {
    // 2 năm, gồm subdomain. `preload` chỉ thêm khi doanh nghiệp thực sự đăng ký danh sách
    // preload của trình duyệt — thêm sớm mà chưa sẵn sàng là tự khoá chính mình.
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }

  return headers;
}

/** Sinh nonce ngẫu nhiên cho một request. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
