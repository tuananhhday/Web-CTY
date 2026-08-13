import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, ArrowRight, Clock } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyQuotes } from "@/modules/quotes/service";
import { listQuotesQuerySchema } from "@/modules/quotes/schema";
import { daysUntilExpiry } from "@/modules/quotes/pricing";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Báo giá",
  robots: { index: false, follow: false },
};

export default async function MyQuotesPage({ searchParams }: PageProps<"/tai-khoan/bao-gia">) {
  const params = await searchParams;
  const parsed = listQuotesQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listQuotesQuerySchema.parse({});

  const actor = await getActor();
  const { items, total } = await listMyQuotes(actor, query);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Báo giá</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {total > 0 ? `${total} báo giá` : "Chưa có báo giá nào"}
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có báo giá nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Sau khi bạn gửi yêu cầu và đội ngũ vận hành xác nhận thông tin hàng hóa, báo giá
              sẽ xuất hiện tại đây.
            </p>
            <Button asChild className="mt-6">
              <Link href="/bao-gia">Gửi yêu cầu báo giá</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((quote) => {
            const remaining = daysUntilExpiry(quote.expiresAt);
            const needsAttention = quote.status === "SENT" || quote.status === "VIEWED";

            return (
              <li key={quote.id}>
                <Link
                  href={`/tai-khoan/bao-gia/${quote.code}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-navy">{quote.code}</span>
                    <QuoteStatusBadge status={quote.status} />
                    {quote._count.revisions > 1 && (
                      <Badge variant="neutral">Bản {quote.currentRevision?.revisionNumber}</Badge>
                    )}
                    <span className="ml-auto text-xs text-muted">
                      {formatDateTime(quote.createdAt)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">Yêu cầu {quote.serviceRequest.code}</p>
                      {quote.currentRevision && (
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-navy">
                          {formatMoney(String(quote.currentRevision.totalAmount))}
                        </p>
                      )}
                    </div>

                    {needsAttention && remaining !== null && remaining >= 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-warning">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {remaining === 0 ? "Hết hạn hôm nay" : `Còn ${remaining} ngày`}
                      </span>
                    )}
                  </div>

                  {needsAttention && (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-orange-text">
                      Cần phản hồi
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
