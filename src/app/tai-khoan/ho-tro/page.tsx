import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyTickets } from "@/modules/support/service";
import { listMyShipments } from "@/modules/tracking/service";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABELS,
  type TicketStatus,
  type TicketType,
} from "@/modules/support/state-machine";
import { CreateTicketForm } from "@/components/support/create-ticket-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Hỗ trợ",
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  const actor = await getActor();

  const [tickets, shipments] = await Promise.all([
    listMyTickets(actor),
    listMyShipments(actor),
  ]);

  const shipmentOptions = shipments.map((shipment) => {
    const pickup = shipment.stops.find((stop) => stop.kind === "PICKUP");
    const dropoff = shipment.stops.find((stop) => stop.kind === "DELIVERY");
    return {
      trackingCode: shipment.trackingCode,
      label: `${shipment.trackingCode} · ${pickup?.province ?? "—"} → ${dropoff?.province ?? "—"}`,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Hỗ trợ</h1>
          <p className="mt-1 text-sm text-foreground/70">
            {tickets.length > 0 ? `${tickets.length} yêu cầu hỗ trợ` : "Chưa có yêu cầu nào"}
          </p>
        </div>
      </div>

      <CreateTicketForm shipments={shipmentOptions} />

      {tickets.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu hỗ trợ"
          description="Gửi yêu cầu khi bạn cần giải đáp, khiếu nại hoặc hỏi về hóa đơn. Chúng tôi phản hồi trong giờ làm việc."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => {
            const status = ticket.status as TicketStatus;

            return (
              <li key={ticket.id}>
                <Link
                  href={`/tai-khoan/ho-tro/${ticket.code}`}
                  className="flex items-start gap-4 rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                    <LifeBuoy className="h-4 w-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy">{ticket.code}</span>
                      <Badge variant={TICKET_STATUS_TONE[status]}>
                        {TICKET_STATUS_LABELS[status]}
                      </Badge>
                      <Badge variant="neutral">
                        {TICKET_TYPE_LABELS[ticket.type as TicketType]}
                      </Badge>
                    </div>

                    <p className="mt-1.5 font-medium text-navy">{ticket.subject}</p>

                    <p className="mt-1 text-xs text-muted">
                      {ticket.shipment && `Đơn ${ticket.shipment.trackingCode} · `}
                      Cập nhật {formatDateTime(ticket.updatedAt)}
                    </p>
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
