import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Alert } from "@/components/ui/alert";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { getServices } from "@/modules/cms/service";

export const metadata: Metadata = {
  title: "Dịch vụ",
  description: "Danh mục dịch vụ vận chuyển hàng hóa được phân nhóm theo nhu cầu khách hàng.",
};

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <>
      <PageHeader
        title="Dịch vụ vận chuyển"
        description="Dịch vụ được phân nhóm theo nhu cầu vận chuyển phổ biến của khách hàng cá nhân và doanh nghiệp."
        breadcrumbs={[{ label: "Dịch vụ" }]}
      />

      <Container className="py-14 md:py-16">
        <Alert variant="warning" className="mb-10">
          <Info aria-hidden />
          <p>
            Danh mục dịch vụ hiển thị là nội dung minh họa. Dịch vụ thực tế cần được doanh nghiệp
            xác nhận trước khi công bố chính thức.
          </p>
        </Alert>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id}>
              <article className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6 transition-colors hover:border-navy/25">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-navy/5 text-navy transition-colors group-hover:bg-orange/10 group-hover:text-orange-text">
                  <DynamicIcon name={service.icon ?? "Truck"} className="h-5 w-5" />
                </span>
                <h2 className="text-base font-bold text-navy">{service.name}</h2>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {service.shortDescription}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-foreground/70">
                  {service.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-orange" aria-hidden />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/dich-vu/${service.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text rounded-sm"
                >
                  Xem chi tiết
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
