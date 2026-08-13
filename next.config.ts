import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  /**
   * Chuyển hướng vĩnh viễn từ slug cũ sang cấu trúc route theo §7.1.
   * Dùng 308 (permanent) để công cụ tìm kiếm cập nhật chỉ mục và không mất liên kết cũ (§28).
   */
  async redirects() {
    return [
      { source: "/chinh-sach-bao-mat", destination: "/chinh-sach/bao-mat", permanent: true },
      { source: "/dieu-khoan-su-dung", destination: "/chinh-sach/dieu-khoan", permanent: true },
      { source: "/xac-thuc-email", destination: "/xac-minh", permanent: true },
      // Khu vực khách hàng đổi tiền tố theo §7.3.
      { source: "/khach-hang", destination: "/tai-khoan", permanent: true },
      { source: "/khach-hang/tong-quan", destination: "/tai-khoan", permanent: true },
      { source: "/khach-hang/:path*", destination: "/tai-khoan/:path*", permanent: true },
    ];
  },

  /**
   * Header bảo mật cho `/api/*` (§30.1).
   *
   * Middleware không chạm tới route API — matcher của nó loại `api` ra để handler tự lo phần
   * xác thực. Nhưng header bảo mật thì vẫn cần, đặc biệt là `nosniff` cho `/api/media/[id]`:
   * route đó trả về tệp người dùng tải lên, và nếu trình duyệt tự đoán lại kiểu nội dung thì
   * một tệp được gắn mác ảnh vẫn có thể bị diễn giải thành HTML rồi chạy script.
   *
   * Ở đây không có nonce nên `default-src 'none'` là đủ và chặt hơn hẳn: phản hồi API không
   * bao giờ là tài liệu có script.
   */
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const apiHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Content-Security-Policy",
        value: "default-src 'none'; frame-ancestors 'none'; sandbox",
      },
    ];

    if (isProduction) {
      apiHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [{ source: "/api/:path*", headers: apiHeaders }];
  },
};

export default nextConfig;
