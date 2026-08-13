import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { getFaqs } from "@/modules/cms/service";

export async function FaqSection() {
  // Trang chủ chỉ hiện 6 câu đầu; danh sách đầy đủ nằm ở /faq.
  const faqItems = await getFaqs(6);

  if (faqItems.length === 0) return null;

  return (
    <section aria-labelledby="faq-heading" className="py-16 md:py-20">
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow="Hỏi đáp"
          title="Câu hỏi thường gặp"
          align="center"
        />

        <Accordion type="single" collapsible className="mt-8">
          {faqItems.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
