import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Building2, Calendar } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission, can } from "@/modules/auth/policy";
import { getInvoice } from "@/modules/invoices/service";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  canAcceptPayment,
  isEditable,
  type InvoiceStatus,
} from "@/modules/invoices/state-machine";
import { InvoiceSummary } from "@/components/shared/invoice-summary";
import { PaymentPanel } from "@/components/admin/payment-panel";
import { InvoiceStatusForm } from "@/components/admin/invoice-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết hóa đơn" };

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/quan-tri/hoa-don/[invoiceNumber]">) {
  const { invoiceNumber } = await params;
  const actor = await getActor();
  requirePermission(actor, "invoice.read_all");

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
  const canManage = can(actor, "invoice.manage");
  const canRecordPayment = can(actor, "payment.record");
  const paymentCheck = canAcceptPayment(status);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/hoa-don">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách hóa đơn
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{invoice.invoiceNumber}</h1>
        <Badge variant={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
      </header>

      <p className="text-xs text-muted">
        {invoice.invoiceNumber} là mã chứng từ nội bộ để đối chiếu công nợ,{" "}
        <strong className="text-foreground/80">không phải hóa đơn điện tử hợp pháp</strong>. Hóa
        đơn thuế phải phát hành qua nhà cung cấp được cấp phép.
      </p>

      {invoice.voidReason && (
        <Alert variant="warning">
          <Building2 aria-hidden />
          <div>
            <p className="font-semibold">Hóa đơn đã hủy</p>
            <p className="mt-1">Lý do: {invoice.voidReason}</p>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Nội dung hóa đơn</h2>
              <div className="mt-4">
                <InvoiceSummary lines={invoice.lines} totals={invoice} />
              </div>

              {invoice.note && (
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-navy">Ghi chú trên hóa đơn</h3>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/75">
                    {invoice.note}
                  </p>
                </div>
              )}

              {"internalNote" in invoice && invoice.internalNote && (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning-bg p-3">
                  <h3 className="text-sm font-semibold text-navy">Ghi chú nội bộ</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground/75">
                    {invoice.internalNote}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {canRecordPayment ? (
                <PaymentPanel
                  invoiceNumber={invoice.invoiceNumber}
                  payments={invoice.payments.map((payment) => ({
                    id: payment.id,
                    amount: payment.amount.toString(),
                    method: payment.method,
                    status: payment.status,
                    referenceCode: payment.referenceCode,
                    paidAt: payment.paidAt,
                    note: payment.note,
                    reverseReason: payment.reverseReason,
                  }))}
                  canAcceptNew={paymentCheck.allowed}
                  blockedReason={paymentCheck.reason}
                />
              ) : (
                <p className="text-sm text-foreground/70">
                  Vai trò của bạn xem được hóa đơn nhưng không ghi nhận thanh toán.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Building2 className="h-4 w-4" aria-hidden />
                Bên mua
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
                {invoice.billingEmail && (
                  <div>
                    <dt className="text-xs text-muted">Email</dt>
                    <dd className="text-foreground/80">{invoice.billingEmail}</dd>
                  </div>
                )}
              </dl>

              <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                Thông tin này là bản chụp tại thời điểm lập hóa đơn, không đổi theo hồ sơ khách
                hàng.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Calendar className="h-4 w-4" aria-hidden />
                Mốc thời gian
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Lập lúc</dt>
                  <dd className="text-right font-medium text-navy">
                    {formatDateTime(invoice.createdAt)}
                  </dd>
                </div>
                {invoice.issuedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Phát hành</dt>
                    <dd className="text-right font-medium text-navy">
                      {formatDate(invoice.issuedAt)}
                    </dd>
                  </div>
                )}
                {invoice.dueAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Hạn thanh toán</dt>
                    <dd className="text-right font-medium text-navy">
                      {formatDate(invoice.dueAt)}
                    </dd>
                  </div>
                )}
              </dl>

              {invoice.shipment && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Package className="h-3.5 w-3.5" aria-hidden />
                    Chuyến liên quan
                  </p>
                  <Link
                    href={`/quan-tri/dieu-phoi/${invoice.shipment.trackingCode}`}
                    className="mt-1 block font-mono text-sm font-semibold text-orange-text hover:underline"
                  >
                    {invoice.shipment.trackingCode}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardContent className="p-6">
                <InvoiceStatusForm
                  invoiceNumber={invoice.invoiceNumber}
                  canIssue={isEditable(status)}
                  canVoid={status !== "PAID" && status !== "VOID"}
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
