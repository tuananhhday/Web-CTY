import { timingSafeEqual } from "node:crypto";
import { withErrorHandling, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";
import { runOutboxOnce } from "@/modules/notifications/worker";

/**
 * POST /api/internal/outbox/run — chạy một lượt worker outbox (§21).
 *
 * Endpoint nội bộ dành cho bộ lập lịch bên ngoài (cron của hệ điều hành, Vercel Cron,
 * hoặc `curl` thủ công khi phát triển). KHÔNG dùng phiên đăng nhập: cron không có người
 * ngồi sau, nên xác thực bằng khoá chia sẻ trong header.
 *
 * Dùng `BETTER_AUTH_SECRET` làm khoá thay vì thêm biến môi trường mới. Nếu sau này cần tách
 * quyền cho hệ thống giám sát riêng thì thêm `INTERNAL_API_KEY` — hiện chưa cần.
 */

function isAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-internal-key");
  if (!provided) return false;

  const expected = serverEnv().BETTER_AUTH_SECRET;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export const POST = withErrorHandling(async (request, context) => {
  if (!isAuthorized(request)) {
    // Không phân biệt thiếu khoá với sai khoá.
    throw appError("FORBIDDEN", "Không có quyền gọi endpoint nội bộ.");
  }

  const result = await runOutboxOnce();

  context.logger.info(result, "Chạy outbox theo yêu cầu");

  return jsonOk(result);
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
