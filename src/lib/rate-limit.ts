import "server-only";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Giới hạn tần suất cho endpoint public (§30.1).
 *
 * Adapter `memory` đếm trong bộ nhớ tiến trình. Điều này CHỈ đúng khi chạy một instance —
 * nhiều instance sau load balancer thì mỗi instance đếm riêng, giới hạn thực tế bị nhân lên.
 * Trước khi lên production nhiều instance phải chuyển `RATE_LIMIT_DRIVER=redis`.
 *
 * Đây là lớp phòng thủ bổ sung, không thay thế CAPTCHA hay xác thực.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Số lượt còn lại trong cửa sổ hiện tại. */
  remaining: number;
  /** Thời điểm cửa sổ hiện tại kết thúc. */
  resetAt: Date;
  /** Số giây client nên chờ trước khi thử lại. */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Độ dài cửa sổ, tính bằng giây. */
  windowSeconds: number;
  /** Số lượt tối đa trong một cửa sổ. */
  max: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

const store = new Map<string, Counter>();

/**
 * Dọn bản ghi hết hạn. Gọi ngẫu nhiên ~1% số lần để Map không phình vô hạn mà không
 * cần chạy timer nền.
 */
function maybeSweep(now: number) {
  if (Math.random() > 0.01) return;
  for (const [key, counter] of store) {
    if (counter.resetAt <= now) store.delete(key);
  }
}

function checkMemory(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: rule.max - 1,
      resetAt: new Date(resetAt),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= rule.max;

  return {
    allowed,
    remaining: Math.max(0, rule.max - existing.count),
    resetAt: new Date(existing.resetAt),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Kiểm tra và tiêu thụ một lượt.
 *
 * @param key khoá định danh, thường gồm tên hành động và IP hoặc userId
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const driver = serverEnv().RATE_LIMIT_DRIVER;

  if (driver === "redis") {
    // Chưa triển khai. Báo lỗi rõ ràng thay vì im lặng bỏ qua giới hạn — im lặng ở đây
    // đồng nghĩa với tắt hoàn toàn lớp bảo vệ mà không ai biết.
    throw new Error(
      "RATE_LIMIT_DRIVER=redis nhưng adapter Redis chưa được triển khai. " +
        "Đặt RATE_LIMIT_DRIVER=memory cho development."
    );
  }

  return checkMemory(key, rule);
}

/** Các mức giới hạn dùng trong dự án, khai báo tập trung để dễ rà soát. */
export const RATE_LIMITS = {
  /** Gửi yêu cầu báo giá từ trang public. */
  submitRequest: { windowSeconds: 3600, max: 5 },
  /** Gửi form liên hệ. */
  submitContact: { windowSeconds: 3600, max: 5 },
  /** Tra cứu vận đơn công khai — chống dò mã (§16.1). */
  publicTracking: { windowSeconds: 300, max: 10 },
  /** Yêu cầu upload file. */
  uploadIntent: { windowSeconds: 600, max: 30 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Lấy IP client. Chỉ tin header proxy khi ứng dụng thực sự chạy sau proxy tin cậy —
 * nếu không, kẻ tấn công tự đặt `X-Forwarded-For` để vượt giới hạn.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Phần tử đầu tiên là client gốc; các phần sau là chuỗi proxy.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * Bẫy bot: trường ẩn mà người dùng thật không nhìn thấy nên không bao giờ điền (§23).
 * Bot điền tự động mọi input sẽ lộ ra ở đây.
 */
export function isHoneypotTriggered(value: unknown): boolean {
  const triggered = typeof value === "string" && value.trim().length > 0;
  if (triggered) {
    logger.warn("Honeypot bị kích hoạt — nhiều khả năng là bot");
  }
  return triggered;
}
