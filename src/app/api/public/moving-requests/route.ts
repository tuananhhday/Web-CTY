import {
  withErrorHandling,
  parseJsonBody,
  enforceRateLimit,
  jsonOk,
} from "@/lib/api";
import { RATE_LIMITS, isHoneypotTriggered } from "@/lib/rate-limit";
import { getActor } from "@/modules/auth/session";
import { movingRequestSchema } from "@/modules/service-requests/schema";
import { createMovingRequest } from "@/modules/service-requests/service";

/**
 * POST /api/public/moving-requests — tiếp nhận yêu cầu chuyển nhà, chuyển văn phòng (§12).
 *
 * Khác với yêu cầu vận chuyển thông thường ở chỗ có danh sách đồ đạc CÓ CẤU TRÚC và
 * thông tin điều kiện tiếp cận ở cả hai đầu.
 */
export const POST = withErrorHandling(async (request, context) => {
  await enforceRateLimit("submit-request", context.ipAddress, RATE_LIMITS.submitRequest);

  const input = await parseJsonBody(request, movingRequestSchema);

  if (isHoneypotTriggered(input.website)) {
    context.logger.warn({ ip: context.ipAddress }, "Chặn yêu cầu chuyển nhà do honeypot");
    return jsonOk({ code: "YCXXXXXXXX" }, { status: 201 });
  }

  const actor = await getActor();

  const result = await createMovingRequest(actor, input, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
  });

  return jsonOk(result, { status: 201 });
});
