import { Badge } from "@/components/ui/badge";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
  type QuoteStatus,
} from "@/modules/quotes/state-machine";

/** Badge trạng thái báo giá. Nhãn chữ luôn hiển thị, không chỉ dựa vào màu (§29). */
export function QuoteStatusBadge({ status }: { status: string }) {
  const typed = status as QuoteStatus;
  return <Badge variant={QUOTE_STATUS_TONE[typed] ?? "neutral"}>{QUOTE_STATUS_LABELS[typed] ?? status}</Badge>;
}
