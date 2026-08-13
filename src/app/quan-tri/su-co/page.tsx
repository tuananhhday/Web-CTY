import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listIncidents } from "@/modules/incidents/service";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TONE,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  isIncidentOpen,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from "@/modules/incidents/state-machine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatRelative } from "@/lib/datetime";

export const metadata: Metadata = { title: "Sự cố" };

const SEVERITY_TONE: Record<IncidentSeverity, "neutral" | "warning" | "error"> = {
  LOW: "neutral",
  MEDIUM: "neutral",
  HIGH: "warning",
  CRITICAL: "error",
};

export default async function IncidentsPage() {
  const actor = await getActor();
  const incidents = await listIncidents(actor);

  const open = incidents.filter((incident) =>
    isIncidentOpen(incident.status as IncidentStatus)
  );
  const closed = incidents.filter(
    (incident) => !isIncidentOpen(incident.status as IncidentStatus)
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-navy">Sự cố</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {open.length > 0 ? `${open.length} sự cố đang mở` : "Không có sự cố nào đang mở"}
        </p>
      </div>

      {incidents.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success/40" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa ghi nhận sự cố nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Sự cố do tài xế báo từ ứng dụng hoặc điều phối ghi nhận sẽ hiện ở đây.
            </p>
          </CardContent>
        </Card>
      )}

      {[
        { key: "open", title: "Đang mở", items: open },
        { key: "closed", title: "Đã khép lại", items: closed },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-labelledby={`nhom-${group.key}`}>
            <h2
              id={`nhom-${group.key}`}
              className={`mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${
                group.key === "open" ? "text-error" : "text-muted"
              }`}
            >
              {group.key === "open" && <ShieldAlert className="h-4 w-4" aria-hidden />}
              {group.title} ({group.items.length})
            </h2>

            <ul className="flex flex-col gap-2">
              {group.items.map((incident) => {
                const status = incident.status as IncidentStatus;
                const severity = incident.severity as IncidentSeverity;

                return (
                  <li key={incident.id}>
                    <Link
                      href={`/quan-tri/su-co/${incident.code}`}
                      className={`flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
                        severity === "CRITICAL" && isIncidentOpen(status)
                          ? "border-error/30"
                          : "border-border"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-navy">
                            {incident.code}
                          </span>
                          <Badge variant={INCIDENT_STATUS_TONE[status]}>
                            {INCIDENT_STATUS_LABELS[status]}
                          </Badge>
                          <Badge variant={SEVERITY_TONE[severity]}>
                            {INCIDENT_SEVERITY_LABELS[severity]}
                          </Badge>
                          <Badge variant="neutral">
                            {INCIDENT_TYPE_LABELS[incident.type as IncidentType]}
                          </Badge>
                        </div>

                        <p className="mt-1.5 font-medium text-navy">{incident.title}</p>

                        <p className="mt-1 text-xs text-muted">
                          {incident.shipment && `Đơn ${incident.shipment.trackingCode} · `}
                          {incident.reportedBy && `${incident.reportedBy.name} báo · `}
                          {formatRelative(incident.occurredAt)}
                          {incident.assignee && ` · ${incident.assignee.name} phụ trách`}
                          {incident.resolvedAt && ` · xử lý xong ${formatDateTime(incident.resolvedAt)}`}
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
    </div>
  );
}
