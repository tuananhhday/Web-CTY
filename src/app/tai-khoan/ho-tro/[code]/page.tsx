import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getTicket } from "@/modules/support/service";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABELS,
  type TicketStatus,
  type TicketType,
} from "@/modules/support/state-machine";
import { TicketThread } from "@/components/support/ticket-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Chi tiết yêu cầu hỗ trợ",
  robots: { index: false, follow: false },
};

export default async function TicketDetailPage({
  params,
}: PageProps<"/tai-khoan/ho-tro/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let ticket;
  try {
    ticket = await getTicket(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const status = ticket.status as TicketStatus;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/tai-khoan/ho-tro">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách hỗ trợ
        </Link>
      </Button>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-navy">{ticket.code}</span>
          <Badge variant={TICKET_STATUS_TONE[status]}>{TICKET_STATUS_LABELS[status]}</Badge>
          <Badge variant="neutral">{TICKET_TYPE_LABELS[ticket.type as TicketType]}</Badge>
        </div>
        <h1 className="text-xl font-bold text-navy">{ticket.subject}</h1>
        <p className="text-xs text-muted">Tạo lúc {formatDateTime(ticket.createdAt)}</p>
      </header>

      {ticket.shipment && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Package className="h-4 w-4 text-muted" aria-hidden />
            <span className="text-sm text-foreground/75">Yêu cầu này liên quan tới đơn</span>
            <Link
              href={`/tai-khoan/don-hang/${ticket.shipment.trackingCode}`}
              className="font-mono text-sm font-semibold text-orange-text hover:underline"
            >
              {ticket.shipment.trackingCode}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <TicketThread
            code={ticket.code}
            status={status}
            messages={ticket.messages}
            canWriteInternal={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
