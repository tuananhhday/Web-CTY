import type { MetadataRoute } from "next";
import { clientEnv } from "@/lib/env";
import { getServices, getNews, getMovingService } from "@/modules/cms/service";

/**
 * sitemap.xml (§28).
 *
 * CHỈ chứa trang public canonical. Tuyệt đối không đưa vào: khu vực tài khoản, tài xế,
 * quản trị, trang auth, hay bất kỳ URL nào chứa dữ liệu riêng tư (§7, §28).
 *
 * Trang động lấy `lastModified` từ database để công cụ tìm kiếm biết khi nào cần thu thập
 * lại — không đặt ngày giả để đánh lừa (§22).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/gioi-thieu`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/dich-vu`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/doi-xe`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/khu-vuc-phuc-vu`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/bang-gia`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/bang-gia/boc-xep`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/bao-gia`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/tra-cuu`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/tin-tuc`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/lien-he`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/nguon-hinh-anh`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/chinh-sach/bao-mat`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach/dieu-khoan`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach/van-chuyen`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach/cookie`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const [services, news, movingService] = await Promise.all([
    getServices(),
    getNews(),
    getMovingService(),
  ]);

  const serviceRoutes: MetadataRoute.Sitemap = services.map((service) => ({
    url: `${baseUrl}/dich-vu/${service.slug}`,
    lastModified: service.updatedAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const newsRoutes: MetadataRoute.Sitemap = news.map((post) => ({
    url: `${baseUrl}/tin-tuc/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // /chuyen-nha chỉ tồn tại khi doanh nghiệp bật dịch vụ chuyển nhà.
  const movingRoute: MetadataRoute.Sitemap = movingService
    ? [
        {
          url: `${baseUrl}/chuyen-nha`,
          lastModified: movingService.updatedAt,
          changeFrequency: "monthly",
          priority: 0.8,
        },
      ]
    : [];

  return [...staticRoutes, ...movingRoute, ...serviceRoutes, ...newsRoutes];
}
