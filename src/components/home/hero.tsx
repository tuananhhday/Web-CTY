import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { getImageSource } from "@/data/image-sources";

const trustPoints = [
  "Quy trình xác nhận rõ ràng",
  "Thông tin vận chuyển minh bạch",
  "Hỗ trợ theo dõi trạng thái",
];

export function Hero() {
  const heroImage = getImageSource("hero-truck-highway");

  return (
    <section className="relative isolate overflow-hidden bg-navy">
      <div className="absolute inset-0 -z-10 bg-navy">
        <Image
          src={heroImage.url}
          alt={heroImage.description}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40"
          aria-hidden
        />
      </div>

      <Container className="py-16 md:py-24 lg:py-28">
        <div className="max-w-2xl">
          <span className="inline-block rounded-sm border-l-2 border-orange pl-3 text-xs font-bold uppercase tracking-[0.18em] text-orange">
            Giải pháp vận tải hàng hóa
          </span>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            Vận chuyển hàng hóa chủ động, minh bạch và đúng kế hoạch
          </h1>

          <p className="mt-5 text-base leading-relaxed text-white/80 sm:text-lg">
            Tiếp nhận yêu cầu, đề xuất phương tiện phù hợp và theo dõi trạng thái vận chuyển
            trên một nền tảng rõ ràng.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/bao-gia">
                Yêu cầu báo giá
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/tra-cuu">
                <Search className="h-4 w-4" aria-hidden />
                Tra cứu vận đơn
              </Link>
            </Button>
          </div>

          <ul className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm text-white/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-orange" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
