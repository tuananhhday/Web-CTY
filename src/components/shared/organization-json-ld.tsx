import { getCompany, getContactInfo } from "@/modules/cms/service";
import { clientEnv } from "@/lib/env";

/**
 * JSON-LD Organization (§28).
 *
 * Chỉ khai báo dữ liệu đã được xác nhận. KHÔNG đưa vào `aggregateRating`, `review` hay
 * `priceRange` — những trường đó cần số liệu thật, bịa ra là vi phạm §1 và cũng vi phạm
 * chính sách structured data của công cụ tìm kiếm.
 *
 * Dùng type `Organization` thay vì `LocalBusiness`: subtype LocalBusiness đòi hỏi dữ liệu
 * địa chỉ và giờ mở cửa đã kiểm chứng, hiện chưa có (§28).
 */
export async function OrganizationJsonLd() {
  const [company, contact] = await Promise.all([getCompany(), getContactInfo()]);

  // Chưa có thông tin doanh nghiệp thật thì không phát structured data sai lệch.
  if (company.isFallback) return null;

  const baseUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.legalName,
    url: baseUrl,
    ...(company.brandName !== company.legalName ? { alternateName: company.brandName } : {}),
    ...(company.description ? { description: company.description } : {}),
    ...(company.taxCode ? { taxID: company.taxCode } : {}),
  };

  if (!contact.isFallback) {
    jsonLd.contactPoint = {
      "@type": "ContactPoint",
      telephone: contact.hotline,
      email: contact.email,
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: ["vi"],
    };

    if (contact.socials.length > 0) {
      jsonLd.sameAs = contact.socials.map((social) => social.url);
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
