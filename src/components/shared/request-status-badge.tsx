import { Badge } from "@/components/ui/badge";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONE,
  type RequestStatus,
} from "@/modules/service-requests/state-machine";

/**
 * Badge trạng thái yêu cầu.
 *
 * Trạng thái không chỉ được truyền tải bằng màu sắc — nhãn chữ luôn hiển thị đầy đủ,
 * đúng yêu cầu §29 (không dùng màu làm tín hiệu duy nhất).
 */
export function RequestStatusBadge({ status }: { status: string }) {
  const typed = status as RequestStatus;
  const label = REQUEST_STATUS_LABELS[typed] ?? status;
  const tone = REQUEST_STATUS_TONE[typed] ?? "neutral";

  return <Badge variant={tone}>{label}</Badge>;
}
