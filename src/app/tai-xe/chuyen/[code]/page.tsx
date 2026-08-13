import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Navigation,
  Truck,
  Info,
  Camera,
  ClipboardCheck,
} from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getDriverShipment } from "@/modules/shipments/service";
import { listShipmentMedia } from "@/modules/media/service";
import { suggestedStageFor } from "@/modules/media/schema";
import { getProofs } from "@/modules/proof-of-delivery/service";
import {
  DELIVERY_OUTCOME_LABELS,
  type DeliveryOutcome,
} from "@/modules/proof-of-delivery/schema";
import { MediaUpload } from "@/components/driver/media-upload";
import { MediaGallery } from "@/components/shared/media-gallery";
import { DeliveryProofForm } from "@/components/driver/delivery-proof-form";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  nextDriverStep,
  isActiveOnRoad,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { LocationSharing } from "@/components/driver/location-sharing";
import { NextStepButton } from "@/components/driver/next-step-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/datetime";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết chuyến" };

const STOP_LABELS: Record<string, string> = {
  PICKUP: "Điểm lấy hàng",
  DELIVERY: "Điểm giao hàng",
  WAYPOINT: "Điểm dừng",
};

/**
 * Link mở ứng dụng bản đồ sẵn có trên máy.
 *
 * Dùng geo: URI chứ không nhúng bản đồ: tài xế đang lái cần mở thẳng app dẫn đường quen
 * thuộc, và trang vẫn dùng được khi không có API key bản đồ (§17 — luôn có fallback).
 */
function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function DriverShipmentPage({
  params,
}: PageProps<"/tai-xe/chuyen/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let shipment;
  try {
    shipment = await getDriverShipment(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  const status = shipment.status as ShipmentStatus;
  const next = nextDriverStep(status);
  const assignment = shipment.assignments.find((a) => a.isActive) ?? null;
  const [media, proofs] = await Promise.all([
    listShipmentMedia(actor, shipment.trackingCode),
    getProofs(actor, shipment.trackingCode),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/tai-xe">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Chuyến của tôi
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-lg font-bold text-navy">{shipment.trackingCode}</h1>
        <Badge variant={SHIPMENT_STATUS_TONE[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
      </header>

      {/* Hành động đặt LÊN ĐẦU: đây là việc tài xế mở trang để làm (§26.2). */}
      {status === "DELIVERED_PENDING_CONFIRMATION" && !proofs.delivery ? (
        // Ở bước này việc duy nhất cần làm là lập biên bản, không phải đẩy trạng thái —
        // và trạng thái COMPLETED cũng bị chặn cho tới khi có biên bản (§15 ràng buộc 2).
        <DeliveryProofForm trackingCode={shipment.trackingCode} />
      ) : (
        <NextStepButton
          trackingCode={shipment.trackingCode}
          currentStatus={status}
          nextStatus={next}
        />
      )}

      {proofs.delivery && (
        <Alert variant="success">
          <ClipboardCheck aria-hidden />
          <div>
            <p className="font-semibold">
              Đã lập biên bản giao hàng — {DELIVERY_OUTCOME_LABELS[proofs.delivery.outcome as DeliveryOutcome]}
            </p>
            <p className="mt-1">
              Người nhận: {proofs.delivery.receiverName}
              {proofs.delivery.receiverRelation && ` (${proofs.delivery.receiverRelation})`}
              {" · "}
              {formatDateTime(proofs.delivery.recordedAt)}
            </p>
          </div>
        </Alert>
      )}

      {/* Điểm dừng: địa chỉ đầy đủ, nút gọi và nút dẫn đường cỡ ngón tay */}
      {shipment.stops.map((stop) => {
        const fullAddress = [stop.line, stop.ward, stop.district, stop.province]
          .filter(Boolean)
          .join(", ");

        return (
          <Card key={stop.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {STOP_LABELS[stop.kind] ?? "Điểm dừng"}
                  </p>
                  <p className="mt-0.5 font-medium text-navy">{stop.line}</p>
                  <p className="text-sm text-foreground/70">
                    {[stop.ward, stop.district, stop.province].filter(Boolean).join(", ")}
                  </p>

                  {(stop.floorNumber !== null || stop.carryDistanceM !== null) && (
                    <p className="mt-2 rounded bg-warning-bg px-2 py-1.5 text-xs text-warning">
                      {stop.floorNumber !== null && `Tầng ${stop.floorNumber}`}
                      {stop.hasElevator !== null &&
                        ` · ${stop.hasElevator ? "có" : "KHÔNG có"} thang máy`}
                      {stop.carryDistanceM !== null && ` · bê hàng ${stop.carryDistanceM}m`}
                    </p>
                  )}

                  {stop.accessNote && (
                    <p className="mt-1.5 text-xs text-foreground/70">{stop.accessNote}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {stop.contactPhone && (
                  <Button asChild variant="outline" className="h-11 flex-1">
                    <a href={`tel:${stop.contactPhone}`}>
                      <Phone className="h-4 w-4" aria-hidden />
                      Gọi {stop.contactName ?? "liên hệ"}
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" className="h-11 flex-1">
                  <a href={mapsUrl(fullAddress)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4" aria-hidden />
                    Dẫn đường
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {shipment.instructions && (
        <Alert variant="info">
          <Info aria-hidden />
          <div>
            <p className="font-semibold">Hướng dẫn cho chuyến này</p>
            <p className="mt-1 whitespace-pre-line">{shipment.instructions}</p>
          </div>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <Truck className="h-4 w-4" aria-hidden />
            Phương tiện và lịch
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {assignment?.vehicle && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Xe</dt>
                <dd className="font-mono font-bold text-navy">
                  {assignment.vehicle.plateNumber}
                </dd>
              </div>
            )}
            {assignment?.secondaryDriver && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tài xế phụ</dt>
                <dd className="font-medium text-navy">{assignment.secondaryDriver.fullName}</dd>
              </div>
            )}
            {shipment.scheduledPickupAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Lịch lấy hàng</dt>
                <dd className="text-right font-medium text-navy">
                  {formatDateTime(shipment.scheduledPickupAt)}
                </dd>
              </div>
            )}
            {shipment.estimatedDeliveryAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Dự kiến giao</dt>
                <dd className="text-right font-medium text-navy">
                  {formatDateTime(shipment.estimatedDeliveryAt)}
                </dd>
              </div>
            )}
          </dl>

          {/* Tài xế KHÔNG được xem giá trị đơn hay báo giá (§8: DRIVER không có quyền tài chính) */}
        </CardContent>
      </Card>

      {isActiveOnRoad(status) && (
        <Card>
          <CardContent className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
              <MapPin className="h-4 w-4" aria-hidden />
              Chia sẻ vị trí
            </h2>
            <div className="mt-3">
              <LocationSharing trackingCode={shipment.trackingCode} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <Camera className="h-4 w-4" aria-hidden />
            Hình ảnh chuyến hàng
          </h2>
          <p className="mt-1 text-xs text-muted">
            Chụp trước khi lấy, sau khi xếp và lúc giao. Ảnh là bằng chứng khi có tranh chấp.
          </p>

          <div className="mt-4">
            <MediaUpload
              trackingCode={shipment.trackingCode}
              defaultStage={suggestedStageFor(status)}
            />
          </div>

          {media.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <MediaGallery items={media} showVisibility />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-bold text-navy">Lịch sử chuyến</h2>
          <ol className="mt-3 flex flex-col gap-2.5">
            {shipment.statusEvents.map((event) => (
              <li key={event.id} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-navy">
                  {SHIPMENT_STATUS_LABELS[event.toStatus as ShipmentStatus]}
                </p>
                <time
                  dateTime={event.occurredAt.toISOString()}
                  className="text-xs text-muted"
                >
                  {formatDateTime(event.occurredAt)}
                </time>
                {event.note && (
                  <p className="mt-0.5 text-xs text-foreground/70">{event.note}</p>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
