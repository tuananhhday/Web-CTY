import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Alert } from "@/components/ui/alert";
import { imageSources } from "@/data/image-sources";

export const metadata: Metadata = {
  title: "Nguồn hình ảnh",
  description: "Danh sách nguồn của toàn bộ hình ảnh minh họa được sử dụng trên website.",
};

export default function ImageSourcesPage() {
  return (
    <>
      <PageHeader
        title="Nguồn hình ảnh"
        description="Toàn bộ hình ảnh minh họa trên website được lấy từ Unsplash. Danh sách dưới đây dẫn tới trang nguồn của từng ảnh."
        breadcrumbs={[{ label: "Nguồn hình ảnh" }]}
      />

      <Container className="py-14 md:py-16">
        <Alert variant="info" className="mb-10">
          <Info aria-hidden />
          <p>
            Đây là ảnh minh họa dùng trong giai đoạn thiết kế giao diện. Khi doanh nghiệp cung cấp
            ảnh xe và kho bãi thực tế, các ảnh này sẽ được thay thế.
          </p>
        </Alert>

        <ul className="grid gap-6 md:grid-cols-2">
          {imageSources.map((source) => (
            <li key={source.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white">
                <div className="relative aspect-[16/9] bg-navy/10">
                  <Image
                    src={source.url}
                    alt={source.description}
                    fill
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <h2 className="text-base font-bold text-navy">{source.description}</h2>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-muted">Sử dụng tại:</dt>
                      <dd className="text-foreground/80">{source.usage}</dd>
                    </div>
                    {source.author && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-muted">Nguồn:</dt>
                        <dd className="text-foreground/80">{source.author}</dd>
                      </div>
                    )}
                  </dl>
                  <a
                    href={source.sourcePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex w-fit items-center gap-1.5 pt-2 text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text rounded-sm"
                  >
                    Xem trang nguồn ảnh
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    <span className="sr-only">(mở trong tab mới)</span>
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
