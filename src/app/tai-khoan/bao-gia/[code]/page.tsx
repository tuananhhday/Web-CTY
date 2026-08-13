import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Clock, Lock, History } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getMyQuote, markViewed } from "@/modules/quotes/service";
import { QUOTE_STATUS_HINTS, type QuoteStatus } from "@/modules/quotes/state-machine";
import { daysUntilExpiry, isQuoteExpired } from "@/modules/quotes/pricing";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { QuoteSummaryTable } from "@/components/shared/quote-summary-table";
import { QuoteResponse } from "@/components/dashboard/quote-response";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Chi tiết báo giá",
  robots: { index: false, follow: false },
};

export default async function CustomerQuoteDetailPage({
  params,
}: PageProps<"/tai-khoan/bao-gia/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let quote;
  try {
    quote = await getMyQuote(actor, code);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  // Ghi nhận lượt xem đầu tiên. Không chặn render nếu ghi thất bại.
  await markViewed(quote.id, quote.status as QuoteStatus);

  const current =
    quote.revisions.find((r) => r.id === quote.currentRevisionId) ?? quote.revisions[0];
  const accepted = quote.revisions.find((r) => r.id === quote.acceptedRevisionId);

  // Bản khách nhìn thấy: nếu đã chấp nhận thì hiển thị đúng bản đã chốt, không phải bản
  // mới nhất — đó mới là thứ hai bên đã thống nhất (§13.3).
  const displayed = accepted ?? current;

  const expired = isQuoteExpired(quote.expiresAt);
  const remaining = daysUntilExpiry(quote.expiresAt);

  const canRespond =
    !expired && ["SENT", "VIEWED", "NEGOTIATING"].includes(quote.status) && Boolean(current);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/tai-khoan/bao-gia">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tất cả báo giá
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{quote.code}</h1>
        <QuoteStatusBadge status={quote.status} />
        {displayed && <Badge variant="neutral">Phiên bản {displayed.revisionNumber}</Badge>}
      </header>

      <Alert variant={quote.status === "ACCEPTED" ? "success" : "info"}>
        <Info aria-hidden />
        <p>{QUOTE_STATUS_HINTS[quote.status as QuoteStatus]}</p>
      </Alert>

      {expired && quote.status !== "ACCEPTED" && (
        <Alert variant="warning">
          <Clock aria-hidden />
          <p>
            Báo giá đã quá hạn hiệu lực ngày {quote.expiresAt && formatDate(quote.expiresAt)}.
            Liên hệ với chúng tôi nếu bạn vẫn muốn tiếp tục — chúng tôi sẽ lập báo giá mới.
          </p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          {displayed ? (
            <QuoteSummaryTable revision={displayed} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-foreground/65">
                Báo giá chưa có nội dung.
              </CardContent>
            </Card>
          )}

          {/* Chỉ báo cho khách biết có bản mới hơn bản họ đã chốt — minh bạch về lịch sử. */}
          {accepted && current && accepted.id !== current.id && (
            <Alert variant="info">
              <History aria-hidden />
              <p>
                Bạn đang xem phiên bản {accepted.revisionNumber} — bản bạn đã chấp nhận và đã
                được khoá. Đây là bản có hiệu lực giữa hai bên.
              </p>
            </Alert>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {canRespond && current ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-bold text-navy">Phản hồi báo giá</h2>
                <QuoteResponse
                  code={quote.code}
                  revisionNumber={current.revisionNumber}
                  totalLabel={formatMoney(String(current.totalAmount))}
                />
              </CardContent>
            </Card>
          ) : quote.status === "ACCEPTED" ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success-bg text-success">
                    <Lock className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-navy">Đã chấp nhận</p>
                    <p className="mt-1 text-sm text-foreground/70">
                      {quote.acceptedAt && formatDateTime(quote.acceptedAt)}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" className="mt-5 w-full">
                  <Link href="/tai-khoan/don-hang">Xem đơn hàng</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Thông tin</h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Yêu cầu liên quan</dt>
                  <dd>
                    <Link
                      href={`/tai-khoan/yeu-cau/${quote.serviceRequest.code}`}
                      className="font-mono font-medium text-orange-text hover:underline"
                    >
                      {quote.serviceRequest.code}
                    </Link>
                  </dd>
                </div>
                {quote.sentAt && (
                  <div>
                    <dt className="text-xs text-muted">Gửi lúc</dt>
                    <dd className="text-foreground/80">{formatDateTime(quote.sentAt)}</dd>
                  </div>
                )}
                {quote.expiresAt && !expired && (
                  <div>
                    <dt className="text-xs text-muted">Hiệu lực đến</dt>
                    <dd className="text-foreground/80">
                      {formatDate(quote.expiresAt)}
                      {remaining !== null && remaining >= 0 && (
                        <span className="ml-1.5 text-warning">
                          (còn {remaining} ngày)
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {quote.declineReason && (
                  <div>
                    <dt className="text-xs text-muted">Lý do bạn từ chối</dt>
                    <dd className="text-foreground/80">{quote.declineReason}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
