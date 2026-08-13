import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Building2, Info } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getInvoice } from "@/modules/invoices/service";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/modules/invoices/state-machine";
import { InvoiceSummary } from "@/components/shared/invoice-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Chi tiết hóa đơn",
  robots: { index: false, follow: false },
};

export default async function MyInvoiceDetailPage({
  params,
}: PageProps<"/tai-khoan/hoa-don/[invoiceNumber]">) {
  const { invoiceNumber } = await params;
  const actor = await getActor();

  let invoice;
  try {
    invoice = await getInvoice(actor, invoiceNumber);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const status = invoice.status as InvoiceStatus;

  // Khoản đang chờ đối chiếu vẫn hiện cho khách: họ đã chuyển tiền và cần thấy hệ thống
  // đã ghi nhận, dù công nợ chưa giảm.
  const visiblePayments = invoice.payments.filter((payment) => payment.status !== "REVERSED");

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/tai-khoan/hoa-don">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hóa đơn của tôi
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{invoice.invoiceNumber}</h1>
        <Badge variant={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
      </header>

      {status === "OVERDUE" && (
        <Alert variant="warning">
          <Info aria-hidden />
          <div>
            <p className="font-semibold">Hóa đơn đã quá hạn thanh toán</p>
            <p className="mt-1">
              Nếu bạn đã chuyển khoản, vui lòng liên hệ để chúng tôi đối chiếu sớm.
            </p>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Nội dung</h2>
              <div className="mt-4">
                <InvoiceSummary lines={invoice.lines} totals={invoice} />
              </div>

              {invoice.note && (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="whitespace-pre-line text-sm text-foreground/75">{invoice.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {visiblePayments.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Lịch sử thanh toán</h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {visiblePayments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                    >
                      <span className="font-bold tabular-nums text-navy">
                        {formatMoney(payment.amount.toString())}
                      </span>
                      <Badge variant={PAYMENT_STATUS_TONE[payment.status as PaymentStatus]}>
                        {PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}
                      </Badge>
                      <Badge variant="neutral">
                        {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
                      </Badge>
                      <time
                        dateTime={payment.paidAt.toISOString()}
                        className="ml-auto text-xs text-muted"
                      >
                        {formatDateTime(payment.paidAt)}
                      </time>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-xs text-muted">
                  Khoản đang chờ đối chiếu đã được ghi nhận nhưng chưa trừ vào công nợ cho tới
                  khi kế toán xác nhận tiền về tài khoản.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Building2 className="h-4 w-4" aria-hidden />
                Thông tin xuất hóa đơn
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Tên đơn vị</dt>
                  <dd className="font-medium text-navy">{invoice.billingName}</dd>
                </div>
                {invoice.billingTaxCode && (
                  <div>
                    <dt className="text-xs text-muted">Mã số thuế</dt>
                    <dd className="font-mono font-medium text-navy">{invoice.billingTaxCode}</dd>
                  </div>
                )}
                {invoice.billingAddress && (
                  <div>
                    <dt className="text-xs text-muted">Địa chỉ</dt>
                    <dd className="text-foreground/80">{invoice.billingAddress}</dd>
                  </div>
                )}
                {invoice.dueAt && (
                  <div>
                    <dt className="text-xs text-muted">Hạn thanh toán</dt>
                    <dd className="font-medium text-navy">{formatDate(invoice.dueAt)}</dd>
                  </div>
                )}
              </dl>

              {invoice.shipment && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Package className="h-3.5 w-3.5" aria-hidden />
                    Đơn hàng liên quan
                  </p>
                  <Link
                    href={`/tai-khoan/don-hang/${invoice.shipment.trackingCode}`}
                    className="mt-1 block font-mono text-sm font-semibold text-orange-text hover:underline"
                  >
                    {invoice.shipment.trackingCode}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Cần hỗ trợ?</h2>
              <p className="mt-2 text-sm text-foreground/70">
                Nếu có thắc mắc về hóa đơn này, hãy gửi yêu cầu hỗ trợ để chúng tôi kiểm tra.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/tai-khoan/ho-tro">Gửi yêu cầu hỗ trợ</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <p className="text-xs text-muted">
        Đây là chứng từ nội bộ phục vụ đối chiếu công nợ, không phải hóa đơn điện tử hợp pháp.
      </p>
    </div>
  );
}
