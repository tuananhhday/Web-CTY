import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Package } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import { getInvoiceDraftFromShipment } from "@/modules/invoices/service";
import { InvoiceBuilder, type InvoiceDraft } from "@/components/admin/invoice-builder";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Lập hóa đơn" };

const EMPTY_DRAFT: InvoiceDraft = {
  billingName: "",
  billingEmail: "",
  discountAmount: "0",
  lines: [],
};

export default async function NewInvoicePage({ searchParams }: PageProps<"/quan-tri/hoa-don/moi">) {
  const actor = await getActor();
  requirePermission(actor, "invoice.manage");

  const params = await searchParams;
  const trackingCode = typeof params.chuyen === "string" ? params.chuyen : undefined;

  let draft: InvoiceDraft = EMPTY_DRAFT;
  let prefill: Awaited<ReturnType<typeof getInvoiceDraftFromShipment>> | null = null;

  if (trackingCode) {
    // Mã chuyến sai thì hiện form trống kèm cảnh báo, không văng 404 — kế toán vẫn lập tay được.
    try {
      prefill = await getInvoiceDraftFromShipment(actor, trackingCode);
      draft = {
        trackingCode: prefill.trackingCode,
        billingName: prefill.billingName,
        billingEmail: prefill.billingEmail,
        discountAmount: prefill.discountAmount,
        lines: prefill.lines,
      };
    } catch {
      prefill = null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/hoa-don">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách hóa đơn
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-navy">Lập hóa đơn</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Chứng từ nội bộ để đối chiếu công nợ, không phải hóa đơn điện tử hợp pháp.
        </p>
      </div>

      {trackingCode && !prefill && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <p>
            Không tìm thấy chuyến <strong>{trackingCode}</strong>. Bạn vẫn lập được hóa đơn thủ
            công bên dưới, nhưng hóa đơn sẽ không gắn với chuyến nào.
          </p>
        </Alert>
      )}

      {prefill && prefill.existingInvoices.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <div>
            <p className="font-semibold">Chuyến này đã có hóa đơn</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {prefill.existingInvoices.map((invoice) => (
                <li key={invoice.invoiceNumber}>
                  <Link
                    href={`/quan-tri/hoa-don/${invoice.invoiceNumber}`}
                    className="font-mono font-semibold underline"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1">Kiểm tra lại trước khi lập thêm để tránh xuất trùng.</p>
          </div>
        </Alert>
      )}

      {prefill && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Package className="h-4 w-4 text-muted" aria-hidden />
            <span className="text-sm text-foreground/75">Lập cho chuyến</span>
            <Link
              href={`/quan-tri/dieu-phoi/${prefill.trackingCode}`}
              className="font-mono text-sm font-semibold text-orange-text hover:underline"
            >
              {prefill.trackingCode}
            </Link>
            {prefill.quoteCode && (
              <span className="text-xs text-muted">
                · dòng chi phí lấy từ báo giá {prefill.quoteCode} khách đã chấp nhận
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <InvoiceBuilder draft={draft} />
    </div>
  );
}
