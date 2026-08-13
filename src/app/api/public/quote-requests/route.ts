import {
  withErrorHandling,
  parseJsonBody,
  enforceRateLimit,
  jsonOk,
} from "@/lib/api";
import { appError } from "@/lib/errors";
import { RATE_LIMITS, isHoneypotTriggered } from "@/lib/rate-limit";
import { getActor } from "@/modules/auth/session";
import { freightRequestSchema } from "@/modules/service-requests/schema";
import { createFreightRequest } from "@/modules/service-requests/service";

/**
 * POST /api/public/quote-requests — tiếp nhận yêu cầu báo giá vận chuyển (§25).
 *
 * Khách chưa đăng nhập gửi được; hệ thống trả về mã yêu cầu kèm token theo dõi.
 * Khách đã đăng nhập thì yêu cầu tự gắn vào tài khoản.
 */
export const POST = withErrorHandling(async (request, context) => {
  await enforceRateLimit("submit-request", context.ipAddress, RATE_LIMITS.submitRequest);

  const input = await parseJsonBody(request, freightRequestSchema);

  // Bot điền vào trường ẩn. Trả về như thành công để không tiết lộ cơ chế phát hiện,
  // nhưng không tạo bản ghi nào.
  if (isHoneypotTriggered(input.website)) {
    context.logger.warn({ ip: context.ipAddress }, "Chặn yêu cầu do honeypot");
    return jsonOk({ code: "YCXXXXXXXX" }, { status: 201 });
  }

  const actor = await getActor();

  const result = await createFreightRequest(actor, input, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
  });

  return jsonOk(result, { status: 201 });
});

/** Chỉ nhận POST; các phương thức khác trả 405 rõ ràng thay vì 404 gây nhầm lẫn. */
export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
