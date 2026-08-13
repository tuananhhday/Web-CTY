import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ReceiptText, AlertTriangle, Plus } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { listInvoicesForStaff } from "@/modules/invoices/service";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  type InvoiceStatus,
} from "@/modules/invoices/state-machine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Hóa đơn" };

export default async function InvoicesPage() {
  const actor = await getActor();
  const invoices = await listInvoicesForStaff(actor);
  const canManage = can(actor, "invoice.manage");

  const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE");
  const outstanding = invoices.filter((invoice) =>
    ["ISSUED", "PARTIALLY_PAID"].includes(invoice.status)
  );
  const others = invoices.filter(
    (invoice) => !overdue.includes(invoice) && !outstanding.includes(invoice)
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Hóa đơn</h1>
          <p className="mt-1 text-sm text-foreground/70">
            {invoices.length} chứng từ · {overdue.length} quá hạn
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/quan-tri/hoa-don/moi">
              <Plus className="h-4 w-4" aria-hidden />
              Lập hóa đơn
            </Link>
          </Button>
        )}
      </div>

      <Alert variant="info">
        <ReceiptText aria-hidden />
        <div>
          <p className="font-semibold">Đây là chứng từ nội bộ, không phải hóa đơn điện tử</p>
          <p className="mt-1">
            Số chứng từ do hệ thống sinh để đối chiếu công nợ. Khi doanh nghiệp phát hành hóa
            đơn điện tử hợp pháp, phải dùng số do nhà cung cấp cấp.
          </p>
        </div>
      </Alert>

      {invoices.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có hóa đơn nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Hóa đơn được lập từ chuyến hàng đã hoàn tất.
            </p>
          </CardContent>
        </Card>
      )}

      {[
        { key: "overdue", title: "Quá hạn thanh toán", items: overdue, urgent: true },
        { key: "outstanding", title: "Đang chờ thanh toán", items: outstanding, urgent: false },
        { key: "others", title: "Khác", items: others, urgent: false },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-labelledby={`nhom-${group.key}`}>
            <h2
              id={`nhom-${group.key}`}
              className={`mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${
                group.urgent ? "text-error" : "text-muted"
              }`}
            >
              {group.urgent && <AlertTriangle className="h-4 w-4" aria-hidden />}
              {group.title} ({group.items.length})
            </h2>

            <ul className="flex flex-col gap-2">
              {group.items.map((invoice) => {
                const status = invoice.status as InvoiceStatus;

                return (
                  <li key={invoice.id}>
                    <Link
                      href={`/quan-tri/hoa-don/${invoice.invoiceNumber}`}
                      className={`flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
                        group.urgent ? "border-error/25" : "border-border"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-navy">
                            {invoice.invoiceNumber}
                          </span>
                          <Badge variant={INVOICE_STATUS_TONE[status]}>
                            {INVOICE_STATUS_LABELS[status]}
                          </Badge>
                        </div>

                        <p className="mt-1.5 font-medium text-navy">{invoice.billingName}</p>

                        <p className="mt-1 text-xs text-muted">
                          {invoice.shipment && `Đơn ${invoice.shipment.trackingCode} · `}
                          {invoice.issuedAt
                            ? `Phát hành ${formatDate(invoice.issuedAt)}`
                            : "Chưa phát hành"}
                          {invoice.dueAt && ` · hạn ${formatDate(invoice.dueAt)}`}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-bold tabular-nums text-navy">
                          {formatMoney(invoice.totalAmount.toString())}
                        </p>
                        {Number(invoice.balanceAmount.toString()) > 0 && (
                          <p className="mt-0.5 text-xs tabular-nums text-error">
                            còn {formatMoney(invoice.balanceAmount.toString())}
                          </p>
                        )}
                      </div>

                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
