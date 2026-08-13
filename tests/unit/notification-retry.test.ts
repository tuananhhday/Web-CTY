import { describe, it, expect } from "vitest";
import {
  backoffSeconds,
  classifyFailure,
  decideRetry,
  isDue,
} from "@/modules/notifications/retry";

/** Bốn yêu cầu của §21: backoff, jitter, dead-letter, phân biệt lỗi tạm và lỗi vĩnh viễn. */

const NOW = new Date("2026-09-01T10:00:00Z");

/** Nguồn ngẫu nhiên cố định để kết quả test xác định. */
const noJitter = () => 0.5;

describe("backoffSeconds", () => {
  it("tăng theo cấp số nhân", () => {
    const delays = [1, 2, 3, 4].map((n) => backoffSeconds(n, noJitter));
    expect(delays).toEqual([30, 60, 120, 240]);
  });

  it("có trần, không chờ vô hạn", () => {
    expect(backoffSeconds(20, noJitter)).toBe(3600);
    expect(backoffSeconds(100, noJitter)).toBe(3600);
  });

  it("luôn chờ ít nhất 1 giây", () => {
    expect(backoffSeconds(0, () => 0)).toBeGreaterThanOrEqual(1);
  });

  it("có jitter — hai lần gọi cùng tham số không luôn cho cùng kết quả", () => {
    const low = backoffSeconds(3, () => 0);
    const high = backoffSeconds(3, () => 0.999);
    expect(low).toBeLessThan(high);
  });

  it("jitter nằm trong ±20%", () => {
    const base = 120;
    expect(backoffSeconds(3, () => 0)).toBeCloseTo(base * 0.8, 0);
    expect(backoffSeconds(3, () => 1)).toBeCloseTo(base * 1.2, 0);
  });
});

describe("classifyFailure", () => {
  it.each([
    "invalid email address",
    "Số điện thoại không hợp lệ",
    "recipient unsubscribed",
    "Template không tồn tại",
  ])("coi %s là lỗi vĩnh viễn", (message) => {
    expect(classifyFailure(new Error(message))).toBe("PERMANENT");
  });

  it.each([
    "ECONNRESET",
    "503 Service Unavailable",
    "timeout of 5000ms exceeded",
    "rate limited by provider",
  ])("coi %s là lỗi tạm thời", (message) => {
    expect(classifyFailure(new Error(message))).toBe("TRANSIENT");
  });

  it("lỗi lạ mặc định là tạm thời — thà thử lại thừa còn hơn vứt thông báo", () => {
    expect(classifyFailure(new Error("chuyện gì đó lạ lắm"))).toBe("TRANSIENT");
    expect(classifyFailure("chuỗi thô")).toBe("TRANSIENT");
    expect(classifyFailure(null)).toBe("TRANSIENT");
  });
});

describe("decideRetry", () => {
  it("còn lượt thì hẹn thử lại", () => {
    const decision = decideRetry({
      attempts: 2,
      maxAttempts: 5,
      error: new Error("ECONNRESET"),
      now: NOW,
      random: noJitter,
    });

    expect(decision.status).toBe("FAILED");
    expect(decision.nextRetryAt).not.toBeNull();
    expect(decision.nextRetryAt!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("hết lượt thì chuyển dead-letter", () => {
    const decision = decideRetry({
      attempts: 5,
      maxAttempts: 5,
      error: new Error("ECONNRESET"),
      now: NOW,
    });

    expect(decision.status).toBe("DEAD_LETTER");
    expect(decision.nextRetryAt).toBeNull();
  });

  it("lỗi vĩnh viễn thì dead-letter ngay lần đầu, không phí 5 lần thử", () => {
    const decision = decideRetry({
      attempts: 1,
      maxAttempts: 5,
      error: new Error("invalid email"),
      now: NOW,
    });

    expect(decision.status).toBe("DEAD_LETTER");
  });

  it("lý do luôn nêu được nguyên nhân gốc để người vận hành đọc", () => {
    const decision = decideRetry({
      attempts: 1,
      maxAttempts: 5,
      error: new Error("provider tạm thời quá tải"),
      now: NOW,
    });

    expect(decision.reason).toContain("provider tạm thời quá tải");
  });

  it("lý do khi hết lượt cho biết đã thử bao nhiêu lần", () => {
    const decision = decideRetry({
      attempts: 5,
      maxAttempts: 5,
      error: new Error("timeout"),
      now: NOW,
    });

    expect(decision.reason).toMatch(/5\/5/);
  });
});

describe("isDue", () => {
  it("sự kiện mới luôn đến hạn", () => {
    expect(isDue({ status: "PENDING", nextRetryAt: null }, NOW)).toBe(true);
  });

  it("sự kiện đã gửi thì không xử lý lại", () => {
    expect(isDue({ status: "SENT", nextRetryAt: null }, NOW)).toBe(false);
  });

  it("dead-letter thì không tự chạy lại", () => {
    expect(isDue({ status: "DEAD_LETTER", nextRetryAt: null }, NOW)).toBe(false);
  });

  it("đang xử lý thì không nhận lại", () => {
    expect(isDue({ status: "PROCESSING", nextRetryAt: null }, NOW)).toBe(false);
  });

  it("chưa tới hẹn thì chờ", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(isDue({ status: "FAILED", nextRetryAt: future }, NOW)).toBe(false);
  });

  it("tới hẹn thì chạy", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(isDue({ status: "FAILED", nextRetryAt: past }, NOW)).toBe(true);
  });
});
