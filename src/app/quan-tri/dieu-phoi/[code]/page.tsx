import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Truck,
  UserRound,
  ReceiptText,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
} from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { getShipmentAsStaff } from "@/modules/shipments/service";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { listAvailableVehicles, listAvailableDrivers } from "@/modules/fleet/repository";
import { listShipmentMedia } from "@/modules/media/service";
import { listIncidentsForShipment } from "@/modules/incidents/service";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TONE,
  INCIDENT_SEVERITY_LABELS,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/modules/incidents/state-machine";
import { getShipmentTrack } from "@/modules/locations/service";
import { MediaGallery } from "@/components/shared/media-gallery";
import { ShipmentLocation } from "@/components/shared/shipment-location";
import { LocationSharingToggle } from "@/components/admin/location-sharing-toggle";
import { AssignmentForm } from "@/components/admin/assignment-form";
import { ShipmentStatusForm } from "@/components/admin/shipment-status-form";
import { ReleaseAssignmentForm } from "@/components/admin/release-assignment-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDateTime, addHours } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhoneForDisplay } from "@/lib/normalize";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết điều phối" };

/** Khoảng thời gian phân công mặc định khi chuyến chưa có lịch cụ thể. */
const DEFAULT_WINDOW_HOURS = 8;

export default async function DispatchDetailPage({
  params,
}: PageProps<"/quan-tri/dieu-phoi/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let shipment;
  try {
    shipment = await getShipmentAsStaff(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const canDispatch = can(actor, "shipment.dispatch");
  const canUpdateStatus = can(actor, "shipment.update") && can(actor, "shipment.read_all");
  const canManageInvoice = can(actor, "invoice.manage");

  // Xe và tài xế chỉ nạp khi thật sự dùng tới — người chỉ có quyền đọc không cần danh sách.
  const [vehicles, drivers] = canDispatch
    ? await Promise.all([listAvailableVehicles(), listAvailableDrivers()])
    : [[], []];

  const [media, track, incidents] = await Promise.all([
    listShipmentMedia(actor, shipment.trackingCode),
    getShipmentTrack(actor, shipment.trackingCode),
    listIncidentsForShipment(actor, shipment.trackingCode),
  ]);
  const activeAssignment = shipment.assignments.find((a) => a.isActive) ?? null;
  const pastAssignments = shipment.assignments.filter((a) => !a.isActive);

  const windowFrom = shipment.scheduledPickupAt ?? new Date();
  const windowTo =
    shipment.estimatedDeliveryAt ?? addHours(windowFrom, DEFAULT_WINDOW_HOURS);

  const pickup = shipment.stops.find((s) => s.kind === "PICKUP");
  const dropoff = shipment.stops.find((s) => s.kind === "DELIVERY");

  const status = shipment.status as ShipmentStatus;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/dieu-phoi">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Điều phối
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{shipment.trackingCode}</h1>
        <Badge variant={SHIPMENT_STATUS_TONE[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
        {shipment.vehicleType && <Badge variant="neutral">{shipment.vehicleType.name}</Badge>}
        {!activeAssignment && <Badge variant="warning">Chưa phân công</Badge>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Hành trình */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Hành trình</h2>
              <div className="mt-4 flex flex-col gap-4">
                {[
                  { label: "Điểm lấy hàng", stop: pickup },
                  { label: "Điểm giao hàng", stop: dropoff },
                ].map(
                  ({ label, stop }) =>
                    stop && (
                      <div key={label} className="flex gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                          <MapPin className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted">{label}</p>
                          <p className="font-medium text-navy">{stop.line}</p>
                          <p className="text-sm text-foreground/70">
                            {[stop.ward, stop.district, stop.province].filter(Boolean).join(", ")}
                          </p>
                          {stop.contactName && (
                            <p className="mt-1 text-sm text-foreground/70">
                              {stop.contactName}
                              {stop.contactPhone && ` · ${formatPhoneForDisplay(stop.contactPhone)}`}
                            </p>
                          )}
                          {(stop.floorNumber !== null || stop.carryDistanceM !== null) && (
                            <p className="mt-1 rounded bg-warning-bg px-2 py-1 text-xs text-warning">
                              {stop.floorNumber !== null && `Tầng ${stop.floorNumber}`}
                              {stop.hasElevator !== null &&
                                ` · ${stop.hasElevator ? "có" : "KHÔNG có"} thang máy`}
                              {stop.carryDistanceM !== null && ` · bê hàng ${stop.carryDistanceM}m`}
                            </p>
                          )}
                          {stop.accessNote && (
                            <p className="mt-1 text-xs text-foreground/65">{stop.accessNote}</p>
                          )}
                        </div>
                      </div>
                    )
                )}
              </div>

              <dl className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Lịch lấy hàng</dt>
                  <dd className="font-medium text-navy">
                    {shipment.scheduledPickupAt
                      ? formatDateTime(shipment.scheduledPickupAt)
                      : "Chưa đặt lịch"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Dự kiến giao</dt>
                  <dd className="font-medium text-navy">
                    {shipment.estimatedDeliveryAt
                      ? formatDateTime(shipment.estimatedDeliveryAt)
                      : "Chưa xác định"}
                  </dd>
                </div>
                {shipment.actualPickupAt && (
                  <div>
                    <dt className="text-xs text-muted">Lấy hàng thực tế</dt>
                    <dd className="font-medium text-navy">
                      {formatDateTime(shipment.actualPickupAt)}
                    </dd>
                  </div>
                )}
                {shipment.deliveredAt && (
                  <div>
                    <dt className="text-xs text-muted">Giao hàng thực tế</dt>
                    <dd className="font-medium text-navy">
                      {formatDateTime(shipment.deliveredAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Phân công hiện tại */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Phân công hiện tại</h2>

              {activeAssignment ? (
                <div className="mt-4 flex flex-col gap-4">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <Truck className="h-3.5 w-3.5" aria-hidden />
                        Xe
                      </dt>
                      <dd className="font-mono font-bold text-navy">
                        {activeAssignment.vehicle?.plateNumber ?? "Chưa gán"}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <UserRound className="h-3.5 w-3.5" aria-hidden />
                        Tài xế chính
                      </dt>
                      <dd className="font-medium text-navy">
                        {activeAssignment.primaryDriver ? (
                          <a
                            href={`tel:${activeAssignment.primaryDriver.workPhoneNormalized}`}
                            className="inline-flex items-center gap-1.5 hover:text-orange-text"
                          >
                            <Phone className="h-3.5 w-3.5" aria-hidden />
                            {activeAssignment.primaryDriver.fullName}
                          </a>
                        ) : (
                          "Chưa gán"
                        )}
                      </dd>
                    </div>
                    {activeAssignment.secondaryDriver && (
                      <div>
                        <dt className="text-xs text-muted">Tài xế phụ</dt>
                        <dd className="font-medium text-navy">
                          {activeAssignment.secondaryDriver.fullName}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-muted">Hiệu lực</dt>
                      <dd className="text-sm text-foreground/80">
                        {formatDateTime(activeAssignment.effectiveFrom)} →{" "}
                        {formatDateTime(activeAssignment.effectiveTo)}
                      </dd>
                    </div>
                  </dl>

                  {activeAssignment.overrideConflict && (
                    <Alert variant="warning">
                      <FileText aria-hidden />
                      <div>
                        <p className="font-semibold">Phân công này đã bỏ qua cảnh báo trùng lịch</p>
                        {activeAssignment.overrideReason && (
                          <p className="mt-1">Lý do: {activeAssignment.overrideReason}</p>
                        )}
                      </div>
                    </Alert>
                  )}

                  {activeAssignment.note && (
                    <p className="text-sm text-foreground/70">
                      Ghi chú: {activeAssignment.note}
                    </p>
                  )}

                  {canDispatch && <ReleaseAssignmentForm trackingCode={shipment.trackingCode} />}
                </div>
              ) : (
                <p className="mt-3 text-sm text-foreground/65">
                  Chuyến này chưa có xe và tài xế. Dùng biểu mẫu bên phải để phân công.
                </p>
              )}

              {pastAssignments.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-navy">
                    Lịch sử phân công ({pastAssignments.length})
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {pastAssignments.map((assignment) => (
                      <li
                        key={assignment.id}
                        className="flex flex-wrap items-center gap-2 text-foreground/70"
                      >
                        <span className="font-mono">
                          {assignment.vehicle?.plateNumber ?? "—"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{assignment.primaryDriver?.fullName ?? "—"}</span>
                        {assignment.releasedAt && (
                          <span className="text-xs text-muted">
                            gỡ lúc {formatDateTime(assignment.releasedAt)}
                          </span>
                        )}
                        {assignment.overrideConflict && (
                          <Badge variant="warning">Đã bỏ qua cảnh báo</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {media.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Hình ảnh chuyến hàng ({media.length})
                </h2>
                <div className="mt-4">
                  <MediaGallery items={media} showVisibility />
                </div>
              </CardContent>
            </Card>
          )}

          {incidents.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                  <ShieldAlert className="h-4 w-4 text-error" aria-hidden />
                  Sự cố ({incidents.length})
                </h2>

                <ul className="mt-4 flex flex-col gap-2">
                  {incidents.map((incident) => (
                    <li key={incident.id}>
                      <Link
                        href={`/quan-tri/su-co/${incident.code}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:border-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                      >
                        <span className="font-mono text-xs font-bold text-navy">
                          {incident.code}
                        </span>
                        <Badge variant={INCIDENT_STATUS_TONE[incident.status as IncidentStatus]}>
                          {INCIDENT_STATUS_LABELS[incident.status as IncidentStatus]}
                        </Badge>
                        <Badge
                          variant={
                            incident.severity === "CRITICAL"
                              ? "error"
                              : incident.severity === "HIGH"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {INCIDENT_SEVERITY_LABELS[incident.severity as IncidentSeverity]}
                        </Badge>
                        <span className="text-sm text-foreground/80">{incident.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Nguồn gốc đơn hàng */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Nguồn gốc và khách hàng</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {shipment.serviceRequest && (
                  <>
                    <div>
                      <dt className="text-xs text-muted">Người liên hệ</dt>
                      <dd className="font-medium text-navy">
                        {shipment.serviceRequest.contactName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Điện thoại</dt>
                      <dd className="font-medium text-navy">
                        <a
                          href={`tel:${shipment.serviceRequest.contactPhoneNormalized}`}
                          className="inline-flex items-center gap-1.5 hover:text-orange-text"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {formatPhoneForDisplay(shipment.serviceRequest.contactPhoneNormalized)}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Yêu cầu gốc</dt>
                      <dd>
                        <Link
                          href={`/quan-tri/yeu-cau/${shipment.serviceRequest.code}`}
                          className="font-mono text-sm font-medium text-orange-text hover:underline"
                        >
                          {shipment.serviceRequest.code}
                        </Link>
                      </dd>
                    </div>
                  </>
                )}
                {shipment.quote && (
                  <div>
                    <dt className="text-xs text-muted">Báo giá</dt>
                    <dd>
                      <Link
                        href={`/quan-tri/bao-gia/${shipment.quote.code}`}
                        className="inline-flex items-center gap-1.5 font-mono text-sm font-medium text-orange-text hover:underline"
                      >
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                        {shipment.quote.code}
                      </Link>
                    </dd>
                  </div>
                )}
                {shipment.totalAmount && (
                  <div>
                    <dt className="text-xs text-muted">Giá trị đơn</dt>
                    <dd className="font-bold text-navy">
                      {formatMoney(shipment.totalAmount.toString())}
                    </dd>
                  </div>
                )}
              </dl>

              {shipment.instructions && (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-navy">Hướng dẫn cho tài xế</h3>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
                    {shipment.instructions}
                  </p>
                </div>
              )}

              {/* Lập hóa đơn chỉ có nghĩa khi chuyến đã xong — dòng chi phí lấy từ báo giá đã chốt (§20). */}
              {canManageInvoice && status === "COMPLETED" && (
                <div className="mt-5 border-t border-border pt-4">
                  <Button asChild variant="outline">
                    <Link href={`/quan-tri/hoa-don/moi?chuyen=${shipment.trackingCode}`}>
                      <ReceiptText className="h-4 w-4" aria-hidden />
                      Lập hóa đơn cho chuyến này
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {canDispatch && (
            <Card>
              <CardContent className="p-6">
                <AssignmentForm
                  trackingCode={shipment.trackingCode}
                  vehicles={vehicles.map((vehicle) => ({
                    id: vehicle.id,
                    plateNumber: vehicle.plateNumber,
                    typeName: vehicle.vehicleType.name,
                  }))}
                  drivers={drivers.map((driver) => ({
                    id: driver.id,
                    fullName: driver.fullName,
                    employeeCode: driver.employeeCode,
                    licenseClass: driver.licenseClass,
                  }))}
                  defaultFrom={windowFrom}
                  defaultTo={windowTo}
                  current={
                    activeAssignment
                      ? {
                          vehicleId: activeAssignment.vehicle?.id ?? null,
                          primaryDriverId: activeAssignment.primaryDriver?.id ?? null,
                          secondaryDriverId: activeAssignment.secondaryDriver?.id ?? null,
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              {canUpdateStatus ? (
                <ShipmentStatusForm
                  trackingCode={shipment.trackingCode}
                  currentStatus={status}
                  hasProofOfDelivery={shipment.proofOfDeliveries.length > 0}
                />
              ) : (
                <Alert variant="info">
                  <FileText aria-hidden />
                  <p>
                    Vai trò của bạn xem được đơn hàng nhưng không đổi được trạng thái vận
                    chuyển.
                  </p>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <MapPin className="h-4 w-4" aria-hidden />
                Vị trí xe
              </h2>
              <div className="mt-4">
                <ShipmentLocation view={track} />
              </div>

              {canDispatch && (
                <div className="mt-5 border-t border-border pt-4">
                  <LocationSharingToggle
                    trackingCode={shipment.trackingCode}
                    enabled={shipment.locationSharingEnabled}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Lịch sử trạng thái</h2>
              <ol className="mt-4 flex flex-col gap-4">
                {shipment.statusEvents.map((event) => (
                  <li key={event.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.fromStatus && (
                        <>
                          <Badge variant={SHIPMENT_STATUS_TONE[event.fromStatus as ShipmentStatus]}>
                            {SHIPMENT_STATUS_LABELS[event.fromStatus as ShipmentStatus]}
                          </Badge>
                          <span aria-hidden className="text-muted">
                            →
                          </span>
                        </>
                      )}
                      <Badge variant={SHIPMENT_STATUS_TONE[event.toStatus as ShipmentStatus]}>
                        {SHIPMENT_STATUS_LABELS[event.toStatus as ShipmentStatus]}
                      </Badge>
                    </div>
                    <time
                      dateTime={event.occurredAt.toISOString()}
                      className="mt-1.5 block text-xs text-muted"
                    >
                      {formatDateTime(event.occurredAt)}
                      {event.actorRole && ` · ${event.actorRole}`}
                    </time>
                    {event.note && (
                      <p className="mt-1 text-sm text-foreground/70">{event.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
