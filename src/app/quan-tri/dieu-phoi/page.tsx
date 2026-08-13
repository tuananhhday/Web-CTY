import type { Metadata } from "next";
import Link from "next/link";
import { Truck, ArrowRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import {
  listQuotesReadyForShipment,
  listShipmentsAwaitingDispatch,
  listActiveShipments,
  listAttentionShipments,
} from "@/modules/shipments/repository";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE } from "@/modules/shipments/state-machine";
import { CreateShipmentButton } from "@/components/admin/create-shipment-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Điều phối" };

function route(stops: { kind: string; province: string; district: string | null }[]): string {
  const pickup = stops.find((s) => s.kind === "PICKUP");
  const dropoff = stops.find((s) => s.kind === "DELIVERY");
  if (!pickup || !dropoff) return "—";
  return `${pickup.province} → ${dropoff.province}`;
}

export default async function DispatchPage() {
  const actor = await getActor();
  requirePermission(actor, "shipment.dispatch");

  const [readyQuotes, awaiting, active, attention] = await Promise.all([
    listQuotesReadyForShipment(),
    listShipmentsAwaitingDispatch(),
    listActiveShipments(),
    listAttentionShipments(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-navy">Điều phối</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Tạo đơn hàng từ báo giá đã chốt, phân công xe và tài xế.
        </p>
      </div>

      {/* Chuyến cần chú ý đặt lên đầu — đây là thứ dispatcher cần xử lý ngay (§26.3). */}
      {attention.length > 0 && (
        <section aria-labelledby="can-chu-y">
          <h2 id="can-chu-y" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-error">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Cần xử lý ngay ({attention.length})
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {attention.map((shipment) => (
              <li key={shipment.id}>
                <Link
                  href={`/quan-tri/dieu-phoi/${shipment.trackingCode}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-error/25 bg-error-bg p-4 transition-colors hover:border-error/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <span className="font-mono text-sm font-bold text-navy">
                    {shipment.trackingCode}
                  </span>
                  <Badge variant={SHIPMENT_STATUS_TONE[shipment.status]}>
                    {SHIPMENT_STATUS_LABELS[shipment.status]}
                  </Badge>
                  <span className="text-sm text-foreground/75">{route(shipment.stops)}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Báo giá đã chốt, chờ tạo đơn */}
      <section aria-labelledby="cho-tao-don">
        <h2 id="cho-tao-don" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Báo giá đã chốt, chờ tạo đơn ({readyQuotes.length})
        </h2>

        {readyQuotes.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center text-sm text-foreground/65">
              Không có báo giá nào đang chờ. Đơn hàng được tạo từ báo giá khách đã chấp nhận.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {readyQuotes.map((quote) => (
              <li
                key={quote.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-navy">{quote.code}</span>
                    <Badge variant="success">Đã chấp nhận</Badge>
                    <Badge variant="neutral">
                      {quote.serviceRequest.kind === "MOVING" ? "Chuyển nhà" : "Vận chuyển"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground/75">
                    {quote.serviceRequest.contactName} · {route(quote.serviceRequest.stops)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Chốt lúc {quote.acceptedAt && formatDateTime(quote.acceptedAt)}
                    {quote.acceptedRevision &&
                      ` · ${formatMoney(String(quote.acceptedRevision.totalAmount))}`}
                  </p>
                </div>

                <CreateShipmentButton quoteCode={quote.code} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Đơn chờ phân công */}
      <section aria-labelledby="cho-phan-cong">
        <h2 id="cho-phan-cong" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Clock className="h-4 w-4" aria-hidden />
          Chờ phân công xe và tài xế ({awaiting.length})
        </h2>

        {awaiting.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center text-sm text-foreground/65">
              Mọi đơn hàng đều đã được phân công.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {awaiting.map((shipment) => (
              <li key={shipment.id}>
                <Link
                  href={`/quan-tri/dieu-phoi/${shipment.trackingCode}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <span className="font-mono text-sm font-bold text-navy">
                    {shipment.trackingCode}
                  </span>
                  <Badge variant={SHIPMENT_STATUS_TONE[shipment.status]}>
                    {SHIPMENT_STATUS_LABELS[shipment.status]}
                  </Badge>
                  <span className="text-sm text-foreground/75">{route(shipment.stops)}</span>
                  {shipment.scheduledPickupAt && (
                    <span className="text-xs text-muted">
                      Lấy hàng {formatDateTime(shipment.scheduledPickupAt)}
                    </span>
                  )}
                  <ArrowRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chuyến đang chạy */}
      <section aria-labelledby="dang-chay">
        <h2 id="dang-chay" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Truck className="h-4 w-4" aria-hidden />
          Đang vận chuyển ({active.length})
        </h2>

        {active.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center text-sm text-foreground/65">
              Chưa có chuyến nào đang chạy.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {active.map((shipment) => {
              const assignment = shipment.assignments[0];
              return (
                <li key={shipment.id}>
                  <Link
                    href={`/quan-tri/dieu-phoi/${shipment.trackingCode}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    <span className="font-mono text-sm font-bold text-navy">
                      {shipment.trackingCode}
                    </span>
                    <Badge variant={SHIPMENT_STATUS_TONE[shipment.status]}>
                      {SHIPMENT_STATUS_LABELS[shipment.status]}
                    </Badge>
                    <span className="text-sm text-foreground/75">{route(shipment.stops)}</span>
                    {assignment && (
                      <span className="text-xs text-muted">
                        {assignment.vehicle?.plateNumber ?? "chưa gán xe"} ·{" "}
                        {assignment.primaryDriver?.fullName ?? "chưa gán tài xế"}
                      </span>
                    )}
                    <ArrowRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/quan-tri/xe">Quản lý đội xe</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/quan-tri/tai-xe">Quản lý tài xế</Link>
        </Button>
      </div>
    </div>
  );
}
