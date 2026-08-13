import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStaticPage } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { RichText } from "@/components/shared/rich-text";
import { formatDate } from "@/lib/datetime";

/**
 * Trang chính sách. Nội dung lấy từ CMS nên nhân viên sửa được mà không cần deploy (§10).
 *
 * Bốn slug hợp lệ: bao-mat, dieu-khoan, van-chuyen, cookie. Slug khác trả 404.
 */

const POLICY_SLUGS = ["bao-mat", "dieu-khoan", "van-chuyen", "cookie"] as const;

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/chinh-sach/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStaticPage(slug);

  if (!page) return { title: "Không tìm thấy trang" };

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/chinh-sach/${slug}` },
    openGraph: {
      title: page.seoTitle ?? page.title,
      description: page.seoDescription ?? undefined,
      type: "article",
    },
  };
}

export default async function PolicyPage({ params }: PageProps<"/chinh-sach/[slug]">) {
  const { slug } = await params;

  if (!POLICY_SLUGS.includes(slug as (typeof POLICY_SLUGS)[number])) {
    notFound();
  }

  const page = await getStaticPage(slug);
  if (!page) notFound();

  return (
    <Container className="pb-16">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Chính sách" },
          { label: page.title },
        ]}
      />

      <article className="mx-auto max-w-3xl">
        <header className="border-b border-border pb-6">
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">{page.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Cập nhật lần cuối: {formatDate(page.updatedAt)}
          </p>
        </header>

        <RichText html={page.content} className="mt-8" />
      </article>
    </Container>
  );
}
