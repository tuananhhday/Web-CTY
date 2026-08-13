import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/shared/container";

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <section className="border-b border-border bg-navy py-10 text-white md:py-14">
      <Container>
        {breadcrumbs.length > 0 && (
          <nav aria-label="Đường dẫn" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-white/60">
              <li>
                <Link href="/" className="hover:text-white">
                  Trang chủ
                </Link>
              </li>
              {breadcrumbs.map((crumb) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-white">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white/85">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-3xl text-white/75">{description}</p>}
      </Container>
    </section>
  );
}
