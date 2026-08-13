import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getNews } from "@/modules/cms/service";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Tin tức",
  description: "Bài viết hướng dẫn và thông tin liên quan đến hoạt động vận chuyển hàng hóa.",
};

export default async function NewsPage() {
  const newsArticles = await getNews();

  return (
    <>
      <PageHeader
        title="Tin tức và hướng dẫn"
        description="Bài viết hướng dẫn giúp khách hàng chuẩn bị thông tin và theo dõi quá trình vận chuyển thuận tiện hơn."
        breadcrumbs={[{ label: "Tin tức" }]}
      />

      <Container className="py-14 md:py-16">
        <Alert variant="warning" className="mb-10">
          <Info aria-hidden />
          <p>
            Các bài viết hiển thị là nội dung minh họa cho giai đoạn thiết kế giao diện. Nội dung
            chính thức cần được doanh nghiệp biên soạn trước khi công bố.
          </p>
        </Alert>

        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {newsArticles.map((article) => (
            <li key={article.id}>
              <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6 transition-colors hover:border-navy/25">
                <div className="flex items-center gap-3">
                  {article.category && <Badge variant="neutral">{article.category.name}</Badge>}
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {formatDate(article.publishedAt ?? article.updatedAt)}
                  </span>
                </div>
                <h2 className="text-base font-bold leading-snug text-navy">{article.title}</h2>
                <p className="text-sm leading-relaxed text-foreground/70">{article.excerpt}</p>
                <Link
                  href={`/tin-tuc/${article.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text rounded-sm"
                >
                  Đọc bài viết
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
