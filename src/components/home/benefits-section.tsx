import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { benefits } from "@/config/site-content";

export function BenefitsSection() {
  return (
    <section aria-labelledby="loi-ich-heading" className="py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow="Lợi ích"
          title="Nền tảng giúp việc phối hợp vận chuyển rõ ràng hơn"
        />

        <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <li key={benefit.title} className="flex gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange/10 text-orange-text">
                <DynamicIcon name={benefit.icon} className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-navy">{benefit.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                  {benefit.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
