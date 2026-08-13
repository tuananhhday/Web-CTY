import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, AlertTriangle, Mail } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import { listTicketsForStaff, listContactInquiries } from "@/modules/support/service";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  isOverdue,
  needsStaffAttention,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from "@/modules/support/state-machine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { formatPhoneForDisplay } from "@/lib/normalize";

export const metadata: Metadata = { title: "Hỗ trợ khách hàng" };

const PRIORITY_TONE: Record<TicketPriority, "neutral" | "orange" | "warning" | "error"> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "error",
};

export default async function StaffSupportPage() {
  const actor = await getActor();
  requirePermission(actor, "support.read_all");

  const [tickets, inquiries] = await Promise.all([
    listTicketsForStaff(),
    listContactInquiries(actor, "NEW"),
  ]);

  const now = new Date();
  const overdue = tickets.filter((ticket) =>
    isOverdue(
      {
        status: ticket.status as TicketStatus,
        slaDueAt: ticket.slaDueAt,
        firstRespondedAt: ticket.firstRespondedAt,
      },
      now
    )
  );
  const waiting = tickets.filter(
    (ticket) => needsStaffAttention(ticket.status as TicketStatus) && !overdue.includes(ticket)
  );
  const others = tickets.filter(
    (ticket) => !overdue.includes(ticket) && !waiting.includes(ticket)
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-navy">Hỗ trợ khách hàng</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {tickets.length} phiếu đang mở · {inquiries.length} liên hệ mới
        </p>
      </div>

      {[
        { key: "overdue", title: "Quá hạn phản hồi", items: overdue, tone: "error" as const },
        { key: "waiting", title: "Chờ xử lý", items: waiting, tone: "warning" as const },
        { key: "others", title: "Đang theo dõi", items: others, tone: "neutral" as const },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-labelledby={`nhom-${group.key}`}>
            <h2
              id={`nhom-${group.key}`}
              className={`mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${
                group.tone === "error" ? "text-error" : "text-muted"
              }`}
            >
              {group.tone === "error" && <AlertTriangle className="h-4 w-4" aria-hidden />}
              {group.title} ({group.items.length})
            </h2>

            <ul className="flex flex-col gap-2">
              {group.items.map((ticket) => {
                const status = ticket.status as TicketStatus;
                const priority = ticket.priority as TicketPriority;

                return (
                  <li key={ticket.id}>
                    <Link
                      href={`/quan-tri/ho-tro/${ticket.code}`}
                      className={`flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
                        group.tone === "error" ? "border-error/25" : "border-border"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-navy">
                            {ticket.code}
                          </span>
                          <Badge variant={TICKET_STATUS_TONE[status]}>
                            {TICKET_STATUS_LABELS[status]}
                          </Badge>
                          <Badge variant={PRIORITY_TONE[priority]}>
                            {TICKET_PRIORITY_LABELS[priority]}
                          </Badge>
                          <Badge variant="neutral">
                            {TICKET_TYPE_LABELS[ticket.type as TicketType]}
                          </Badge>
                        </div>

                        <p className="mt-1.5 font-medium text-navy">{ticket.subject}</p>

                        <p className="mt-1 text-xs text-muted">
                          {ticket.user.name} · tạo {formatRelative(ticket.createdAt)}
                          {ticket.shipment && ` · đơn ${ticket.shipment.trackingCode}`}
                          {ticket.slaDueAt &&
                            !ticket.firstRespondedAt &&
                            ` · hạn nội bộ ${formatDateTime(ticket.slaDueAt)}`}
                        </p>
                      </div>

                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {tickets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <LifeBuoy className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Không có phiếu nào đang mở</p>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="lien-he">
        <h2
          id="lien-he"
          className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted"
        >
          <Mail className="h-4 w-4" aria-hidden />
          Liên hệ mới từ website ({inquiries.length})
        </h2>

        {inquiries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-foreground/65">
              Chưa có liên hệ mới nào.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {inquiries.map((inquiry) => (
              <li
                key={inquiry.id}
                className="rounded-lg border border-border bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-navy">{inquiry.name}</span>
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="text-sm text-orange-text hover:underline"
                  >
                    {formatPhoneForDisplay(inquiry.phone)}
                  </a>
                  {inquiry.email && (
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="text-sm text-orange-text hover:underline"
                    >
                      {inquiry.email}
                    </a>
                  )}
                  <time
                    dateTime={inquiry.createdAt.toISOString()}
                    className="ml-auto text-xs text-muted"
                  >
                    {formatRelative(inquiry.createdAt)}
                  </time>
                </div>

                <p className="mt-1.5 text-sm font-semibold text-navy">{inquiry.subject}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground/75">
                  {inquiry.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
