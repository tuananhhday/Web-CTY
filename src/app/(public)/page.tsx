import { Hero } from "@/components/home/hero";
import { QuickActions } from "@/components/home/quick-actions";
import { ServicesSection } from "@/components/home/services-section";
import { ProcessSection } from "@/components/home/process-section";
import { FleetSection } from "@/components/home/fleet-section";
import { BenefitsSection } from "@/components/home/benefits-section";
import { ServiceAreaSection } from "@/components/home/service-area-section";
import { FaqSection } from "@/components/home/faq-section";
import { FinalCta } from "@/components/home/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickActions />
      <ServicesSection />
      <ProcessSection />
      <FleetSection />
      <BenefitsSection />
      <ServiceAreaSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
