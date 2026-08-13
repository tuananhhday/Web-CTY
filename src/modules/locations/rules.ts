/**
 * Luật nhận và lọc điểm vị trí (§17).
 *
 * Module thuần, không chạm database.
 *
 * NGUYÊN TẮC: không tin tuyệt đối timestamp và toạ độ do thiết bị gửi. Điện thoại có thể
 * sai giờ, mất sóng rồi gửi dồn, hoặc bị giả lập vị trí. Server phải tự quyết định điểm nào
 * đáng ghi.
 */

export interface PingCandidate {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  speedKph?: number | null;
  heading?: number | null;
  /** Thời điểm thiết bị ghi nhận, theo đồng hồ của thiết bị. */
  recordedAt: Date;
}

export interface PingContext {
  /** Điểm gần nhất đã ghi cho chuyến này, nếu có. */
  previous?: { latitude: number; longitude: number; recordedAt: Date } | null;
  /** Thời điểm server nhận. Dùng làm mốc đối chiếu thay cho đồng hồ thiết bị. */
  receivedAt: Date;
}

export type PingDecision =
  | { accept: true }
  | { accept: false; reason: PingRejectReason; message: string };

export type PingRejectReason =
  | "OUT_OF_BOUNDS"
  | "TOO_OLD"
  | "FUTURE_TIMESTAMP"
  | "OUT_OF_ORDER"
  | "TOO_INACCURATE"
  | "IMPOSSIBLE_SPEED"
  | "TOO_FREQUENT";

/**
 * Điểm cũ hơn mốc này bị bỏ.
 *
 * Thiết bị mất sóng rồi gửi dồn là chuyện bình thường, nên cửa sổ đủ rộng để không mất dữ
 * liệu thật; nhưng điểm của hôm qua thì không còn giá trị theo dõi.
 */
const MAX_AGE_MINUTES = 60;

/** Đồng hồ thiết bị chạy nhanh vài giây là bình thường; vài phút thì không đáng tin. */
const MAX_CLOCK_SKEW_MINUTES = 2;

/** Sai số lớn hơn mức này thì điểm vô dụng cho việc theo dõi, chỉ tốn chỗ lưu. */
const MAX_ACCURACY_M = 500;

/**
 * Tốc độ tối đa coi là hợp lý cho xe tải trên đường Việt Nam.
 *
 * Vượt ngưỡng này nghĩa là toạ độ nhảy — thường do định vị lỗi trong hầm, giữa nhà cao
 * tầng, hoặc do giả lập vị trí. Ghi vào sẽ vẽ ra hành trình sai lệch.
 */
const MAX_SPEED_KPH = 150;

/** Khoảng cách tối thiểu giữa hai lần ghi khi xe đứng yên. Tiết kiệm pin và database (§17). */
export const MIN_INTERVAL_SECONDS = 20;

const MESSAGES: Record<PingRejectReason, string> = {
  OUT_OF_BOUNDS: "Toạ độ nằm ngoài phạm vi hợp lệ.",
  TOO_OLD: "Điểm vị trí quá cũ.",
  FUTURE_TIMESTAMP: "Thời điểm ghi nhận nằm ở tương lai.",
  OUT_OF_ORDER: "Điểm vị trí cũ hơn điểm đã ghi trước đó.",
  TOO_INACCURATE: "Sai số định vị quá lớn.",
  IMPOSSIBLE_SPEED: "Khoảng dịch chuyển không hợp lý so với thời gian.",
  TOO_FREQUENT: "Gửi quá dày, bỏ qua để tiết kiệm pin và dung lượng.",
};

function reject(reason: PingRejectReason): PingDecision {
  return { accept: false, reason, message: MESSAGES[reason] };
}

/** Khoảng cách hai điểm theo công thức haversine, đơn vị mét. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    // (0,0) nằm giữa Đại Tây Dương — giá trị mặc định khi thiết bị chưa có định vị.
    !(latitude === 0 && longitude === 0)
  );
}

/**
 * Quyết định có ghi điểm này hay không.
 *
 * Thứ tự kiểm tra đi từ rẻ tới đắt: kiểm tra toạ độ và thời gian trước, tính khoảng cách
 * sau cùng.
 */
export function evaluatePing(ping: PingCandidate, context: PingContext): PingDecision {
  if (!isValidCoordinate(ping.latitude, ping.longitude)) {
    return reject("OUT_OF_BOUNDS");
  }

  const ageMs = context.receivedAt.getTime() - ping.recordedAt.getTime();

  if (ageMs < -MAX_CLOCK_SKEW_MINUTES * 60_000) {
    return reject("FUTURE_TIMESTAMP");
  }

  if (ageMs > MAX_AGE_MINUTES * 60_000) {
    return reject("TOO_OLD");
  }

  if (ping.accuracyM != null && ping.accuracyM > MAX_ACCURACY_M) {
    return reject("TOO_INACCURATE");
  }

  const previous = context.previous;
  if (!previous) return { accept: true };

  const elapsedMs = ping.recordedAt.getTime() - previous.recordedAt.getTime();

  if (elapsedMs < 0) {
    return reject("OUT_OF_ORDER");
  }

  if (elapsedMs < MIN_INTERVAL_SECONDS * 1000) {
    return reject("TOO_FREQUENT");
  }

  const meters = distanceMeters(previous, ping);
  const impliedKph = meters / 1000 / (elapsedMs / 3_600_000);

  if (impliedKph > MAX_SPEED_KPH) {
    return reject("IMPOSSIBLE_SPEED");
  }

  return { accept: true };
}

/**
 * Làm tròn toạ độ trước khi cho khách hàng xem.
 *
 * Khách cần biết xe đang ở khoảng nào, không cần biết chính xác tới từng mét — đó là dữ
 * liệu vị trí của một con người đang làm việc (§17, §31). Ba chữ số thập phân tương ứng
 * khoảng 100m, đủ để thấy xe đang ở đâu trên bản đồ.
 */
export function coarsen(latitude: number, longitude: number): { latitude: number; longitude: number } {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { latitude: round(latitude), longitude: round(longitude) };
}
