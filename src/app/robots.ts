import type { MetadataRoute } from "next";
import { clientEnv } from "@/lib/env";

/**
 * robots.txt (§28).
 *
 * Chặn lập chỉ mục toàn bộ khu vực riêng tư và các endpoint kỹ thuật. Trang tra cứu
 * công khai vẫn cho index nhưng URL kèm mã vận đơn thì không — mã vận đơn là dữ liệu
 * riêng của khách, không được lọt vào kết quả tìm kiếm (§16.1, §28).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/tai-khoan",
          "/tai-khoan/",
          "/tai-xe",
          "/tai-xe/",
          "/quan-tri",
          "/quan-tri/",
          "/dang-nhap",
          "/dang-ky",
          "/quen-mat-khau",
          "/dat-lai-mat-khau",
          "/xac-minh",
          // Kết quả tra cứu gắn mã vận đơn trong query — không lập chỉ mục.
          "/tra-cuu?*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
