import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { getFaqsByCategory } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Câu hỏi thường gặp",
  description:
    "Giải đáp về quy trình báo giá, tra cứu đơn hàng, chi phí vận chuyển và cách theo dõi hàng hóa.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const groups = await getFaqsByCategory();
  const allFaqs = groups.flatMap((group) => group.faqs);

  // JSON-LD FAQPage giúp công cụ tìm kiếm hiển thị câu hỏi trực tiếp (§28).
  // Chỉ đưa vào câu hỏi thật đang xuất bản, không bịa thêm.
  const jsonLd =
    allFaqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: allFaqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <Container className="pb-16">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Câu hỏi thường gặp" }]} />

      <SectionHeading
        eyebrow="HỖ TRỢ"
        title="Câu hỏi thường gặp"
        as="h1"
        description="Những thắc mắc phổ biến về quy trình báo giá, vận chuyển và theo dõi đơn hàng."
      />

      {groups.length === 0 ? (
        <Card className="mt-10">
          <CardContent className="py-12 text-center">
            <HelpCircle className="mx-auto h-10 w-10 text-navy/30" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có câu hỏi nào</p>
            <p className="mt-1.5 text-sm text-foreground/65">
              Nội dung sẽ hiển thị sau khi được cập nhật trong trang quản trị.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 max-w-3xl">
          {groups.map((group) => (
            <section key={group.category} className="mb-10 last:mb-0">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                {group.category}
              </h2>
              <Accordion type="single" collapsible className="border-t border-border">
                {group.faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-lg border border-border bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold text-navy">Chưa tìm thấy câu trả lời?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
          Gửi câu hỏi cho đội ngũ hỗ trợ, chúng tôi phản hồi trong giờ làm việc.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/lien-he">Gửi câu hỏi</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/bao-gia">Yêu cầu báo giá</Link>
          </Button>
        </div>
      </div>

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Container>
  );
}
