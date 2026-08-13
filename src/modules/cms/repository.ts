import "server-only";
import { db } from "@/lib/db";

/**
 * Truy cập dữ liệu nội dung website (§10).
 *
 * NGUYÊN TẮC AN TOÀN: mọi hàm `getPublic*` chỉ trả về bản ghi `status = PUBLISHED`.
 * Bản nháp không bao giờ lọt ra trang công khai kể cả khi đoán đúng slug. Xem bản nháp
 * là chức năng riêng của trang quản trị, có kiểm tra quyền (§10).
 */

const PUBLISHED = "PUBLISHED" as const;

// -----------------------------------------------------------------------------
// Thông tin doanh nghiệp
// -----------------------------------------------------------------------------

export async function getCompanyProfile() {
  return db.companyProfile.findFirst();
}

export async function getPublicOffices() {
  return db.office.findMany({
    where: { isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getActiveContactChannels() {
  return db.contactChannel.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

// -----------------------------------------------------------------------------
// Dịch vụ
// -----------------------------------------------------------------------------

export async function getPublishedServices() {
  return db.service.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getPublishedServiceBySlug(slug: string) {
  return db.service.findFirst({
    where: { slug, status: PUBLISHED },
  });
}

/** Dịch vụ chuyển nhà — quyết định trang /chuyen-nha có hiển thị hay không (§3.1). */
export async function getMovingService() {
  return db.service.findFirst({
    where: { status: PUBLISHED, isMovingService: true },
    orderBy: { sortOrder: "asc" },
  });
}

// -----------------------------------------------------------------------------
// Khu vực phục vụ
// -----------------------------------------------------------------------------

export async function getPublishedServiceAreas() {
  return db.serviceArea.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ sortOrder: "asc" }, { province: "asc" }],
  });
}

// -----------------------------------------------------------------------------
// Phương tiện
// -----------------------------------------------------------------------------

export async function getPublishedVehicleTypes() {
  return db.vehicleType.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getPublishedVehicleTypeBySlug(slug: string) {
  return db.vehicleType.findFirst({
    where: { slug, status: PUBLISHED },
  });
}

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------

export async function getPublishedFaqs(limit?: number) {
  return db.faq.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ sortOrder: "asc" }],
    ...(limit ? { take: limit } : {}),
  });
}

// -----------------------------------------------------------------------------
// Trang tĩnh
// -----------------------------------------------------------------------------

export async function getPublishedStaticPage(slug: string) {
  return db.staticPage.findFirst({
    where: { slug, status: PUBLISHED },
  });
}

export async function getPublishedStaticPageSlugs() {
  const pages = await db.staticPage.findMany({
    where: { status: PUBLISHED },
    select: { slug: true, updatedAt: true },
  });
  return pages;
}

// -----------------------------------------------------------------------------
// Tin tức
// -----------------------------------------------------------------------------

const NEWS_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  updatedAt: true,
  category: { select: { name: true, slug: true } },
  coverImage: { select: { objectKey: true, altText: true, sourceUrl: true } },
} as const;

/**
 * Bài đã xuất bản. Loại bỏ bài `SCHEDULED` chưa tới giờ bằng điều kiện `publishedAt <= now`
 * — không dựa vào job nền để đổi trạng thái.
 */
export async function getPublishedNews(options: { limit?: number; skip?: number } = {}) {
  return db.newsPost.findMany({
    where: { status: PUBLISHED, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    select: NEWS_LIST_SELECT,
    ...(options.limit ? { take: options.limit } : {}),
    ...(options.skip ? { skip: options.skip } : {}),
  });
}

export async function countPublishedNews() {
  return db.newsPost.count({
    where: { status: PUBLISHED, publishedAt: { lte: new Date() } },
  });
}

export async function getPublishedNewsBySlug(slug: string) {
  return db.newsPost.findFirst({
    where: { slug, status: PUBLISHED, publishedAt: { lte: new Date() } },
    include: {
      category: { select: { name: true, slug: true } },
      coverImage: { select: { objectKey: true, altText: true, sourceUrl: true } },
      tags: { select: { name: true, slug: true } },
    },
  });
}

/** Bài liên quan: cùng chuyên mục, loại trừ chính bài đang xem (§22). */
export async function getRelatedNews(slug: string, categoryId: string | null, limit = 3) {
  return db.newsPost.findMany({
    where: {
      status: PUBLISHED,
      publishedAt: { lte: new Date() },
      slug: { not: slug },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: NEWS_LIST_SELECT,
  });
}

// -----------------------------------------------------------------------------
// Bảng giá
// -----------------------------------------------------------------------------

/**
 * Phiên bản bảng giá đang hiệu lực tại thời điểm hiện tại (§13.1).
 * Lấy bản mới nhất có `effectiveFrom <= now` và chưa hết hiệu lực.
 */
export async function getActivePriceCatalogVersion(catalogSlug: string) {
  const now = new Date();
  return db.priceCatalogVersion.findFirst({
    where: {
      status: PUBLISHED,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      priceCatalog: { slug: catalogSlug, isActive: true },
    },
    orderBy: { effectiveFrom: "desc" },
    include: {
      priceCatalog: { select: { name: true, description: true } },
      vehicleRates: {
        orderBy: { basePrice: "asc" },
        include: { vehicleType: { select: { name: true, slug: true } } },
      },
      surchargeRules: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getActiveLaborRates(catalogSlug: string) {
  const now = new Date();
  const version = await db.priceCatalogVersion.findFirst({
    where: {
      status: PUBLISHED,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      priceCatalog: { slug: catalogSlug, isActive: true },
    },
    orderBy: { effectiveFrom: "desc" },
    include: {
      priceCatalog: { select: { name: true, description: true } },
      laborRates: { orderBy: { price: "asc" } },
      surchargeRules: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return version;
}

// -----------------------------------------------------------------------------
// Cấu hình hệ thống công khai
// -----------------------------------------------------------------------------

/** Chỉ trả về khoá được đánh dấu `isPublic` — không bao giờ lộ cấu hình nội bộ (§24.8). */
export async function getPublicSettings() {
  const rows = await db.systemSetting.findMany({
    where: { isPublic: true },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
