import { describe, it, expect } from "vitest";
import {
  evaluatePing,
  distanceMeters,
  isValidCoordinate,
  coarsen,
  MIN_INTERVAL_SECONDS,
  type PingCandidate,
} from "@/modules/locations/rules";

/**
 * §17: không tin tuyệt đối timestamp và toạ độ do thiết bị gửi. Test này chứng minh server
 * tự loại được điểm sai thay vì ghi bừa rồi vẽ ra hành trình không có thật.
 */

const NOW = new Date("2026-09-01T10:00:00Z");

/** Hai điểm ở TP.HCM, cách nhau khoảng 1,1km. */
const HCM = { latitude: 10.7769, longitude: 106.7009 };
const HCM_NEAR = { latitude: 10.7869, longitude: 106.7009 };

function ping(overrides: Partial<PingCandidate> = {}): PingCandidate {
  return { ...HCM, recordedAt: new Date(NOW.getTime() - 5_000), ...overrides };
}

describe("isValidCoordinate", () => {
  it("chấp nhận toạ độ Việt Nam", () => {
    expect(isValidCoordinate(10.7769, 106.7009)).toBe(true);
    expect(isValidCoordinate(21.0285, 105.8542)).toBe(true);
  });

  it("từ chối toạ độ ngoài biên", () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
  });

  it("từ chối (0,0) — giá trị mặc định khi thiết bị chưa định vị được", () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it("từ chối NaN và Infinity", () => {
    expect(isValidCoordinate(NaN, 106)).toBe(false);
    expect(isValidCoordinate(10, Infinity)).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("hai điểm trùng nhau cách 0m", () => {
    expect(distanceMeters(HCM, HCM)).toBeCloseTo(0, 5);
  });

  it("tính đúng khoảng cách ngắn", () => {
    // 0.01 độ vĩ ≈ 1,11km
    expect(distanceMeters(HCM, HCM_NEAR)).toBeGreaterThan(1000);
    expect(distanceMeters(HCM, HCM_NEAR)).toBeLessThan(1200);
  });

  it("đối xứng", () => {
    expect(distanceMeters(HCM, HCM_NEAR)).toBeCloseTo(distanceMeters(HCM_NEAR, HCM), 6);
  });
});

describe("evaluatePing — điểm đầu tiên", () => {
  it("chấp nhận điểm hợp lệ khi chưa có điểm trước", () => {
    expect(evaluatePing(ping(), { receivedAt: NOW, previous: null })).toEqual({ accept: true });
  });

  it("từ chối toạ độ ngoài biên", () => {
    const result = evaluatePing(ping({ latitude: 999 }), { receivedAt: NOW, previous: null });
    expect(result).toMatchObject({ accept: false, reason: "OUT_OF_BOUNDS" });
  });

  it("từ chối điểm quá cũ", () => {
    const old = ping({ recordedAt: new Date(NOW.getTime() - 2 * 3_600_000) });
    expect(evaluatePing(old, { receivedAt: NOW, previous: null })).toMatchObject({
      reason: "TOO_OLD",
    });
  });

  it("chấp nhận điểm cũ vừa phải — thiết bị mất sóng rồi gửi dồn", () => {
    const delayed = ping({ recordedAt: new Date(NOW.getTime() - 30 * 60_000) });
    expect(evaluatePing(delayed, { receivedAt: NOW, previous: null }).accept).toBe(true);
  });

  it("từ chối timestamp ở tương lai xa", () => {
    const future = ping({ recordedAt: new Date(NOW.getTime() + 10 * 60_000) });
    expect(evaluatePing(future, { receivedAt: NOW, previous: null })).toMatchObject({
      reason: "FUTURE_TIMESTAMP",
    });
  });

  it("bỏ qua lệch đồng hồ vài giây — chuyện bình thường của thiết bị", () => {
    const slightlyAhead = ping({ recordedAt: new Date(NOW.getTime() + 30_000) });
    expect(evaluatePing(slightlyAhead, { receivedAt: NOW, previous: null }).accept).toBe(true);
  });

  it("từ chối khi sai số định vị quá lớn", () => {
    expect(
      evaluatePing(ping({ accuracyM: 5000 }), { receivedAt: NOW, previous: null })
    ).toMatchObject({ reason: "TOO_INACCURATE" });
  });

  it("chấp nhận sai số bình thường của điện thoại", () => {
    expect(evaluatePing(ping({ accuracyM: 20 }), { receivedAt: NOW, previous: null }).accept).toBe(
      true
    );
  });
});

describe("evaluatePing — so với điểm trước", () => {
  const previous = {
    ...HCM,
    recordedAt: new Date(NOW.getTime() - 120_000),
  };

  it("chấp nhận di chuyển hợp lý", () => {
    const next = ping({ ...HCM_NEAR, recordedAt: new Date(NOW.getTime() - 5_000) });
    expect(evaluatePing(next, { receivedAt: NOW, previous }).accept).toBe(true);
  });

  it("từ chối điểm cũ hơn điểm đã ghi", () => {
    const older = ping({ recordedAt: new Date(previous.recordedAt.getTime() - 60_000) });
    expect(evaluatePing(older, { receivedAt: NOW, previous })).toMatchObject({
      reason: "OUT_OF_ORDER",
    });
  });

  it("từ chối điểm gửi quá dày", () => {
    const tooSoon = ping({
      recordedAt: new Date(previous.recordedAt.getTime() + (MIN_INTERVAL_SECONDS - 5) * 1000),
    });
    expect(evaluatePing(tooSoon, { receivedAt: NOW, previous })).toMatchObject({
      reason: "TOO_FREQUENT",
    });
  });

  it("từ chối bước nhảy toạ độ vô lý", () => {
    // Từ TP.HCM ra Hà Nội trong 2 phút.
    const teleport = ping({
      latitude: 21.0285,
      longitude: 105.8542,
      recordedAt: new Date(NOW.getTime() - 5_000),
    });
    expect(evaluatePing(teleport, { receivedAt: NOW, previous })).toMatchObject({
      reason: "IMPOSSIBLE_SPEED",
    });
  });

  it("chấp nhận tốc độ cao tốc bình thường", () => {
    // ~1,1km trong 60 giây ≈ 66 km/h
    const fast = ping({
      ...HCM_NEAR,
      recordedAt: new Date(previous.recordedAt.getTime() + 60_000),
    });
    expect(evaluatePing(fast, { receivedAt: NOW, previous }).accept).toBe(true);
  });

  it("xe đứng yên vẫn ghi được nếu đủ giãn cách", () => {
    const idle = ping({
      ...HCM,
      recordedAt: new Date(previous.recordedAt.getTime() + 60_000),
    });
    expect(evaluatePing(idle, { receivedAt: NOW, previous }).accept).toBe(true);
  });

  it("mọi lý do từ chối đều có thông báo tiếng Việt", () => {
    const rejected = evaluatePing(ping({ latitude: 999 }), { receivedAt: NOW, previous: null });
    expect(rejected.accept).toBe(false);
    if (!rejected.accept) expect(rejected.message.length).toBeGreaterThan(10);
  });
});

describe("coarsen", () => {
  it("làm tròn về khoảng 100m", () => {
    const result = coarsen(10.776912345, 106.700987654);
    expect(result.latitude).toBe(10.777);
    expect(result.longitude).toBe(106.701);
  });

  it("làm mất độ chính xác so với toạ độ gốc", () => {
    const raw = { latitude: 10.7769123, longitude: 106.7009876 };
    const coarse = coarsen(raw.latitude, raw.longitude);
    expect(coarse.latitude).not.toBe(raw.latitude);
  });

  it("sai lệch sau khi làm thô không quá ~100m", () => {
    const raw = { latitude: 10.7769123, longitude: 106.7009876 };
    const coarse = coarsen(raw.latitude, raw.longitude);
    expect(distanceMeters(raw, coarse)).toBeLessThan(100);
  });
});
