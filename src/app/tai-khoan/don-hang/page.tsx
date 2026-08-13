import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyShipments } from "@/modules/tracking/service";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi",
  robots: { index: false, follow: false },
};

function route(stops: { kind: string; district: string | null; province: string }[]): string {
  const pickup = stops.find((s) => s.kind === "PICKUP");
  const dropoff = stops.find((s) => s.kind === "DELIVERY");
  if (!pickup || !dropoff) return "—";

  const label = (stop: { district: string | null; province: string }) =>
    stop.district ? `${stop.district}, ${stop.province}` : stop.province;

  return `${label(pickup)} → ${label(dropoff)}`;
}

export default async function MyShipmentsPage() {
  const actor = await getActor();
  const shipments = await listMyShipments(actor);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Đơn hàng của tôi</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {shipments.length > 0 ? `${shipments.length} đơn hàng` : "Chưa có đơn hàng nào"}
        </p>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn hàng xuất hiện tại đây sau khi bạn chấp nhận báo giá và chúng tôi sắp xếp phương tiện."
          action={
            <Button asChild>
              <Link href="/bao-gia">Gửi yêu cầu báo giá</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {shipments.map((shipment) => {
            const status = shipment.status as ShipmentStatus;
            const isDone = status === "COMPLETED";

            return (
              <li key={shipment.id}>
                <article className="rounded-lg border border-border bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-bold text-navy">
                        {shipment.trackingCode}
                      </p>
                      <p className="mt-1 text-sm text-foreground/70">{route(shipment.stops)}</p>
                    </div>
                    <Badge variant={SHIPMENT_STATUS_TONE[status]}>
                      {SHIPMENT_STATUS_LABELS[status]}
                    </Badge>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted">Phương tiện</dt>
                      <dd className="mt-0.5 font-medium text-navy">
                        {shipment.vehicleType?.name ?? "Chưa xác định"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">
                        {isDone ? "Đã giao lúc" : "Dự kiến giao"}
                      </dt>
                      <dd className="mt-0.5 font-medium text-navy">
                        {isDone && shipment.deliveredAt
                          ? formatDateTime(shipment.deliveredAt)
                          : shipment.estimatedDeliveryAt
                            ? formatDateTime(shipment.estimatedDeliveryAt)
                            : "Chưa xác định"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Giá trị đơn</dt>
                      <dd className="mt-0.5 font-medium text-navy">
                        {shipment.totalAmount
                          ? formatMoney(shipment.totalAmount.toString())
                          : "Chưa chốt"}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/tai-khoan/don-hang/${shipment.trackingCode}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    <Package className="h-4 w-4" aria-hidden />
                    Xem chi tiết hành trình
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
