import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { clientEnv } from "@/lib/env";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Breadcrumb điều hướng (§28, §29).
 *
 * Render đồng thời hai thứ từ cùng một nguồn dữ liệu: phần hiển thị cho người dùng và
 * JSON-LD `BreadcrumbList` cho công cụ tìm kiếm. Giữ chung một mảng để hai bên không lệch nhau.
 *
 * Mục cuối không có link và mang `aria-current="page"`.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Đường dẫn điều hướng" className="py-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/35" aria-hidden />
                )}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="rounded-sm hover:text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined} className="font-medium text-navy">
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <script
        type="application/ld+json"
        // Dữ liệu do máy chủ sinh từ mảng items, không chứa nội dung người dùng nhập.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
