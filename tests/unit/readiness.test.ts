import { describe, expect, it, vi } from "vitest";

import {
  CHECK_TIMEOUT_MS,
  SLOW_THRESHOLD_MS,
  evaluateReadiness,
  statusToHttpCode,
  type ReadinessCheck,
} from "@/modules/health/readiness";

const instant = (name: string, required = true): ReadinessCheck => ({
  name,
  required,
  run: async () => {},
});

const failing = (name: string, required = true, error = new Error("nổ")): ReadinessCheck => ({
  name,
  required,
  run: async () => {
    throw error;
  },
});

/** Kiểm tra chậm giả lập bằng timer ảo. */
const slow = (name: string, ms: number, required = true): ReadinessCheck => ({
  name,
  required,
  run: () =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      // Tôn trọng abort để nhánh timeout kiểm thử được.
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("bị huỷ"));
      };
      setTimeout(() => onAbort(), CHECK_TIMEOUT_MS + 1);
    }),
});

describe("evaluateReadiness — tổng hợp trạng thái", () => {
  it("mọi thứ khoẻ thì báo ok", async () => {
    const report = await evaluateReadiness([instant("database"), instant("storage")]);
    expect(report.status).toBe("ok");
    expect(report.checks.map((c) => c.status)).toEqual(["ok", "ok"]);
  });

  it("phụ thuộc bắt buộc hỏng thì cả hệ thống down", async () => {
    const report = await evaluateReadiness([failing("database", true), instant("storage")]);
    expect(report.status).toBe("down");
  });

  it("phụ thuộc phụ trợ hỏng chỉ làm suy giảm, không rút khỏi cân bằng tải", async () => {
    const report = await evaluateReadiness([instant("database"), failing("email", false)]);
    expect(report.status).toBe("degraded");
  });

  it("danh sách rỗng coi như ok, không treo", async () => {
    const report = await evaluateReadiness([]);
    expect(report.status).toBe("ok");
    expect(report.checks).toEqual([]);
  });

  it("một phép kiểm tra hỏng không chặn các phép còn lại chạy", async () => {
    const report = await evaluateReadiness([
      failing("database"),
      instant("storage"),
      instant("queue"),
    ]);
    expect(report.checks).toHaveLength(3);
    expect(report.checks.find((c) => c.name === "storage")?.status).toBe("ok");
  });
});

describe("evaluateReadiness — không rò rỉ thông tin nội bộ", () => {
  it("không đưa nội dung lỗi vào kết quả", async () => {
    const leaky = new Error(
      "Can't reach database server at db-prod-01.internal:5432 (user vantai_app)"
    );
    const report = await evaluateReadiness([failing("database", true, leaky)]);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("db-prod-01");
    expect(serialized).not.toContain("5432");
    expect(serialized).not.toContain("vantai_app");
  });

  it("chỉ trả về đúng ba khoá cho mỗi phép kiểm tra", async () => {
    const report = await evaluateReadiness([failing("database")]);
    expect(Object.keys(report.checks[0]).sort()).toEqual(["durationMs", "name", "status"]);
  });
});

describe("evaluateReadiness — thời gian", () => {
  it("đánh dấu degraded khi phụ thuộc trả lời chậm bất thường", async () => {
    vi.useFakeTimers();
    try {
      const promise = evaluateReadiness([slow("database", SLOW_THRESHOLD_MS + 200)]);
      await vi.advanceTimersByTimeAsync(SLOW_THRESHOLD_MS + 200);
      const report = await promise;
      expect(report.checks[0].status).toBe("degraded");
      expect(report.status).toBe("degraded");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cắt phép kiểm tra treo thay vì chờ vô hạn", async () => {
    vi.useFakeTimers();
    try {
      const promise = evaluateReadiness([slow("database", CHECK_TIMEOUT_MS * 10)]);
      await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS + 10);
      const report = await promise;
      expect(report.checks[0].status).toBe("down");
      expect(report.status).toBe("down");
    } finally {
      vi.useRealTimers();
    }
  });

  it("chạy song song, không cộng dồn thời gian từng phép", async () => {
    vi.useFakeTimers();
    try {
      const promise = evaluateReadiness([
        slow("a", 500),
        slow("b", 500),
        slow("c", 500),
      ]);
      await vi.advanceTimersByTimeAsync(600);
      const report = await promise;
      // Tuần tự sẽ mất 1500ms.
      expect(report.durationMs).toBeLessThan(1000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("statusToHttpCode", () => {
  it("chỉ down mới trả 503 để bộ điều phối rút node", () => {
    expect(statusToHttpCode("down")).toBe(503);
  });

  it("degraded vẫn trả 200 — database chậm còn hơn không node nào phục vụ", () => {
    expect(statusToHttpCode("degraded")).toBe(200);
  });

  it("ok trả 200", () => {
    expect(statusToHttpCode("ok")).toBe(200);
  });
});
