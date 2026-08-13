import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Info, PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { getServices, getServiceBySlug } from "@/modules/cms/service";
import { processSteps } from "@/config/site-content";
import { getImageSource } from "@/data/image-sources";
import { company } from "@/config/company";

/**
 * Sinh sẵn trang tĩnh cho các dịch vụ đang xuất bản tại thời điểm build.
 * Dịch vụ thêm sau khi build vẫn truy cập được — Next.js render theo yêu cầu rồi cache.
 */
export async function generateStaticParams() {
  const services = await getServices();
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/dich-vu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: "Không tìm thấy dịch vụ" };

  return {
    title: service.seoTitle ?? service.name,
    description: service.seoDescription ?? service.shortDescription,
    alternates: { canonical: `/dich-vu/${slug}` },
    openGraph: {
      title: service.seoTitle ?? service.name,
      description: service.seoDescription ?? service.shortDescription,
      type: "website",
    },
  };
}

export default async function ServiceDetailPage({ params }: PageProps<"/dich-vu/[slug]">) {
  const { slug } = await params;
  const [service, allServices] = await Promise.all([getServiceBySlug(slug), getServices()]);
  if (!service) notFound();

  const image = getImageSource("cargo-loading");
  const otherServices = allServices.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <>
      <PageHeader
        title={service.name}
        description={service.shortDescription}
        breadcrumbs={[{ label: "Dịch vụ", href: "/dich-vu" }, { label: service.name }]}
      />

      <Container className="py-14 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div>
            <Alert variant="warning" className="mb-8">
              <Info aria-hidden />
              <p>
                Mô tả dịch vụ là nội dung minh họa. Phạm vi, điều kiện và chi phí thực tế cần được
                doanh nghiệp xác nhận theo từng yêu cầu.
              </p>
            </Alert>

            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-lg bg-navy/10">
              <Image
                src={image.url}
                alt={image.description}
                fill
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
            </div>

            <h2 className="text-xl font-bold text-navy">Mô tả dịch vụ</h2>
            <p className="mt-3 leading-relaxed text-foreground/75">{service.description}</p>

            <h2 className="mt-10 text-xl font-bold text-navy">Điểm nổi bật</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {service.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-3 text-sm text-foreground/75">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>

            <h2 className="mt-10 text-xl font-bold text-navy">Quy trình thực hiện</h2>
            <ol className="mt-4 flex flex-col gap-3">
              {processSteps.map((step) => (
                <li key={step.step} className="flex gap-3.5 rounded-md border border-border bg-white p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                    {step.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{step.title}</p>
                    <p className="mt-0.5 text-sm text-foreground/70">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-32">
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-base font-bold text-navy">Cần báo giá cho dịch vụ này?</h2>
              <p className="mt-2 text-sm text-foreground/70">
                Gửi thông tin hàng hóa để đội ngũ vận hành xác nhận và phản hồi báo giá.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button asChild>
                  <Link href="/bao-gia">
                    Gửi yêu cầu báo giá
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${company.phone.replace(/\s/g, "")}`}>
                    <PhoneCall className="h-4 w-4" aria-hidden />
                    Gọi {company.phone}
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-base font-bold text-navy">Dịch vụ khác</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {otherServices.map((other) => (
                  <li key={other.id}>
                    <Link
                      href={`/dich-vu/${other.slug}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-medium text-navy transition-colors hover:border-orange/40 hover:bg-orange/5"
                    >
                      {other.name}
                      <ArrowRight className="h-4 w-4 shrink-0 text-orange-text" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
