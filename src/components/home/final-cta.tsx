import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-cuoi-heading" className="bg-navy-light py-14 text-white md:py-16">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 id="cta-cuoi-heading" className="text-2xl font-bold sm:text-3xl">
            Bạn đã có thông tin hàng hóa cần vận chuyển?
          </h2>
          <p className="mt-2 text-white/75">
            Gửi yêu cầu để đội ngũ vận hành xác nhận thông tin và phản hồi báo giá.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/bao-gia">
              Gửi yêu cầu báo giá
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            <Link href="/lien-he">
              <PhoneCall className="h-4 w-4" aria-hidden />
              Liên hệ tư vấn
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
