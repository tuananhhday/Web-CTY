import { MapPin, MapPinOff, ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import type { LocationView } from "@/modules/locations/service";

/**
 * Vị trí chuyến (§17).
 *
 * KHÔNG nhúng bản đồ. §17 yêu cầu map provider phải có phương án văn bản và trang tracking
 * không được hỏng khi API bản đồ lỗi — cách chắc chắn nhất là không phụ thuộc vào nó: hiển
 * thị toạ độ dạng văn bản kèm liên kết mở app bản đồ sẵn có trên máy.
 *
 * Ngôn từ nói đúng bản chất: đây là vị trí XE, không phải GPS gắn trên từng kiện hàng (§17).
 */

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  SHARING_DISABLED:
    "Chuyến này chưa bật chia sẻ vị trí. Liên hệ tổng đài nếu bạn cần biết xe đang ở đâu.",
  NOT_ACTIVE: "Vị trí chỉ hiển thị khi chuyến đang trên đường.",
  NO_DATA: "Chưa nhận được vị trí nào từ xe.",
};

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function ShipmentLocation({ view }: { view: LocationView }) {
  if (!view.available) {
    return (
      <Alert variant="info">
        <MapPinOff aria-hidden />
        <p>{UNAVAILABLE_MESSAGES[view.reason] ?? "Chưa có dữ liệu vị trí."}</p>
      </Alert>
    );
  }

  const latest = view.points[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-navy/[0.03] p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange/10 text-orange-text">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">Vị trí xe gần nhất</p>
          <p className="mt-0.5 font-mono text-sm text-foreground/80">
            {latest.latitude.toFixed(view.coarse ? 3 : 5)},{" "}
            {latest.longitude.toFixed(view.coarse ? 3 : 5)}
          </p>
          <time
            dateTime={latest.recordedAt.toISOString()}
            className="mt-1 block text-xs text-muted"
          >
            {formatRelative(latest.recordedAt)} · {formatDateTime(latest.recordedAt)}
          </time>

          <a
            href={mapsUrl(latest.latitude, latest.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-orange-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
          >
            Mở trên bản đồ
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>

      <p className="text-xs text-muted">
        Đây là vị trí của <strong>xe đang chở hàng</strong>, không phải thiết bị định vị gắn
        trên từng kiện hàng.
        {view.coarse && " Toạ độ hiển thị ở mức khu vực, sai số khoảng 100m."}
      </p>
    </div>
  );
}
