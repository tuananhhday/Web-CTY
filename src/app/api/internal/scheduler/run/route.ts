import { timingSafeEqual } from "node:crypto";
import { withErrorHandling, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";
import { runDueJobs, runJobOnce } from "@/modules/scheduler/runner";
import { SCHEDULES, type JobName } from "@/modules/scheduler/schedule";

/**
 * POST /api/internal/scheduler/run — chạy các job định kỳ đã đến hạn (§25).
 *
 * Dành cho bộ lập lịch BÊN NGOÀI, khi `SCHEDULER_ENABLED=false`: cron của hệ điều hành,
 * Vercel Cron, Kubernetes CronJob. Cần thiết khi chạy nhiều instance hoặc trên nền
 * serverless, nơi bộ lập lịch trong tiến trình không dùng được.
 *
 * Không dùng phiên đăng nhập — cron không có người ngồi sau. Xác thực bằng khoá chia sẻ
 * trong header, giống `POST /api/internal/outbox/run`.
 *
 * Body tuỳ chọn: `{"job": "outbox"}` để ép chạy đúng một job, bỏ qua kiểm tra đến hạn.
 * Hữu ích khi cần khác chu kỳ cho từng job — ví dụ cron gọi `outbox` mỗi phút nhưng
 * `cleanup-media` mỗi đêm.
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

const JOB_NAMES = new Set<string>(SCHEDULES.map((s) => s.name));

export const POST = withErrorHandling(async (request, context) => {
  if (!isAuthorized(request)) {
    // Không phân biệt thiếu khoá với sai khoá.
    throw appError("FORBIDDEN", "Không có quyền gọi endpoint nội bộ.");
  }

  // Body rỗng là hợp lệ — cron thường POST không kèm nội dung.
  const body = (await request.json().catch(() => ({}))) as { job?: unknown };

  if (body.job !== undefined) {
    if (typeof body.job !== "string" || !JOB_NAMES.has(body.job)) {
      throw appError(
        "VALIDATION_ERROR",
        `Tên job không hợp lệ. Chọn một trong: ${[...JOB_NAMES].join(", ")}.`
      );
    }

    await runJobOnce(body.job as JobName);
    context.logger.info({ job: body.job }, "Chạy job theo yêu cầu");
    return jsonOk({ ran: [body.job] });
  }

  const ran = await runDueJobs();
  context.logger.info({ ran }, "Chạy job đến hạn");

  return jsonOk({ ran });
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
