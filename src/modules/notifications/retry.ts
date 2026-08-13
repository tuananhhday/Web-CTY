/**
 * Chính sách thử lại cho outbox worker (§21).
 *
 * Module thuần, không chạm database — kiểm thử được toàn bộ quy tắc mà không cần hạ tầng.
 *
 * Bốn yêu cầu của §21 được mã hoá ở đây:
 *   1. Exponential backoff — thử lại dồn dập chỉ làm provider đang quá tải càng nặng.
 *   2. Có jitter — nhiều sự kiện lỗi cùng lúc sẽ retry cùng lúc nếu không phá vỡ nhịp.
 *   3. Dead-letter khi hết lượt — im lặng bỏ qua là mất thông báo mà không ai biết.
 *   4. Phân biệt lỗi tạm thời với lỗi vĩnh viễn — gửi lại email sai định dạng 5 lần thì
 *      cũng sai 5 lần, chỉ tốn thời gian và che khuất lỗi thật.
 */

export type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "DEAD_LETTER";

/** Giãn cách cơ sở. Lần thử n chờ khoảng BASE * 2^(n-1). */
const BASE_DELAY_SECONDS = 30;

/** Trần giãn cách: 1 giờ. Chờ lâu hơn thì thông báo mất hết giá trị thời sự. */
const MAX_DELAY_SECONDS = 3600;

/** Biên độ ngẫu nhiên ±20% để nhiều sự kiện lỗi cùng lúc không retry đồng loạt. */
const JITTER_RATIO = 0.2;

/**
 * Giãn cách trước lần thử kế tiếp, tính bằng giây.
 *
 * @param attempts số lần đã thử (bao gồm lần vừa thất bại)
 * @param random nguồn ngẫu nhiên; truyền vào để test có kết quả xác định
 */
export function backoffSeconds(attempts: number, random: () => number = Math.random): number {
  const exponential = BASE_DELAY_SECONDS * 2 ** Math.max(0, attempts - 1);
  const capped = Math.min(exponential, MAX_DELAY_SECONDS);

  // random() ∈ [0,1) → hệ số ∈ [0.8, 1.2)
  const jitter = 1 + (random() * 2 - 1) * JITTER_RATIO;

  return Math.max(1, Math.round(capped * jitter));
}

/**
 * Lỗi vĩnh viễn: thử lại bao nhiêu lần cũng vậy.
 *
 * Danh sách là ALLOWLIST của những gì chắc chắn không tự khỏi. Mọi lỗi khác mặc định coi là
 * tạm thời — thà thử lại thừa vài lần còn hơn vứt bỏ một thông báo đáng lẽ gửi được.
 */
export type FailureKind = "TRANSIENT" | "PERMANENT";

const PERMANENT_PATTERNS = [
  /invalid[_\s-]?(email|phone|recipient|address)/i,
  /không hợp lệ/i,
  /unsubscrib/i,
  /không tìm thấy người nhận/i,
  /template.*(không tồn tại|not found)/i,
  /unsupported[_\s-]?event/i,
];

export function classifyFailure(error: unknown): FailureKind {
  const message = error instanceof Error ? error.message : String(error);
  return PERMANENT_PATTERNS.some((pattern) => pattern.test(message)) ? "PERMANENT" : "TRANSIENT";
}

export interface RetryDecision {
  status: OutboxStatus;
  nextRetryAt: Date | null;
  /** Ghi vào `lastError` để người vận hành đọc được vì sao. */
  reason: string;
}

/**
 * Quyết định làm gì sau một lần xử lý thất bại.
 *
 * `DEAD_LETTER` nghĩa là ngừng thử và chờ người can thiệp — khác với `FAILED` vốn còn lượt.
 */
export function decideRetry(input: {
  attempts: number;
  maxAttempts: number;
  error: unknown;
  now?: Date;
  random?: () => number;
}): RetryDecision {
  const now = input.now ?? new Date();
  const message = input.error instanceof Error ? input.error.message : String(input.error);

  if (classifyFailure(input.error) === "PERMANENT") {
    return {
      status: "DEAD_LETTER",
      nextRetryAt: null,
      reason: `Lỗi không thể khắc phục bằng cách thử lại: ${message}`,
    };
  }

  if (input.attempts >= input.maxAttempts) {
    return {
      status: "DEAD_LETTER",
      nextRetryAt: null,
      reason: `Đã thử ${input.attempts}/${input.maxAttempts} lần, lần cuối: ${message}`,
    };
  }

  const delay = backoffSeconds(input.attempts, input.random);

  return {
    status: "FAILED",
    nextRetryAt: new Date(now.getTime() + delay * 1000),
    reason: `Thử lại sau ${delay}s (lần ${input.attempts}/${input.maxAttempts}): ${message}`,
  };
}

/** Sự kiện đến hạn xử lý: chưa từng thử, hoặc đã tới lượt thử lại. */
export function isDue(
  event: { status: OutboxStatus; nextRetryAt: Date | null },
  now: Date = new Date()
): boolean {
  if (event.status === "PENDING") return true;
  if (event.status !== "FAILED") return false;
  return event.nextRetryAt === null || event.nextRetryAt.getTime() <= now.getTime();
}
