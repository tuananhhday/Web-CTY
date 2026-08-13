import { withErrorHandling, parseJsonBody, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { getActor } from "@/modules/auth/session";
import { locationBatchSchema } from "@/modules/locations/schema";
import { ingestLocationBatch } from "@/modules/locations/service";

/**
 * POST /api/driver/locations — nhận lô điểm vị trí từ thiết bị tài xế (§17, §25).
 *
 * Nhận theo LÔ chứ không từng điểm: tiết kiệm pin, chịu được vùng mất sóng, giảm số lần
 * chạm database. Điểm không hợp lệ bị loại riêng lẻ và báo lại, không làm hỏng cả lô.
 *
 * Không đặt rate limit theo IP: tài xế ngoài đường dùng chung IP nhà mạng. Tần suất đã bị
 * chặn bằng luật `MIN_INTERVAL_SECONDS` trong `locations/rules.ts`, áp theo từng chuyến.
 */
export const POST = withErrorHandling(async (request, context) => {
  const actor = await getActor();
  const input = await parseJsonBody(request, locationBatchSchema);

  const result = await ingestLocationBatch(actor, input);

  context.logger.debug(
    { trackingCode: input.trackingCode, accepted: result.accepted },
    "Nhận vị trí từ tài xế"
  );

  return jsonOk(result);
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
