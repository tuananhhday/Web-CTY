import { describe, expect, it } from "vitest";

import {
  SCHEDULES,
  initialJitterMs,
  shouldRun,
  type JobSchedule,
  type JobState,
} from "@/modules/scheduler/schedule";

const every60s: JobSchedule = {
  name: "outbox",
  intervalSeconds: 60,
  description: "test",
};

const idle = (lastRunAt: Date | null = null): JobState => ({ lastRunAt, running: false });

const at = (iso: string) => new Date(iso);

describe("shouldRun", () => {
  it("chạy ngay lần đầu, chưa cần chờ hết chu kỳ", () => {
    expect(shouldRun(every60s, idle(null), at("2026-08-13T10:00:00Z"))).toBe(true);
  });

  it("không chạy khi chưa hết chu kỳ", () => {
    const state = idle(at("2026-08-13T10:00:00Z"));
    expect(shouldRun(every60s, state, at("2026-08-13T10:00:59Z"))).toBe(false);
  });

  it("chạy đúng thời điểm tròn chu kỳ", () => {
    const state = idle(at("2026-08-13T10:00:00Z"));
    expect(shouldRun(every60s, state, at("2026-08-13T10:01:00Z"))).toBe(true);
  });

  it("chạy khi đã quá hạn", () => {
    const state = idle(at("2026-08-13T10:00:00Z"));
    expect(shouldRun(every60s, state, at("2026-08-13T10:05:00Z"))).toBe(true);
  });
});

describe("shouldRun — chống chạy chồng", () => {
  it("KHÔNG chạy khi lượt trước còn dở, dù đã quá hạn từ lâu", () => {
    // Tình huống thật: database chậm, một lượt outbox mất hơn một chu kỳ.
    const state: JobState = { lastRunAt: at("2026-08-13T10:00:00Z"), running: true };
    expect(shouldRun(every60s, state, at("2026-08-13T10:10:00Z"))).toBe(false);
  });

  it("KHÔNG chạy khi lượt đầu tiên còn dở", () => {
    const state: JobState = { lastRunAt: null, running: true };
    expect(shouldRun(every60s, state, at("2026-08-13T10:00:00Z"))).toBe(false);
  });

  it("chạy lại ngay sau khi lượt trước kết thúc quá hạn", () => {
    const state: JobState = { lastRunAt: at("2026-08-13T10:00:00Z"), running: false };
    expect(shouldRun(every60s, state, at("2026-08-13T10:03:00Z"))).toBe(true);
  });
});

describe("shouldRun — bỏ lượt chứ không dồn hàng đợi", () => {
  it("tiến trình treo 10 phút thì tỉnh dậy chỉ chạy một lượt", () => {
    // `shouldRun` trả về boolean chứ không phải số lượt cần bù, nên bản chất là bỏ lượt.
    const state = idle(at("2026-08-13T10:00:00Z"));
    const now = at("2026-08-13T10:10:00Z");
    expect(shouldRun(every60s, state, now)).toBe(true);

    // Sau khi chạy xong, lượt kế tiếp lại phải chờ đủ một chu kỳ.
    const after = idle(now);
    expect(shouldRun(every60s, after, now)).toBe(false);
  });
});

describe("initialJitterMs", () => {
  it("luôn nằm trong khoảng cho phép", () => {
    for (const schedule of SCHEDULES) {
      for (let i = 0; i < 200; i += 1) {
        const jitter = initialJitterMs(schedule);
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThanOrEqual(30_000);
      }
    }
  });

  it("không vượt quá chính chu kỳ với job chạy dày", () => {
    const short: JobSchedule = { name: "outbox", intervalSeconds: 5, description: "" };
    expect(initialJitterMs(short, () => 0.999)).toBeLessThan(5_000);
  });

  it("chặn trần 30 giây với job chu kỳ dài, để không trễ lần chạy đầu hàng giờ", () => {
    const long: JobSchedule = {
      name: "cleanup-media",
      intervalSeconds: 6 * 60 * 60,
      description: "",
    };
    expect(initialJitterMs(long, () => 0.999)).toBeLessThan(30_000);
  });

  it("trả 0 ở biên dưới", () => {
    expect(initialJitterMs(every60s, () => 0)).toBe(0);
  });
});

describe("SCHEDULES", () => {
  it("tên job không trùng nhau", () => {
    const names = SCHEDULES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("mọi chu kỳ đều dương", () => {
    for (const s of SCHEDULES) {
      expect(s.intervalSeconds).toBeGreaterThan(0);
    }
  });

  it("outbox chạy dày nhất vì khách đang chờ thông báo", () => {
    const outbox = SCHEDULES.find((s) => s.name === "outbox");
    const others = SCHEDULES.filter((s) => s.name !== "outbox");
    for (const other of others) {
      expect(outbox!.intervalSeconds).toBeLessThan(other.intervalSeconds);
    }
  });

  it("mọi job đều có mô tả cho tài liệu vận hành", () => {
    for (const s of SCHEDULES) {
      expect(s.description.length).toBeGreaterThan(10);
    }
  });
});
