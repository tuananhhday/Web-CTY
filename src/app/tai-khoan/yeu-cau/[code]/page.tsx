import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Info } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getMyRequest } from "@/modules/service-requests/service";
import { REQUEST_STATUS_HINTS, type RequestStatus } from "@/modules/service-requests/state-machine";
import { INVENTORY_CATEGORY_LABELS, PROPERTY_TYPE_LABELS } from "@/modules/service-requests/schema";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/datetime";
import { formatWeight } from "@/lib/format";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Chi tiết yêu cầu",
  robots: { index: false, follow: false },
};

export default async function RequestDetailPage({
  params,
}: PageProps<"/tai-khoan/yeu-cau/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  // getMyRequest lọc theo userId ngay trong truy vấn; yêu cầu của người khác trả NOT_FOUND.
  let request;
  try {
    request = await getMyRequest(actor, code);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const pickup = request.stops.find((s) => s.kind === "PICKUP");
  const dropoff = request.stops.find((s) => s.kind === "DELIVERY");
  const statusHint = REQUEST_STATUS_HINTS[request.status as RequestStatus];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/tai-khoan/yeu-cau">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tất cả yêu cầu
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{request.code}</h1>
        <RequestStatusBadge status={request.status} />
        <Badge variant="neutral">
          {request.kind === "MOVING" ? "Chuyển nhà" : "Vận chuyển hàng hóa"}
        </Badge>
      </header>

      {statusHint && (
        <Alert variant="info">
          <Info aria-hidden />
          <p>{statusHint}</p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Địa điểm */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Địa điểm</h2>
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
                          {(stop.floorNumber !== null || stop.carryDistanceM !== null) && (
                            <p className="mt-1 text-xs text-muted">
                              {stop.floorNumber !== null && `Tầng ${stop.floorNumber}`}
                              {stop.hasElevator !== null &&
                                ` · ${stop.hasElevator ? "có" : "không có"} thang máy`}
                              {stop.carryDistanceM !== null && ` · bê ${stop.carryDistanceM}m`}
                            </p>
                          )}
                          {stop.accessNote && (
                            <p className="mt-1 text-xs text-foreground/60">{stop.accessNote}</p>
                          )}
                        </div>
                      </div>
                    )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hàng hóa hoặc đồ đạc */}
          {request.cargoItems.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Hàng hóa</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {request.cargoItems.map((item) => (
                    <li key={item.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                        <Package className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="font-medium text-navy">{item.cargoType}</p>
                        <p className="text-sm text-foreground/70">
                          {item.quantity} kiện · {formatWeight(Number(item.weightKg))}
                          {item.volumeM3 && ` · ${item.volumeM3.toString()} m³`}
                        </p>
                        {(item.isFragile || item.isValuable) && (
                          <div className="mt-1.5 flex gap-1.5">
                            {item.isFragile && <Badge variant="warning">Dễ vỡ</Badge>}
                            {item.isValuable && <Badge variant="warning">Giá trị cao</Badge>}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {request.movingDetail && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Chi tiết chuyển nhà</h2>
                <p className="mt-2 text-sm text-foreground/70">
                  Loại hình:{" "}
                  {PROPERTY_TYPE_LABELS[
                    request.movingDetail.propertyType as keyof typeof PROPERTY_TYPE_LABELS
                  ] ?? request.movingDetail.propertyType}
                </p>

                {request.movingDetail.requestsSiteSurvey && (
                  <Badge variant="orange" className="mt-3">
                    Đã yêu cầu khảo sát trực tiếp
                  </Badge>
                )}

                {request.movingDetail.inventoryItems.length > 0 && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold text-navy">
                      Danh sách đồ đạc ({request.movingDetail.inventoryItems.length} dòng)
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                      {request.movingDetail.inventoryItems.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-2">
                          <span className="text-foreground/80">
                            {item.name} × {item.quantity}
                          </span>
                          <Badge variant="neutral">
                            {INVENTORY_CATEGORY_LABELS[
                              item.category as keyof typeof INVENTORY_CATEGORY_LABELS
                            ] ?? item.category}
                          </Badge>
                          {item.addedByStaff && <Badge variant="orange">Nhân viên bổ sung</Badge>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {request.note && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Ghi chú của bạn</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
                  {request.note}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Timeline trạng thái */}
        <aside>
          <Card className="lg:sticky lg:top-24">
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Tiến trình xử lý</h2>

              <ol className="mt-5 flex flex-col gap-0">
                {request.statusEvents.map((event, index) => {
                  const isLast = index === request.statusEvents.length - 1;
                  return (
                    <li key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`h-3 w-3 shrink-0 rounded-full ${isLast ? "bg-orange" : "bg-navy/25"}`}
                          aria-hidden
                        />
                        {!isLast && <span className="w-px flex-1 bg-border" aria-hidden />}
                      </div>
                      <div className={isLast ? "pb-0" : "pb-5"}>
                        <RequestStatusBadge status={event.toStatus} />
                        <time
                          dateTime={event.occurredAt.toISOString()}
                          className="mt-1.5 block text-xs text-muted"
                        >
                          {formatDateTime(event.occurredAt)}
                        </time>
                        {event.reason && (
                          <p className="mt-1 text-sm text-foreground/70">{event.reason}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs text-muted">Gửi lúc</p>
                <p className="text-sm text-foreground/80">
                  {formatDateTime(request.submittedAt ?? request.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
