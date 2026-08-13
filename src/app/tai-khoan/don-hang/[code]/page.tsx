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
  Clock,
  Info,
  Image as ImageIcon,
} from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getMyShipment } from "@/modules/tracking/service";
import { listShipmentMedia } from "@/modules/media/service";
import { getShipmentTrack } from "@/modules/locations/service";
import { MediaGallery } from "@/components/shared/media-gallery";
import { ShipmentLocation } from "@/components/shared/shipment-location";
import {
  CUSTOMER_MILESTONES,
  customerMilestoneOf,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhoneForDisplay } from "@/lib/normalize";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Chi tiết đơn hàng",
  robots: { index: false, follow: false },
};

const STOP_LABELS: Record<string, string> = {
  PICKUP: "Điểm lấy hàng",
  DELIVERY: "Điểm giao hàng",
  WAYPOINT: "Điểm dừng",
};

export default async function MyShipmentDetailPage({
  params,
}: PageProps<"/tai-khoan/don-hang/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let shipment;
  try {
    shipment = await getMyShipment(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const [media, track] = await Promise.all([
    listShipmentMedia(actor, shipment.trackingCode),
    getShipmentTrack(actor, shipment.trackingCode),
  ]);

  const status = shipment.status as ShipmentStatus;
  const currentMilestone = customerMilestoneOf(status);
  const currentIndex = CUSTOMER_MILESTONES.findIndex((m) => m.key === currentMilestone);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/tai-khoan/don-hang">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Đơn hàng của tôi
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{shipment.trackingCode}</h1>
        <Badge variant={SHIPMENT_STATUS_TONE[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
        {shipment.vehicleType && <Badge variant="neutral">{shipment.vehicleType.name}</Badge>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Tiến trình theo 5 mốc thân thiện, không phải 19 mã nội bộ (§15) */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Tiến trình</h2>
              <ol className="mt-5 relative flex flex-col gap-0 border-l-2 border-border pl-6">
                {CUSTOMER_MILESTONES.map((milestone, index) => {
                  const reached = currentIndex >= 0 && index <= currentIndex;
                  return (
                    <li key={milestone.key} className="relative pb-5 last:pb-0">
                      <span
                        className={
                          reached
                            ? "absolute -left-[31px] h-5 w-5 rounded-full bg-orange"
                            : "absolute -left-[31px] h-5 w-5 rounded-full bg-white ring-2 ring-border"
                        }
                        aria-hidden
                      />
                      <p
                        className={
                          reached
                            ? "text-sm font-semibold text-navy"
                            : "text-sm font-medium text-muted"
                        }
                      >
                        {milestone.label}
                        <span className="sr-only">
                          {reached ? " — đã hoàn thành" : " — chưa tới"}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Địa chỉ đầy đủ — khách đã đăng nhập nên xem được (§16.1) */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Địa điểm</h2>
              <div className="mt-4 flex flex-col gap-4">
                {shipment.stops.map((stop) => (
                  <div key={stop.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                      <MapPin className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {STOP_LABELS[stop.kind] ?? "Điểm dừng"}
                      </p>
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
                      {stop.accessNote && (
                        <p className="mt-1 text-xs text-foreground/65">{stop.accessNote}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {track.available && (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Vị trí xe
                </h2>
                <div className="mt-4">
                  <ShipmentLocation view={track} />
                </div>
              </CardContent>
            </Card>
          )}

          {media.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Hình ảnh hàng hóa
                </h2>
                <p className="mt-1 text-sm text-foreground/70">
                  Ảnh do đội vận chuyển ghi lại trong quá trình thực hiện.
                </p>
                <div className="mt-4">
                  <MediaGallery items={media} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Lịch sử cập nhật</h2>
              <ol className="mt-4 flex flex-col gap-3">
                {shipment.statusEvents.map((event) => (
                  <li
                    key={event.id}
                    className="border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <p className="text-sm font-medium text-navy">
                      {SHIPMENT_STATUS_LABELS[event.toStatus as ShipmentStatus]}
                    </p>
                    <time
                      dateTime={event.occurredAt.toISOString()}
                      className="mt-0.5 block text-xs text-muted"
                    >
                      {formatDateTime(event.occurredAt)}
                    </time>
                    {event.note && (
                      <p className="mt-1 text-sm text-foreground/70">{event.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Clock className="h-4 w-4" aria-hidden />
                Thời gian
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  { label: "Lịch lấy hàng", value: shipment.scheduledPickupAt },
                  { label: "Đã lấy hàng lúc", value: shipment.actualPickupAt },
                  { label: "Dự kiến giao", value: shipment.estimatedDeliveryAt },
                  { label: "Đã giao lúc", value: shipment.deliveredAt },
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
            </CardContent>
          </Card>

          {/* Tài xế chỉ hiện trong cửa sổ thời gian chuyến hoạt động (§16.1) */}
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <Truck className="h-4 w-4" aria-hidden />
                Phương tiện và tài xế
              </h2>

              {shipment.driver ? (
                <dl className="mt-4 flex flex-col gap-3 text-sm">
                  {shipment.vehicle && (
                    <div>
                      <dt className="text-xs text-muted">Biển số</dt>
                      <dd className="font-mono font-bold text-navy">
                        {shipment.vehicle.plateNumber}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted">Tài xế</dt>
                    <dd className="flex items-center gap-1.5 font-medium text-navy">
                      <UserRound className="h-3.5 w-3.5" aria-hidden />
                      {shipment.driver.fullName}
                    </dd>
                  </div>
                  {shipment.driver.phone && (
                    <div>
                      <dt className="text-xs text-muted">Liên hệ</dt>
                      <dd>
                        <a
                          href={`tel:${shipment.driver.phone}`}
                          className="inline-flex items-center gap-1.5 font-medium text-orange-text hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {formatPhoneForDisplay(shipment.driver.phone)}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <Alert variant="info" className="mt-4">
                  <Info aria-hidden />
                  <p>
                    {shipment.driverHiddenReason === "outside_window"
                      ? "Thông tin tài xế chỉ hiển thị trong thời gian chuyến đang thực hiện."
                      : "Chuyến hàng chưa được phân công phương tiện."}
                  </p>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Thông tin đơn</h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {shipment.totalAmount && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Giá trị đơn</dt>
                    <dd className="font-bold text-navy">
                      {formatMoney(shipment.totalAmount.toString())}
                    </dd>
                  </div>
                )}
                {shipment.quote && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Báo giá</dt>
                    <dd>
                      <Link
                        href={`/tai-khoan/bao-gia/${shipment.quote.code}`}
                        className="inline-flex items-center gap-1.5 font-mono font-medium text-orange-text hover:underline"
                      >
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                        {shipment.quote.code}
                      </Link>
                    </dd>
                  </div>
                )}
                {shipment.serviceRequest && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Yêu cầu gốc</dt>
                    <dd>
                      <Link
                        href={`/tai-khoan/yeu-cau/${shipment.serviceRequest.code}`}
                        className="font-mono font-medium text-orange-text hover:underline"
                      >
                        {shipment.serviceRequest.code}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>

              {shipment.instructions && (
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-navy">Hướng dẫn giao nhận</h3>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
                    {shipment.instructions}
                  </p>
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/lien-he">Cần hỗ trợ về đơn này</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
