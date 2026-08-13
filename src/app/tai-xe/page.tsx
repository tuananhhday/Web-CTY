import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin, Clock, PackageCheck } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyDriverShipments } from "@/modules/shipments/service";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  isTerminal,
  nextDriverStep,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, isSameDay } from "@/lib/datetime";

export const metadata: Metadata = { title: "Chuyến của tôi" };

function route(stops: { kind: string; province: string; district: string | null }[]): string {
  const pickup = stops.find((s) => s.kind === "PICKUP");
  const dropoff = stops.find((s) => s.kind === "DELIVERY");
  if (!pickup || !dropoff) return "—";

  const label = (stop: { district: string | null; province: string }) =>
    stop.district ?? stop.province;

  return `${label(pickup)} → ${label(dropoff)}`;
}

export default async function DriverHomePage() {
  const actor = await getActor();
  const shipments = await listMyDriverShipments(actor);

  const now = new Date();
  const active = shipments.filter((s) => !isTerminal(s.status as ShipmentStatus));
  const today = active.filter(
    (s) => s.scheduledPickupAt && isSameDay(s.scheduledPickupAt, now)
  );
  const upcoming = active.filter((s) => !today.includes(s));
  const done = shipments.filter((s) => isTerminal(s.status as ShipmentStatus));

  if (shipments.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <PackageCheck className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
          <p className="mt-4 font-medium text-navy">Chưa có chuyến nào</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-foreground/65">
            Chuyến được phân công sẽ hiện ở đây. Liên hệ điều phối nếu bạn nghĩ có nhầm lẫn.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {[
        { key: "today", title: "Hôm nay", items: today },
        { key: "upcoming", title: "Sắp tới", items: upcoming },
        { key: "done", title: "Đã xong", items: done },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-labelledby={`nhom-${group.key}`}>
            <h2
              id={`nhom-${group.key}`}
              className="mb-3 text-sm font-bold uppercase tracking-wide text-muted"
            >
              {group.title} ({group.items.length})
            </h2>

            <ul className="flex flex-col gap-3">
              {group.items.map((shipment) => {
                const status = shipment.status as ShipmentStatus;
                const next = nextDriverStep(status);

                return (
                  <li key={shipment.id}>
                    <Link
                      href={`/tai-xe/chuyen/${shipment.trackingCode}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-navy">
                            {shipment.trackingCode}
                          </span>
                          <Badge variant={SHIPMENT_STATUS_TONE[status]}>
                            {SHIPMENT_STATUS_LABELS[status]}
                          </Badge>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-foreground/80">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          {route(shipment.stops)}
                        </p>

                        {shipment.scheduledPickupAt && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Lấy hàng {formatDateTime(shipment.scheduledPickupAt)}
                          </p>
                        )}

                        {next && (
                          <p className="mt-2 text-xs font-semibold text-orange-text">
                            Bước tiếp theo: {SHIPMENT_STATUS_LABELS[next]}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
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
