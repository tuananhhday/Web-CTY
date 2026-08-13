import { appError } from "@/lib/errors";

/**
 * Vòng đời sự cố (§19).
 *
 * Module thuần, không chạm database.
 *
 * Khác với phiếu hỗ trợ (khách khởi tạo, trạng thái suy ra từ hội thoại), sự cố do NGƯỜI
 * VẬN HÀNH điều khiển: tài xế báo, điều phối điều tra và kết luận. Khách hàng không tham
 * gia vào vòng đời này, chỉ được thông báo khi chuyến bị ảnh hưởng.
 */

export const INCIDENT_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "ACTION_REQUIRED",
  "RESOLVED",
  "CLOSED",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Mới báo",
  INVESTIGATING: "Đang xác minh",
  ACTION_REQUIRED: "Cần xử lý",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
};

export const INCIDENT_STATUS_TONE: Record<
  IncidentStatus,
  "neutral" | "orange" | "success" | "warning" | "error"
> = {
  OPEN: "error",
  INVESTIGATING: "warning",
  ACTION_REQUIRED: "error",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const INCIDENT_TYPES = [
  "DELAY",
  "VEHICLE_BREAKDOWN",
  "ACCIDENT",
  "DAMAGE",
  "LOSS",
  "ACCESS_ISSUE",
  "CUSTOMER_UNAVAILABLE",
  "OTHER",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  DELAY: "Chậm trễ",
  VEHICLE_BREAKDOWN: "Xe hỏng",
  ACCIDENT: "Tai nạn",
  DAMAGE: "Hư hỏng hàng",
  LOSS: "Mất hàng",
  ACCESS_ISSUE: "Không tiếp cận được địa điểm",
  CUSTOMER_UNAVAILABLE: "Không liên hệ được khách",
  OTHER: "Khác",
};

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: "Nhẹ",
  MEDIUM: "Trung bình",
  HIGH: "Nghiêm trọng",
  CRITICAL: "Rất nghiêm trọng",
};

/**
 * Mức độ mặc định theo loại sự cố.
 *
 * Tai nạn và mất hàng luôn ở mức cao nhất bất kể người báo đánh giá thế nào: đây là loại
 * việc không được phép chìm trong hàng chờ. Điều phối hạ mức xuống sau khi xác minh thì
 * được, nhưng phải là quyết định có ý thức.
 */
export function defaultSeverityFor(type: IncidentType): IncidentSeverity {
  const MAP: Record<IncidentType, IncidentSeverity> = {
    ACCIDENT: "CRITICAL",
    LOSS: "CRITICAL",
    DAMAGE: "HIGH",
    VEHICLE_BREAKDOWN: "HIGH",
    DELAY: "MEDIUM",
    ACCESS_ISSUE: "MEDIUM",
    CUSTOMER_UNAVAILABLE: "MEDIUM",
    OTHER: "MEDIUM",
  };
  return MAP[type];
}

/** Sự cố còn đang mở — dùng để đếm việc cần xử lý và chặn đóng đơn hàng. */
export function isIncidentOpen(status: IncidentStatus): boolean {
  return status !== "RESOLVED" && status !== "CLOSED";
}

interface Transition {
  to: IncidentStatus;
  /** Kết luận bắt buộc khi khép lại sự cố — không cho đóng mà không giải thích. */
  requiresResolution?: boolean;
}

const TRANSITIONS: Record<IncidentStatus, Transition[]> = {
  OPEN: [{ to: "INVESTIGATING" }, { to: "ACTION_REQUIRED" }, { to: "RESOLVED", requiresResolution: true }],

  INVESTIGATING: [
    { to: "ACTION_REQUIRED" },
    { to: "RESOLVED", requiresResolution: true },
  ],

  ACTION_REQUIRED: [
    { to: "INVESTIGATING" },
    { to: "RESOLVED", requiresResolution: true },
  ],

  RESOLVED: [
    // Mở lại khi phát hiện chưa xử lý xong — thà mở lại còn hơn tạo sự cố trùng.
    { to: "ACTION_REQUIRED" },
    { to: "CLOSED" },
  ],

  CLOSED: [],
};

export function allowedIncidentTransitions(status: IncidentStatus): readonly Transition[] {
  return TRANSITIONS[status];
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransitionIncident(
  from: IncidentStatus,
  to: IncidentStatus,
  options: { resolution?: string | null } = {}
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Trạng thái mới trùng với trạng thái hiện tại." };
  }

  const transition = TRANSITIONS[from].find((candidate) => candidate.to === to);
  if (!transition) {
    return { allowed: false, reason: "Không thể chuyển sự cố sang trạng thái này." };
  }

  if (transition.requiresResolution && !options.resolution?.trim()) {
    return {
      allowed: false,
      reason: "Đánh dấu đã xử lý bắt buộc ghi rõ cách xử lý.",
    };
  }

  return { allowed: true };
}

export function assertIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  options: { resolution?: string | null } = {}
): void {
  const result = canTransitionIncident(from, to, options);
  if (!result.allowed) {
    throw appError("INVALID_STATE_TRANSITION", result.reason);
  }
}

/**
 * Sự cố có nên tự động tạm dừng chuyến hàng không.
 *
 * Tai nạn và mất hàng thì dừng ngay; chậm trễ hay không liên hệ được khách thì không —
 * chuyến vẫn đang chạy và tự dừng sẽ làm hỏng dữ liệu vận hành.
 */
export function shouldHoldShipment(type: IncidentType, severity: IncidentSeverity): boolean {
  if (severity === "CRITICAL") return true;
  return type === "ACCIDENT" || type === "LOSS";
}
