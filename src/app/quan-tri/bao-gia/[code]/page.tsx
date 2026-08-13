import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, Lock, Plus } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { getQuoteAsStaff, canEditQuote } from "@/modules/quotes/service";
import { loadApprovalThresholds } from "@/modules/quotes/thresholds";
import {
  QUOTE_STATUS_HINTS,
  isTerminal,
  type QuoteStatus,
} from "@/modules/quotes/state-machine";
import { requiresApproval } from "@/modules/quotes/pricing";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { QuoteSummaryTable } from "@/components/shared/quote-summary-table";
import { SendQuoteButton } from "@/components/admin/send-quote-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/money";
import { formatDateTime, formatDate } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết báo giá" };

export default async function AdminQuoteDetailPage({
  params,
}: PageProps<"/quan-tri/bao-gia/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let quote;
  try {
    quote = await getQuoteAsStaff(actor, code);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const thresholds = await loadApprovalThresholds();
  const status = quote.status as QuoteStatus;

  const current = quote.revisions.find((r) => r.id === quote.currentRevisionId) ?? quote.revisions[0];
  const accepted = quote.revisions.find((r) => r.id === quote.acceptedRevisionId);

  // Tính lại ngưỡng để nhãn nút phản ánh đúng việc sẽ xảy ra khi bấm.
  const subtotal = money(String(current?.subtotal ?? 0));
  const discount = money(String(current?.discountAmount ?? 0));
  const discountPercent = subtotal.isZero()
    ? 0
    : Number(discount.dividedBy(subtotal).times(100).toFixed(2));

  const approval = current
    ? requiresApproval(
        { totalAmount: money(String(current.totalAmount)), discountPercent },
        thresholds
      )
    : { required: false, reasons: [] };

  const canCreate = can(actor, "quote.create");
  const canApprove = can(actor, "quote.approve");
  const editable = canEditQuote(quote.status);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/bao-gia">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách báo giá
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{quote.code}</h1>
        <QuoteStatusBadge status={quote.status} />
        {current && <Badge variant="neutral">Bản {current.revisionNumber}</Badge>}
        {accepted && (
          <Badge variant="success">
            <Lock className="h-3 w-3" aria-hidden />
            Đã khoá bản {accepted.revisionNumber}
          </Badge>
        )}
      </header>

      <Alert variant="info">
        <History aria-hidden />
        <p>{QUOTE_STATUS_HINTS[status]}</p>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-base font-bold text-navy">
              Nội dung báo giá{current && ` — bản ${current.revisionNumber}`}
            </h2>
            {current ? (
              <QuoteSummaryTable revision={current} />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-foreground/65">
                  Báo giá chưa có nội dung.
                </CardContent>
              </Card>
            )}
          </section>

          {quote.revisions.length > 1 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">
                  Lịch sử phiên bản ({quote.revisions.length})
                </h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Phiên bản cũ được giữ nguyên để hai bên đối chiếu, không bị ghi đè.
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {quote.revisions.map((revision) => (
                    <li
                      key={revision.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-navy">Bản {revision.revisionNumber}</span>
                        {revision.id === quote.currentRevisionId && (
                          <Badge variant="orange">Hiện tại</Badge>
                        )}
                        {revision.lockedAt && (
                          <Badge variant="success">
                            <Lock className="h-3 w-3" aria-hidden />
                            Đã khoá
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDateTime(revision.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-base font-bold text-navy">Thao tác</h2>

              {isTerminal(status) ? (
                <Alert variant="info">
                  <Lock aria-hidden />
                  <p>
                    Báo giá đã kết thúc. Nếu cần phương án khác, lập báo giá mới từ yêu cầu
                    dịch vụ để giữ nguyên lịch sử.
                  </p>
                </Alert>
              ) : (
                <>
                  {(editable || status === "PENDING_APPROVAL") && canCreate && (
                    <SendQuoteButton
                      code={quote.code}
                      needsApproval={approval.required}
                      canApprove={canApprove}
                    />
                  )}

                  {approval.required && approval.reasons.length > 0 && (
                    <div className="rounded-md bg-warning-bg p-3 text-xs text-warning">
                      <p className="font-semibold">Lý do cần duyệt:</p>
                      <ul className="mt-1 list-disc pl-4">
                        {approval.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {canCreate && !quote.acceptedRevisionId && (
                    <Button asChild variant="outline">
                      <Link href={`/quan-tri/bao-gia/${quote.code}/sua`}>
                        <Plus className="h-4 w-4" aria-hidden />
                        Tạo phiên bản mới
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Thông tin</h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Yêu cầu dịch vụ</dt>
                  <dd>
                    <Link
                      href={`/quan-tri/yeu-cau/${quote.serviceRequest.code}`}
                      className="font-mono font-medium text-orange-text hover:underline"
                    >
                      {quote.serviceRequest.code}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Khách hàng</dt>
                  <dd className="font-medium text-navy">{quote.serviceRequest.contactName}</dd>
                </div>
                {quote.preparedBy && (
                  <div>
                    <dt className="text-xs text-muted">Người lập</dt>
                    <dd className="text-foreground/80">{quote.preparedBy.name}</dd>
                  </div>
                )}
                {quote.approvedBy && (
                  <div>
                    <dt className="text-xs text-muted">Người duyệt</dt>
                    <dd className="text-foreground/80">{quote.approvedBy.name}</dd>
                  </div>
                )}
                {quote.expiresAt && (
                  <div>
                    <dt className="text-xs text-muted">Hiệu lực đến</dt>
                    <dd className="text-foreground/80">{formatDate(quote.expiresAt)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Nhật ký</h2>
              <ol className="mt-4 flex flex-col gap-3 text-sm">
                {quote.activities.map((activity) => (
                  <li key={activity.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                    <p className="font-medium text-navy">{activity.action}</p>
                    <time
                      dateTime={activity.occurredAt.toISOString()}
                      className="text-xs text-muted"
                    >
                      {formatDateTime(activity.occurredAt)}
                      {activity.actorRole && ` · ${activity.actorRole}`}
                    </time>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
