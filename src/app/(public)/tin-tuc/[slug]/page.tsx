import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNews, getNewsBySlug, getRelatedNews } from "@/modules/cms/service";
import { RichText } from "@/components/shared/rich-text";
import { formatDate } from "@/lib/format";
import { clientEnv } from "@/lib/env";

export async function generateStaticParams() {
  const articles = await getNews();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/tin-tuc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) return { title: "Không tìm thấy bài viết" };

  return {
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.excerpt ?? undefined,
    alternates: { canonical: article.canonicalUrl ?? `/tin-tuc/${slug}` },
    openGraph: {
      title: article.seoTitle ?? article.title,
      description: article.seoDescription ?? article.excerpt ?? undefined,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
    },
  };
}

export default async function NewsDetailPage({ params }: PageProps<"/tin-tuc/[slug]">) {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) notFound();

  const related = await getRelatedNews(article.slug, article.categoryId);
  const publishedAt = article.publishedAt ?? article.updatedAt;

  // JSON-LD Article (§28). Chỉ dùng dữ liệu thật của bài, không bịa tác giả hay đánh giá.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    mainEntityOfPage: `${clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/tin-tuc/${article.slug}`,
    ...(article.authorName ? { author: { "@type": "Person", name: article.authorName } } : {}),
  };

  return (
    <>
      <PageHeader
        title={article.title}
        breadcrumbs={[{ label: "Tin tức", href: "/tin-tuc" }, { label: article.title }]}
      />

      <Container className="py-14 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            {article.category && <Badge variant="neutral">{article.category.name}</Badge>}
            <time
              dateTime={publishedAt.toISOString()}
              className="flex items-center gap-1.5 text-xs text-muted"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {formatDate(publishedAt)}
            </time>
          </div>

          {article.excerpt && (
            <p className="mt-6 text-lg font-medium leading-relaxed text-navy">{article.excerpt}</p>
          )}

          <RichText html={article.body} className="mt-6" />

          <Button asChild variant="outline" className="mt-10">
            <Link href="/tin-tuc">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Quay lại danh sách tin tức
            </Link>
          </Button>

          <section aria-labelledby="bai-viet-lien-quan" className="mt-14">
            <h2 id="bai-viet-lien-quan" className="text-lg font-bold text-navy">
              Bài viết liên quan
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/tin-tuc/${item.slug}`}
                    className="flex h-full flex-col gap-2 rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    <span className="text-sm font-bold text-navy">{item.title}</span>
                    <span className="text-sm text-foreground/70">{item.excerpt}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
