import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { getRequestAsStaff } from "@/modules/service-requests/service";
import { loadApprovalThresholds } from "@/modules/quotes/thresholds";
import { QuoteBuilder } from "@/components/admin/quote-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAppError } from "@/lib/errors";
import { formatWeight } from "@/lib/format";

export const metadata: Metadata = { title: "Lập báo giá" };

export default async function NewQuotePage({ searchParams }: PageProps<"/quan-tri/bao-gia/moi">) {
  const params = await searchParams;
  const requestCode = typeof params.yeucau === "string" ? params.yeucau : null;

  if (!requestCode) redirect("/quan-tri/yeu-cau");

  const actor = await getActor();
  if (!can(actor, "quote.create")) notFound();

  let request;
  try {
    request = await getRequestAsStaff(actor, requestCode);
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  const thresholds = await loadApprovalThresholds();

  const pickup = request.stops.find((s) => s.kind === "PICKUP");
  const dropoff = request.stops.find((s) => s.kind === "DELIVERY");

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href={`/quan-tri/yeu-cau/${request.code}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Về yêu cầu {request.code}
        </Link>
      </Button>

      <h1 className="text-xl font-bold text-navy">Lập báo giá cho {request.code}</h1>

      {/* Tóm tắt yêu cầu để nhân viên không phải mở tab khác đối chiếu. */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Tóm tắt yêu cầu</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Khách hàng</dt>
              <dd className="font-medium text-navy">{request.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tuyến</dt>
              <dd className="font-medium text-navy">
                {pickup && dropoff ? `${pickup.province} → ${dropoff.province}` : "—"}
              </dd>
            </div>
            {request.cargoItems.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Hàng hóa</dt>
                <dd className="text-foreground/80">
                  {request.cargoItems
                    .map(
                      (item) =>
                        `${item.cargoType} (${item.quantity} kiện, ${formatWeight(Number(item.weightKg))})`
                    )
                    .join(" · ")}
                </dd>
              </div>
            )}
            {(request.needsLoading || request.needsPacking) && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Dịch vụ kèm theo</dt>
                <dd className="text-foreground/80">
                  {[
                    request.needsLoading && "bốc xếp",
                    request.needsPacking && "đóng gói",
                    request.needsAssembly && "tháo lắp",
                    request.needsHoisting && "nâng hạ",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <QuoteBuilder mode="create" serviceRequestCode={request.code} thresholds={thresholds} />
    </div>
  );
}
