import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, User } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission, can } from "@/modules/auth/policy";
import { getTicket } from "@/modules/support/service";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  allowedTicketTransitions,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from "@/modules/support/state-machine";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketStatusForm } from "@/components/support/ticket-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết phiếu hỗ trợ" };

export default async function StaffTicketPage({ params }: PageProps<"/quan-tri/ho-tro/[code]">) {
  const { code } = await params;
  const actor = await getActor();
  requirePermission(actor, "support.read_all");

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
  const canManage = can(actor, "support.manage");

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/ho-tro">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hàng chờ hỗ trợ
        </Link>
      </Button>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-navy">{ticket.code}</span>
          <Badge variant={TICKET_STATUS_TONE[status]}>{TICKET_STATUS_LABELS[status]}</Badge>
          <Badge variant="neutral">{TICKET_TYPE_LABELS[ticket.type as TicketType]}</Badge>
          <Badge variant="orange">
            {TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]}
          </Badge>
        </div>
        <h1 className="text-xl font-bold text-navy">{ticket.subject}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardContent className="p-6">
            <TicketThread
              code={ticket.code}
              status={status}
              messages={ticket.messages}
              canWriteInternal
            />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <User className="h-4 w-4" aria-hidden />
                Khách hàng
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Họ tên</dt>
                  <dd className="font-medium text-navy">{ticket.user.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${ticket.user.email}`}
                      className="font-medium text-orange-text hover:underline"
                    >
                      {ticket.user.email}
                    </a>
                  </dd>
                </div>
              </dl>

              {ticket.shipment && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Package className="h-3.5 w-3.5" aria-hidden />
                    Đơn liên quan
                  </p>
                  <Link
                    href={`/quan-tri/dieu-phoi/${ticket.shipment.trackingCode}`}
                    className="mt-1 block font-mono text-sm font-semibold text-orange-text hover:underline"
                  >
                    {ticket.shipment.trackingCode}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {canManage ? (
                <TicketStatusForm
                  code={ticket.code}
                  transitions={allowedTicketTransitions(status).filter((transition) =>
                    transition.by.includes("STAFF")
                  )}
                />
              ) : (
                <p className="text-sm text-foreground/70">
                  Vai trò của bạn đọc được phiếu nhưng không đổi được trạng thái.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Mốc thời gian</h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  { label: "Tạo lúc", value: ticket.createdAt },
                  { label: "Hạn phản hồi nội bộ", value: ticket.slaDueAt },
                  { label: "Phản hồi lần đầu", value: ticket.firstRespondedAt },
                  { label: "Đã xử lý", value: ticket.resolvedAt },
                  { label: "Đóng phiếu", value: ticket.closedAt },
                ]
                  .filter((row) => row.value !== null)
                  .map((row) => (
                    <div key={row.label} className="flex justify-between gap-3">
                      <dt className="text-muted">{row.label}</dt>
                      <dd className="text-right font-medium text-navy">
                        {formatDateTime(row.value as Date)}
                      </dd>
                    </div>
                  ))}
              </dl>

              <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                Hạn phản hồi là SLA nội bộ để xếp thứ tự hàng chờ, không phải cam kết đã công
                bố với khách hàng.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
