import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { processSteps } from "@/config/site-content";

export function ProcessSection() {
  return (
    <section aria-labelledby="quy-trinh-heading" className="py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow="Quy trình"
          title="Quy trình vận chuyển gồm 5 bước"
          description="Mỗi bước đều có xác nhận rõ ràng giữa khách hàng và đội ngũ vận hành."
        />

        <ol className="mt-10 grid gap-6 md:grid-cols-5 md:gap-4">
          {processSteps.map((step, index) => (
            <li key={step.step} className="relative flex gap-4 md:flex-col md:gap-3">
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                  {step.step}
                </span>
                {index < processSteps.length - 1 && (
                  <>
                    <span
                      className="mt-1 w-px flex-1 bg-border md:hidden"
                      aria-hidden
                    />
                    <span
                      className="hidden h-px flex-1 bg-border md:block"
                      aria-hidden
                    />
                  </>
                )}
              </div>
              <div className="pb-6 md:pb-0">
                <h3 className="text-base font-bold text-navy">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
