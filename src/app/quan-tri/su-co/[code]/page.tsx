import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, User, Clock } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission, can } from "@/modules/auth/policy";
import { getIncident } from "@/modules/incidents/service";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TONE,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  allowedIncidentTransitions,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from "@/modules/incidents/state-machine";
import { IncidentStatusForm } from "@/components/admin/incident-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết sự cố" };

export default async function IncidentDetailPage({
  params,
}: PageProps<"/quan-tri/su-co/[code]">) {
  const { code } = await params;
  const actor = await getActor();
  requirePermission(actor, "incident.read_all");

  let incident;
  try {
    incident = await getIncident(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const status = incident.status as IncidentStatus;
  const severity = incident.severity as IncidentSeverity;
  const canManage = can(actor, "incident.manage");

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/su-co">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách sự cố
        </Link>
      </Button>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-navy">{incident.code}</span>
          <Badge variant={INCIDENT_STATUS_TONE[status]}>{INCIDENT_STATUS_LABELS[status]}</Badge>
          <Badge variant={severity === "CRITICAL" ? "error" : severity === "HIGH" ? "warning" : "neutral"}>
            {INCIDENT_SEVERITY_LABELS[severity]}
          </Badge>
          <Badge variant="neutral">{INCIDENT_TYPE_LABELS[incident.type as IncidentType]}</Badge>
        </div>
        <h1 className="text-xl font-bold text-navy">{incident.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Mô tả</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {incident.description}
              </p>

              {(incident.latitude !== null || incident.longitude !== null) && (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Vị trí ghi nhận: {incident.latitude?.toString()}, {incident.longitude?.toString()}
                  <span className="ml-1">— dữ liệu bổ trợ, không phải bằng chứng duy nhất</span>
                </p>
              )}
            </CardContent>
          </Card>

          {incident.resolution && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Kết luận xử lý</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                  {incident.resolution}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Clock className="h-4 w-4" aria-hidden />
                Thông tin
              </h2>

              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Xảy ra lúc</dt>
                  <dd className="text-right font-medium text-navy">
                    {formatDateTime(incident.occurredAt)}
                  </dd>
                </div>

                {incident.reportedBy && (
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted">
                      <User className="h-3.5 w-3.5" aria-hidden />
                      Người báo
                    </dt>
                    <dd className="text-right font-medium text-navy">
                      {incident.reportedBy.name}
                    </dd>
                  </div>
                )}

                {incident.assignee && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Phụ trách</dt>
                    <dd className="text-right font-medium text-navy">{incident.assignee.name}</dd>
                  </div>
                )}

                {incident.resolvedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Xử lý xong</dt>
                    <dd className="text-right font-medium text-navy">
                      {formatDateTime(incident.resolvedAt)}
                    </dd>
                  </div>
                )}
              </dl>

              {incident.shipment && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Package className="h-3.5 w-3.5" aria-hidden />
                    Chuyến liên quan
                  </p>
                  <Link
                    href={`/quan-tri/dieu-phoi/${incident.shipment.trackingCode}`}
                    className="mt-1 block font-mono text-sm font-semibold text-orange-text hover:underline"
                  >
                    {incident.shipment.trackingCode}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {canManage ? (
                <IncidentStatusForm
                  code={incident.code}
                  currentSeverity={severity}
                  transitions={allowedIncidentTransitions(status)}
                />
              ) : (
                <p className="text-sm text-foreground/70">
                  Vai trò của bạn đọc được sự cố nhưng không xử lý được.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
