import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyInvoices } from "@/modules/invoices/service";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  type InvoiceStatus,
} from "@/modules/invoices/state-machine";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Hóa đơn",
  robots: { index: false, follow: false },
};

export default async function MyInvoicesPage() {
  const actor = await getActor();
  const invoices = await listMyInvoices(actor);

  const outstanding = invoices.filter((invoice) =>
    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Hóa đơn</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {outstanding.length > 0
            ? `${outstanding.length} hóa đơn chờ thanh toán`
            : `${invoices.length} hóa đơn`}
        </p>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="Chưa có hóa đơn"
          description="Hóa đơn xuất hiện tại đây sau khi chuyến hàng hoàn tất và bộ phận kế toán phát hành chứng từ."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {invoices.map((invoice) => {
            const status = invoice.status as InvoiceStatus;
            const balance = Number(invoice.balanceAmount.toString());

            return (
              <li key={invoice.id}>
                <Link
                  href={`/tai-khoan/hoa-don/${invoice.invoiceNumber}`}
                  className="flex items-start gap-4 rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                    <ReceiptText className="h-4 w-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy">
                        {invoice.invoiceNumber}
                      </span>
                      <Badge variant={INVOICE_STATUS_TONE[status]}>
                        {INVOICE_STATUS_LABELS[status]}
                      </Badge>
                    </div>

                    <p className="mt-1.5 text-sm text-foreground/70">
                      {invoice.shipment && `Đơn ${invoice.shipment.trackingCode} · `}
                      {invoice.issuedAt && `Phát hành ${formatDate(invoice.issuedAt)}`}
                      {invoice.dueAt && ` · hạn ${formatDate(invoice.dueAt)}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums text-navy">
                      {formatMoney(invoice.totalAmount.toString())}
                    </p>
                    {balance > 0 && (
                      <p className="mt-0.5 text-xs tabular-nums text-error">
                        còn {formatMoney(String(balance))}
                      </p>
                    )}
                  </div>

                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
