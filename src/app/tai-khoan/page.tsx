import type { Metadata } from "next";
import Link from "next/link";
import { Truck, ClockAlert, FileText, ArrowRight, Plus, Search } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requireAuth } from "@/modules/auth/policy";
import { listMyShipments } from "@/modules/tracking/service";
import { listMyQuotes } from "@/modules/quotes/service";
import { listQuotesQuerySchema } from "@/modules/quotes/schema";
import { listMyRequests } from "@/modules/service-requests/service";
import { listRequestsQuerySchema } from "@/modules/service-requests/schema";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  isTerminal,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Tổng quan",
  robots: { index: false, follow: false },
};

/** Yêu cầu còn đang chờ doanh nghiệp xử lý. */
const PENDING_REQUEST_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEED_MORE_INFO"];

/** Báo giá đang chờ khách phản hồi. */
const AWAITING_CUSTOMER_QUOTE_STATUSES = ["SENT", "VIEWED", "NEGOTIATING"];

export default async function OverviewPage() {
  const actor = await getActor();
  const user = requireAuth(actor);

  const [shipments, quotes, requests] = await Promise.all([
    listMyShipments(actor),
    listMyQuotes(actor, listQuotesQuerySchema.parse({})),
    listMyRequests(actor, listRequestsQuerySchema.parse({})),
  ]);

  const activeShipments = shipments.filter(
    (shipment) => !isTerminal(shipment.status as ShipmentStatus)
  );
  const pendingRequests = requests.items.filter((request) =>
    PENDING_REQUEST_STATUSES.includes(request.status)
  );
  const awaitingQuotes = quotes.items.filter((quote) =>
    AWAITING_CUSTOMER_QUOTE_STATUSES.includes(quote.status)
  );

  const stats = [
    {
      label: "Đơn đang vận chuyển",
      value: activeShipments.length,
      icon: Truck,
      href: "/tai-khoan/don-hang",
    },
    {
      label: "Yêu cầu chờ xử lý",
      value: pendingRequests.length,
      icon: ClockAlert,
      href: "/tai-khoan/yeu-cau",
    },
    {
      label: "Báo giá chờ bạn phản hồi",
      value: awaitingQuotes.length,
      icon: FileText,
      href: "/tai-khoan/bao-gia",
    },
  ];

  const latest = activeShipments[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-navy">Xin chào, {user.name}</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Tổng quan hoạt động vận chuyển của bạn.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex items-center gap-4 rounded-lg border border-border bg-white p-5 transition-colors hover:border-navy/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy transition-colors group-hover:bg-orange/10 group-hover:text-orange-text">
              <stat.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-extrabold leading-none text-navy">{stat.value}</p>
              <p className="mt-1.5 text-sm text-foreground/65">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <section aria-labelledby="hanh-dong-nhanh">
        <h2 id="hanh-dong-nhanh" className="text-base font-bold text-navy">
          Hành động nhanh
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/bao-gia">
              <Plus className="h-4 w-4" aria-hidden />
              Tạo yêu cầu báo giá
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tra-cuu">
              <Search className="h-4 w-4" aria-hidden />
              Tra cứu vận đơn
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tai-khoan/don-hang">Xem tất cả đơn hàng</Link>
          </Button>
        </div>
      </section>

      {latest && (
        <section aria-labelledby="don-moi-nhat">
          <div className="flex items-center justify-between gap-3">
            <h2 id="don-moi-nhat" className="text-base font-bold text-navy">
              Đơn hàng gần nhất
            </h2>
            <Link
              href={`/tai-khoan/don-hang/${latest.trackingCode}`}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
            >
              Xem chi tiết
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-lg font-bold text-navy">{latest.trackingCode}</p>
              <Badge variant={SHIPMENT_STATUS_TONE[latest.status as ShipmentStatus]}>
                {SHIPMENT_STATUS_LABELS[latest.status as ShipmentStatus]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-foreground/70">
              {latest.stops.find((s) => s.kind === "PICKUP")?.province ?? "—"}
              <span className="mx-1.5 text-muted" aria-hidden>
                →
              </span>
              {latest.stops.find((s) => s.kind === "DELIVERY")?.province ?? "—"}
            </p>
            {latest.estimatedDeliveryAt && (
              <p className="mt-2 text-xs text-muted">
                Dự kiến giao {formatDateTime(latest.estimatedDeliveryAt)}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
