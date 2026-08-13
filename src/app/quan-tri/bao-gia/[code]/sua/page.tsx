import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { getQuoteAsStaff } from "@/modules/quotes/service";
import { loadApprovalThresholds } from "@/modules/quotes/thresholds";
import { QuoteBuilder } from "@/components/admin/quote-builder";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { isAppError } from "@/lib/errors";
import type { QuoteLineItemInput } from "@/modules/quotes/schema";

export const metadata: Metadata = { title: "Tạo phiên bản báo giá" };

export default async function ReviseQuotePage({
  params,
}: PageProps<"/quan-tri/bao-gia/[code]/sua">) {
  const { code } = await params;
  const actor = await getActor();

  if (!can(actor, "quote.create")) notFound();

  let quote;
  try {
    quote = await getQuoteAsStaff(actor, code);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  // Báo giá đã chấp nhận thì đóng băng — không cho vào trang sửa (§13.3).
  if (quote.acceptedRevisionId) notFound();

  const thresholds = await loadApprovalThresholds();
  const current = quote.revisions.find((r) => r.id === quote.currentRevisionId);

  // Điền sẵn nội dung bản hiện tại để nhân viên chỉnh thay vì gõ lại từ đầu.
  const defaultValues = current
    ? {
        lineItems: current.lineItems.map(
          (item): QuoteLineItemInput => ({
            description: item.description,
            category: item.category as QuoteLineItemInput["category"],
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: item.unitPrice.toString(),
            discountAmount: item.discountAmount.toString(),
            taxPercent: Number(item.taxPercent),
            note: item.note ?? undefined,
          })
        ),
        discountAmount: current.discountAmount.toString(),
        terms: current.terms ?? "",
        note: current.note ?? "",
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href={`/quan-tri/bao-gia/${quote.code}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Về báo giá {quote.code}
        </Link>
      </Button>

      <h1 className="text-xl font-bold text-navy">Tạo phiên bản mới cho {quote.code}</h1>

      <Alert variant="info">
        <Info aria-hidden />
        <p>
          Phiên bản {current?.revisionNumber ?? 0} được giữ nguyên trong lịch sử. Nội dung
          bên dưới sẽ lưu thành phiên bản {(current?.revisionNumber ?? 0) + 1}.
        </p>
      </Alert>

      <QuoteBuilder
        mode="revise"
        quoteCode={quote.code}
        thresholds={thresholds}
        defaultValues={defaultValues}
      />
    </div>
  );
}
