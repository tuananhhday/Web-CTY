import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Phone, Mail, ReceiptText } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { getRequestAsStaff } from "@/modules/service-requests/service";
import { can } from "@/modules/auth/policy";
import type { RequestStatus } from "@/modules/service-requests/state-machine";
import { INVENTORY_CATEGORY_LABELS, PROPERTY_TYPE_LABELS } from "@/modules/service-requests/schema";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { StatusChangeForm } from "@/components/admin/status-change-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/datetime";
import { formatWeight } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/normalize";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Chi tiết yêu cầu" };

export default async function AdminRequestDetailPage({
  params,
}: PageProps<"/quan-tri/yeu-cau/[code]">) {
  const { code } = await params;
  const actor = await getActor();

  let request;
  try {
    request = await getRequestAsStaff(actor, code);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
      notFound();
    }
    throw error;
  }

  // Chỉ người có quyền `request.manage` được đổi trạng thái. ACCOUNTANT đọc được nhưng
  // không sửa (§8).
  const canManage = can(actor, "request.manage");

  const pickup = request.stops.find((s) => s.kind === "PICKUP");
  const dropoff = request.stops.find((s) => s.kind === "DELIVERY");

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/yeu-cau">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hộp thư yêu cầu
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-navy">{request.code}</h1>
        <RequestStatusBadge status={request.status} />
        <Badge variant="neutral">
          {request.kind === "MOVING" ? "Chuyển nhà" : "Vận chuyển hàng hóa"}
        </Badge>
        {!request.userId && <Badge variant="warning">Khách chưa có tài khoản</Badge>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Liên hệ — nhân viên xem số đầy đủ để gọi được */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Người liên hệ</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Họ tên</dt>
                  <dd className="font-medium text-navy">{request.contactName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Điện thoại</dt>
                  <dd className="font-medium text-navy">
                    <a
                      href={`tel:${request.contactPhoneNormalized}`}
                      className="inline-flex items-center gap-1.5 hover:text-orange-text"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {formatPhoneForDisplay(request.contactPhoneNormalized)}
                    </a>
                  </dd>
                </div>
                {request.contactEmail && (
                  <div>
                    <dt className="text-xs text-muted">Email</dt>
                    <dd className="font-medium text-navy">
                      <a
                        href={`mailto:${request.contactEmail}`}
                        className="inline-flex items-center gap-1.5 hover:text-orange-text"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        {request.contactEmail}
                      </a>
                    </dd>
                  </div>
                )}
                {request.companyName && (
                  <div>
                    <dt className="text-xs text-muted">Doanh nghiệp</dt>
                    <dd className="font-medium text-navy">{request.companyName}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Địa điểm và điều kiện tiếp cận */}
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
                          {(stop.floorNumber !== null ||
                            stop.hasElevator !== null ||
                            stop.carryDistanceM !== null) && (
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
            </CardContent>
          </Card>

          {request.cargoItems.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Hàng hóa</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {request.cargoItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                        <Package className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="font-medium text-navy">{item.cargoType}</p>
                        <p className="text-sm text-foreground/70">
                          {item.quantity} kiện · {formatWeight(Number(item.weightKg))}
                          {item.volumeM3 && ` · ${item.volumeM3.toString()} m³`}
                          {item.lengthCm &&
                            item.widthCm &&
                            item.heightCm &&
                            ` · ${item.lengthCm}×${item.widthCm}×${item.heightCm} cm`}
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

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  {request.needsLoading && <Badge variant="orange">Cần bốc xếp</Badge>}
                  {request.needsPacking && <Badge variant="orange">Cần đóng gói</Badge>}
                  {request.needsAssembly && <Badge variant="orange">Cần tháo lắp</Badge>}
                  {request.needsHoisting && <Badge variant="orange">Cần nâng hạ</Badge>}
                </div>
              </CardContent>
            </Card>
          )}

          {request.movingDetail && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-navy">Chi tiết chuyển nhà</h2>

                {request.movingDetail.requestsSiteSurvey && (
                  <Alert variant="warning" className="mt-3">
                    <MapPin aria-hidden />
                    <p>Khách yêu cầu khảo sát trực tiếp trước khi báo giá.</p>
                  </Alert>
                )}

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Loại hình</dt>
                    <dd className="font-medium text-navy">
                      {PROPERTY_TYPE_LABELS[
                        request.movingDetail.propertyType as keyof typeof PROPERTY_TYPE_LABELS
                      ] ?? request.movingDetail.propertyType}
                    </dd>
                  </div>
                  {request.movingDetail.preferredDate && (
                    <div>
                      <dt className="text-xs text-muted">Ngày mong muốn</dt>
                      <dd className="font-medium text-navy">
                        {formatDateTime(request.movingDetail.preferredDate)}
                      </dd>
                    </div>
                  )}
                </dl>

                {request.movingDetail.inventoryItems.length > 0 && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold text-navy">
                      Đồ đạc ({request.movingDetail.inventoryItems.length} dòng)
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
                          {item.needsDisassembly && <Badge variant="orange">Tháo lắp</Badge>}
                          {item.isFragile && <Badge variant="warning">Dễ vỡ</Badge>}
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
                <h2 className="text-base font-bold text-navy">Ghi chú của khách</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
                  {request.note}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {/* Lập báo giá — chỉ hiện khi yêu cầu còn ở giai đoạn xử lý được (§13.3). */}
          {can(actor, "quote.create") &&
            ["SUBMITTED", "UNDER_REVIEW", "NEED_MORE_INFO", "QUOTED", "NEGOTIATING"].includes(
              request.status
            ) && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <h2 className="text-base font-bold text-navy">Báo giá</h2>
                  <p className="text-sm text-foreground/70">
                    Lập báo giá dựa trên thông tin hàng hóa và điều kiện tiếp cận ở trên.
                  </p>
                  <Button asChild>
                    <Link href={`/quan-tri/bao-gia/moi?yeucau=${request.code}`}>
                      <ReceiptText className="h-4 w-4" aria-hidden />
                      Lập báo giá
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

          <Card>
            <CardContent className="p-6">
              {canManage ? (
                <StatusChangeForm code={request.code} currentStatus={request.status as RequestStatus} />
              ) : (
                <Alert variant="info">
                  <Package aria-hidden />
                  <p>
                    Vai trò của bạn xem được yêu cầu nhưng không được đổi trạng thái. Cần quyền
                    quản lý yêu cầu để thực hiện.
                  </p>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-navy">Lịch sử trạng thái</h2>
              <ol className="mt-4 flex flex-col gap-4">
                {[...request.statusEvents].reverse().map((event) => (
                  <li key={event.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.fromStatus && (
                        <>
                          <RequestStatusBadge status={event.fromStatus} />
                          <span aria-hidden className="text-muted">→</span>
                        </>
                      )}
                      <RequestStatusBadge status={event.toStatus} />
                    </div>
                    <time
                      dateTime={event.occurredAt.toISOString()}
                      className="mt-1.5 block text-xs text-muted"
                    >
                      {formatDateTime(event.occurredAt)}
                      {event.actorRole && ` · ${event.actorRole}`}
                    </time>
                    {event.reason && (
                      <p className="mt-1 text-sm text-foreground/70">{event.reason}</p>
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
