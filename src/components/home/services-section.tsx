import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { getServices } from "@/modules/cms/service";

export async function ServicesSection() {
  const services = await getServices();

  // Chưa có dịch vụ nào được xuất bản thì ẩn cả khối thay vì hiện lưới rỗng.
  if (services.length === 0) return null;

  return (
    <section aria-labelledby="dich-vu-heading" className="py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow="Dịch vụ"
          title="Dịch vụ vận chuyển theo nhu cầu"
          description="Danh mục dịch vụ được phân nhóm theo nhu cầu vận chuyển phổ biến."
        />

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id}>
              <article className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6 transition-colors hover:border-navy/25">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-navy/5 text-navy transition-colors group-hover:bg-orange/10 group-hover:text-orange-text">
                  <DynamicIcon name={service.icon ?? "Truck"} className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-navy">{service.name}</h3>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {service.shortDescription}
                </p>
                <Link
                  href={`/dich-vu/${service.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text rounded-sm"
                >
                  Xem chi tiết
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
