import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, ArrowRight } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listAllQuotes } from "@/modules/quotes/service";
import { listQuotesQuerySchema } from "@/modules/quotes/schema";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS } from "@/modules/quotes/state-machine";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Báo giá" };

export default async function AdminQuotesPage({ searchParams }: PageProps<"/quan-tri/bao-gia">) {
  const params = await searchParams;
  const parsed = listQuotesQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listQuotesQuerySchema.parse({});

  const actor = await getActor();
  const { items, total } = await listAllQuotes(actor, query);

  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value !== undefined && value !== "" && typeof value !== "object") {
        next.set(key, String(value));
      }
    }
    return `/quan-tri/bao-gia?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Báo giá</h1>
        <p className="mt-1 text-sm text-foreground/70">{total} báo giá</p>
      </div>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        <Link
          href={buildUrl({ status: undefined, page: 1 })}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
            !query.status ? "border-navy bg-navy text-white" : "border-border bg-white text-foreground/75 hover:border-navy/30"
          }`}
        >
          Tất cả
        </Link>
        {QUOTE_STATUSES.map((status) => (
          <Link
            key={status}
            href={buildUrl({ status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
              query.status === status ? "border-navy bg-navy text-white" : "border-border bg-white text-foreground/75 hover:border-navy/30"
            }`}
          >
            {QUOTE_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có báo giá nào</p>
            <p className="mt-1.5 text-sm text-foreground/65">
              Lập báo giá từ trang chi tiết của một yêu cầu dịch vụ.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/quan-tri/yeu-cau">Mở hộp thư yêu cầu</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Danh sách báo giá</caption>
            <thead>
              <tr className="border-b border-border bg-navy/5">
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Mã</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Khách hàng</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">Tổng tiền</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Tạo lúc</th>
                <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((quote) => (
                <tr key={quote.id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left">
                    <span className="font-mono text-xs font-bold text-navy">{quote.code}</span>
                    {quote._count.revisions > 1 && (
                      <Badge variant="neutral" className="ml-2">
                        {quote._count.revisions} bản
                      </Badge>
                    )}
                  </th>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{quote.serviceRequest.contactName}</p>
                    <p className="font-mono text-xs text-muted">{quote.serviceRequest.code}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-navy">
                    {quote.currentRevision
                      ? formatMoney(String(quote.currentRevision.totalAmount))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(quote.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/quan-tri/bao-gia/${quote.code}`}>
                        Xem
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
          {query.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl({ page: query.page - 1 })}>Trang trước</Link>
            </Button>
          )}
          <span className="text-sm text-muted">Trang {query.page} / {totalPages}</span>
          {query.page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl({ page: query.page + 1 })}>Trang sau</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
