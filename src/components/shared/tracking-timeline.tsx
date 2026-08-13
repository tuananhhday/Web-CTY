import { Check, Circle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/datetime";

/**
 * Timeline tra cứu công khai (§16.1).
 *
 * Chỉ nhận đúng dữ liệu đã được `toPublicView` che bớt. Component không tự lấy thêm gì —
 * muốn hiện thông tin mới thì phải mở ở tầng masking trước, nên không thể vô tình rò rỉ.
 */

export interface PublicTrackingResult {
  trackingCode: string;
  statusLabel: string;
  hasException: boolean;
  stops: { kind: string; province: string }[];
  milestones: { key: string; label: string; reached: boolean; occurredAt: string | null }[];
  estimatedDeliveryDate: string | null;
  lastUpdatedAt: string;
}

const STOP_LABELS: Record<string, string> = {
  PICKUP: "Khu vực lấy hàng",
  DELIVERY: "Khu vực giao hàng",
  WAYPOINT: "Điểm dừng",
};

export function TrackingTimeline({ view }: { view: PublicTrackingResult }) {
  const reachedCount = view.milestones.filter((m) => m.reached).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-navy/[0.03] p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Mã vận đơn</p>
          <p className="font-mono text-lg font-bold text-navy">{view.trackingCode}</p>
        </div>
        <Badge variant={view.hasException ? "warning" : "orange"}>{view.statusLabel}</Badge>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {view.stops.map((stop, index) => (
          <div key={`${stop.kind}-${index}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {STOP_LABELS[stop.kind] ?? "Điểm dừng"}
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 font-medium text-navy">
              <MapPin className="h-3.5 w-3.5 text-muted" aria-hidden />
              {stop.province}
            </dd>
          </div>
        ))}

        {view.estimatedDeliveryDate && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Dự kiến giao
            </dt>
            <dd className="mt-1 font-medium text-navy">
              {formatDate(new Date(view.estimatedDeliveryDate))}
            </dd>
          </div>
        )}
      </dl>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Tiến trình ({reachedCount}/{view.milestones.length})
        </p>

        <ol className="relative flex flex-col gap-0 border-l-2 border-border pl-6">
          {view.milestones.map((milestone) => (
            <li key={milestone.key} className="relative pb-5 last:pb-0">
              <span
                className={
                  milestone.reached
                    ? "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white"
                    : "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-muted ring-2 ring-border"
                }
                aria-hidden
              >
                {milestone.reached ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" />
                )}
              </span>

              <p
                className={
                  milestone.reached
                    ? "text-sm font-semibold text-navy"
                    : "text-sm font-medium text-muted"
                }
              >
                {milestone.label}
                <span className="sr-only">
                  {milestone.reached ? " — đã hoàn thành" : " — chưa tới"}
                </span>
              </p>

              {milestone.occurredAt && (
                <time
                  dateTime={milestone.occurredAt}
                  className="mt-0.5 block text-xs text-muted"
                >
                  {formatDateTime(new Date(milestone.occurredAt))}
                </time>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="border-t border-border pt-3 text-xs text-muted">
        Cập nhật lần cuối {formatDateTime(new Date(view.lastUpdatedAt))}
      </p>
    </div>
  );
}
