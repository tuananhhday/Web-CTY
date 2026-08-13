/**
 * Điểm khởi động sớm của Next.js (§25).
 *
 * `register()` chạy một lần cho mỗi tiến trình máy chủ, trước khi phục vụ request đầu tiên.
 * Đây là chỗ duy nhất trong App Router chạy được mã lúc khởi động mà không cần một request
 * kích hoạt.
 */

export async function register(): Promise<void> {
  /*
   * Chặn theo runtime là bắt buộc, không phải cho chắc.
   *
   * File này cũng được nạp trong runtime Edge (middleware). Ở đó không có `setInterval`
   * dài hạn, không có Prisma, và import các module server sẽ vỡ lúc build. Chỉ chạy khi
   * đang ở runtime Node.js.
   */
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Import động: giữ mã máy chủ ra khỏi bundle Edge.
  const { serverEnv } = await import("@/lib/env");
  const { logger } = await import("@/lib/logger");

  if (!serverEnv().SCHEDULER_ENABLED) {
    logger.info(
      "SCHEDULER_ENABLED=false — job định kỳ không tự chạy. " +
        "Gọi POST /api/internal/scheduler/run từ cron bên ngoài, xem docs/operations-runbook.md"
    );
    return;
  }

  // `startScheduler` tự đăng ký luôn việc dừng gọn khi nhận SIGTERM/SIGINT.
  const { startScheduler } = await import("@/modules/scheduler/runner");
  startScheduler();
}
