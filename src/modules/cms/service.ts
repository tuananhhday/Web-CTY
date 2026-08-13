import "server-only";
import { cache } from "react";
import * as repo from "@/modules/cms/repository";
import { company as fallbackCompany } from "@/config/company";

/**
 * Tầng nghiệp vụ cho nội dung website.
 *
 * Hai nhiệm vụ:
 *   1. Bọc `cache()` của React — nhiều Server Component trong cùng một request chỉ truy
 *      vấn database một lần (ví dụ header và footer cùng cần thông tin liên hệ).
 *   2. Điền giá trị dự phòng khi doanh nghiệp chưa nhập nội dung, kèm cờ báo rõ đây là
 *      dữ liệu tạm — trang không được hiển thị như thể đã có thông tin thật (§1).
 */

export interface CompanyView {
  legalName: string;
  brandName: string;
  slogan: string | null;
  description: string | null;
  taxCode: string | null;
  /** Danh sách trường doanh nghiệp chưa cung cấp. Giao diện dùng để hiện nhãn nhắc nhở. */
  pendingFields: string[];
  /** true khi chưa có bản ghi nào trong database, đang dùng hoàn toàn giá trị dự phòng. */
  isFallback: boolean;
}

export const getCompany = cache(async (): Promise<CompanyView> => {
  const profile = await repo.getCompanyProfile();

  if (!profile) {
    return {
      legalName: fallbackCompany.name,
      brandName: fallbackCompany.shortName,
      slogan: fallbackCompany.slogan,
      description: null,
      taxCode: null,
      pendingFields: ["legalName", "brandName", "taxCode", "description"],
      isFallback: true,
    };
  }

  const needsUpdate = (value: string | null, field: string) =>
    !value || value === "Cần doanh nghiệp cập nhật" || profile.pendingFields.includes(field);

  return {
    legalName: needsUpdate(profile.legalName, "legalName")
      ? fallbackCompany.name
      : profile.legalName,
    brandName: needsUpdate(profile.brandName, "brandName")
      ? fallbackCompany.shortName
      : profile.brandName,
    slogan: profile.slogan ?? fallbackCompany.slogan,
    description: profile.description,
    taxCode: profile.taxCode,
    pendingFields: profile.pendingFields,
    isFallback: false,
  };
});

export interface ContactView {
  hotline: string;
  email: string;
  zalo: string | null;
  address: string;
  workingHours: string;
  socials: { label: string; url: string; type: string }[];
  /** true khi đang dùng giá trị trong src/config/company.ts vì database chưa có dữ liệu. */
  isFallback: boolean;
}

export const getContactInfo = cache(async (): Promise<ContactView> => {
  const [channels, offices] = await Promise.all([
    repo.getActiveContactChannels(),
    repo.getPublicOffices(),
  ]);

  const first = (type: string) => channels.find((c) => c.type === type);
  const headOffice = offices.find((o) => o.kind === "HEAD_OFFICE") ?? offices[0];

  const hotline = first("HOTLINE")?.value ?? first("PHONE")?.value;
  const email = first("EMAIL")?.value;

  const socials = channels
    .filter((c) => ["FACEBOOK", "YOUTUBE", "TIKTOK", "ZALO"].includes(c.type) && c.url)
    .map((c) => ({ label: c.label, url: c.url as string, type: c.type }));

  const addressParts = headOffice
    ? [headOffice.line, headOffice.ward, headOffice.district, headOffice.province].filter(Boolean)
    : [];

  return {
    hotline: hotline ?? fallbackCompany.phone,
    email: email ?? fallbackCompany.email,
    zalo: first("ZALO")?.value ?? fallbackCompany.zalo,
    address: addressParts.length > 0 ? addressParts.join(", ") : fallbackCompany.address,
    workingHours: headOffice?.workingHours ?? fallbackCompany.workingHours,
    socials,
    isFallback: channels.length === 0 && offices.length === 0,
  };
});

export const getServices = cache(async () => repo.getPublishedServices());

export const getServiceBySlug = cache(async (slug: string) =>
  repo.getPublishedServiceBySlug(slug)
);

export const getMovingService = cache(async () => repo.getMovingService());

export const getServiceAreas = cache(async () => repo.getPublishedServiceAreas());

/** Nhóm khu vực theo tỉnh/thành để hiển thị theo miền hoặc theo tỉnh. */
export const getServiceAreasByProvince = cache(async () => {
  const areas = await repo.getPublishedServiceAreas();
  const grouped = new Map<string, typeof areas>();

  for (const area of areas) {
    const existing = grouped.get(area.province);
    if (existing) existing.push(area);
    else grouped.set(area.province, [area]);
  }

  return Array.from(grouped, ([province, items]) => ({ province, areas: items }));
});

export const getVehicleTypes = cache(async () => repo.getPublishedVehicleTypes());

export const getVehicleTypeBySlug = cache(async (slug: string) =>
  repo.getPublishedVehicleTypeBySlug(slug)
);

export const getFaqs = cache(async (limit?: number) => repo.getPublishedFaqs(limit));

/** Nhóm FAQ theo chuyên mục cho trang /faq. */
export const getFaqsByCategory = cache(async () => {
  const faqs = await repo.getPublishedFaqs();
  const grouped = new Map<string, typeof faqs>();

  for (const faq of faqs) {
    const key = faq.category ?? "Câu hỏi chung";
    const existing = grouped.get(key);
    if (existing) existing.push(faq);
    else grouped.set(key, [faq]);
  }

  return Array.from(grouped, ([category, items]) => ({ category, faqs: items }));
});

export const getStaticPage = cache(async (slug: string) => repo.getPublishedStaticPage(slug));

export const getNews = cache(async (options: { limit?: number; skip?: number } = {}) =>
  repo.getPublishedNews(options)
);

export const countNews = cache(async () => repo.countPublishedNews());

export const getNewsBySlug = cache(async (slug: string) => repo.getPublishedNewsBySlug(slug));

export const getRelatedNews = cache(async (slug: string, categoryId: string | null) =>
  repo.getRelatedNews(slug, categoryId)
);

export const getTransportPricing = cache(async () =>
  repo.getActivePriceCatalogVersion("bang-gia-van-chuyen")
);

export const getLaborPricing = cache(async () => repo.getActiveLaborRates("bang-gia-boc-xep"));

export const getPublicSettings = cache(async () => repo.getPublicSettings());

/**
 * Bảng giá hiện tại có phải chỉ mang tính tham khảo không (§13.1).
 * Khi true, mọi trang giá phải hiển thị cảnh báo rõ ràng.
 */
export const isPricingReferenceOnly = cache(async (): Promise<boolean> => {
  const settings = await repo.getPublicSettings();
  return settings["site.pricing_is_reference_only"] !== false;
});
