import { hasOverlap } from "@/lib/datetime";

/**
 * Phát hiện xung đột lịch xe và tài xế (§14.3).
 *
 * Module thuần, kiểm thử được độc lập.
 *
 * ĐÂY LÀ LỚP THỨ HAI trong ba lớp bảo vệ chống double-booking:
 *
 *   1. Giao diện  — hiển thị cảnh báo trước khi bấm (tiện dụng, KHÔNG phải bảo vệ)
 *   2. Ứng dụng   — module này, cho thông báo lỗi rõ ràng và gợi ý phương án
 *   3. Database   — exclusion constraint `btree_gist` trong migration đầu, chặn tuyệt đối
 *
 * Lớp 3 mới là thứ đảm bảo tính đúng đắn. Hai lớp trên tồn tại để người dùng nhận được
 * thông báo dễ hiểu thay vì lỗi ràng buộc thô của PostgreSQL.
 */

export interface TimeWindow {
  effectiveFrom: Date;
  effectiveTo: Date;
}

export interface ExistingAssignment extends TimeWindow {
  id: string;
  shipmentId: string;
  shipmentTrackingCode?: string;
  vehicleId: string | null;
  primaryDriverId: string | null;
  secondaryDriverId: string | null;
  isActive: boolean;
  overrideConflict: boolean;
}

export interface AvailabilityWindow extends TimeWindow {
  id: string;
  kind: string;
  reason: string | null;
  vehicleId: string | null;
  driverProfileId: string | null;
}

export type ConflictKind = "VEHICLE_BUSY" | "DRIVER_BUSY" | "VEHICLE_BLOCKED" | "DRIVER_BLOCKED";

export interface Conflict {
  kind: ConflictKind;
  message: string;
  /** Mã đơn hàng đang chiếm chỗ, nếu xung đột do phân công khác. */
  conflictingShipmentCode?: string;
  window: TimeWindow;
}

export interface ConflictCheckInput {
  /** Khoảng thời gian định phân công. */
  window: TimeWindow;
  vehicleId: string | null;
  primaryDriverId: string | null;
  secondaryDriverId: string | null;
  /** Phân công đang tồn tại của xe và tài xế liên quan. */
  existingAssignments: ExistingAssignment[];
  /** Lịch bận: bảo trì xe, nghỉ phép tài xế. */
  availabilityBlocks: AvailabilityWindow[];
  /** Bỏ qua chính bản ghi này khi đang sửa một phân công có sẵn. */
  excludeAssignmentId?: string;
  /**
   * Bỏ qua mọi phân công của chuyến này.
   *
   * Đổi tài xế hay nới khung giờ cho một chuyến đã phân công thì phân công cũ của chính
   * nó không phải là xung đột — nó sắp bị gỡ. Không loại trừ thì dispatcher bị buộc tick
   * "bỏ qua cảnh báo" cho một xung đột không có thật, và nhật ký ghi nhận một lần override
   * sai sự thật (§14.3).
   */
  excludeShipmentId?: string;
}

const BLOCK_KIND_LABELS: Record<string, string> = {
  MAINTENANCE: "bảo trì",
  LEAVE: "nghỉ phép",
  RESERVED: "đã giữ chỗ",
  OTHER: "bận",
};

function formatWindow(window: TimeWindow): string {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return `${formatter.format(window.effectiveFrom)} – ${formatter.format(window.effectiveTo)}`;
}

/**
 * Tìm mọi xung đột. Trả về DANH SÁCH chứ không dừng ở cái đầu tiên — dispatcher cần
 * thấy hết vấn đề trong một lần thay vì sửa xong lại gặp lỗi tiếp.
 */
export function findConflicts(input: ConflictCheckInput): Conflict[] {
  const conflicts: Conflict[] = [];
  const { window } = input;

  // --- Phân công khác đang chiếm xe hoặc tài xế ---
  for (const existing of input.existingAssignments) {
    if (existing.id === input.excludeAssignmentId) continue;
    if (input.excludeShipmentId && existing.shipmentId === input.excludeShipmentId) continue;

    // Phân công đã gỡ không còn chiếm chỗ.
    if (!existing.isActive) continue;

    if (!hasOverlap({ start: window.effectiveFrom, end: window.effectiveTo }, { start: existing.effectiveFrom, end: existing.effectiveTo })) {
      continue;
    }

    if (input.vehicleId && existing.vehicleId === input.vehicleId) {
      conflicts.push({
        kind: "VEHICLE_BUSY",
        message: `Xe đã được phân công cho đơn ${existing.shipmentTrackingCode ?? existing.shipmentId} trong khoảng ${formatWindow(existing)}.`,
        conflictingShipmentCode: existing.shipmentTrackingCode,
        window: existing,
      });
    }

    // Tài xế bận nếu trùng ở bất kỳ vị trí nào: chính hoặc phụ, ở cả hai phía.
    const requestedDrivers = [input.primaryDriverId, input.secondaryDriverId].filter(Boolean);
    const existingDrivers = [existing.primaryDriverId, existing.secondaryDriverId].filter(Boolean);
    const clashing = requestedDrivers.find((driver) => existingDrivers.includes(driver));

    if (clashing) {
      conflicts.push({
        kind: "DRIVER_BUSY",
        message: `Tài xế đã được phân công cho đơn ${existing.shipmentTrackingCode ?? existing.shipmentId} trong khoảng ${formatWindow(existing)}.`,
        conflictingShipmentCode: existing.shipmentTrackingCode,
        window: existing,
      });
    }
  }

  // --- Lịch bận: bảo trì xe, nghỉ phép tài xế ---
  for (const block of input.availabilityBlocks) {
    if (!hasOverlap({ start: window.effectiveFrom, end: window.effectiveTo }, { start: block.effectiveFrom, end: block.effectiveTo })) {
      continue;
    }

    const kindLabel = BLOCK_KIND_LABELS[block.kind] ?? "bận";
    const detail = block.reason ? ` (${block.reason})` : "";

    if (input.vehicleId && block.vehicleId === input.vehicleId) {
      conflicts.push({
        kind: "VEHICLE_BLOCKED",
        message: `Xe đang ${kindLabel} trong khoảng ${formatWindow(block)}${detail}.`,
        window: block,
      });
    }

    const requestedDrivers = [input.primaryDriverId, input.secondaryDriverId].filter(Boolean);
    if (block.driverProfileId && requestedDrivers.includes(block.driverProfileId)) {
      conflicts.push({
        kind: "DRIVER_BLOCKED",
        message: `Tài xế đang ${kindLabel} trong khoảng ${formatWindow(block)}${detail}.`,
        window: block,
      });
    }
  }

  return conflicts;
}

/**
 * Xung đột do lịch bận (bảo trì, nghỉ phép) KHÔNG cho override — đó là ràng buộc vật lý
 * chứ không phải vấn đề sắp xếp. Chỉ xung đột do trùng phân công mới override được, và
 * phải có lý do kèm AuditLog (§14.3).
 */
export function canOverride(conflicts: Conflict[]): boolean {
  if (conflicts.length === 0) return true;
  return conflicts.every((c) => c.kind === "VEHICLE_BUSY" || c.kind === "DRIVER_BUSY");
}

/** Gộp thông báo để hiển thị trong một alert. */
export function summarizeConflicts(conflicts: Conflict[]): string {
  if (conflicts.length === 0) return "";
  if (conflicts.length === 1) return conflicts[0].message;
  return `Phát hiện ${conflicts.length} xung đột lịch:\n${conflicts.map((c) => `• ${c.message}`).join("\n")}`;
}

/**
 * Nhận diện lỗi vi phạm exclusion constraint của PostgreSQL để đổi thành thông báo
 * tiếng Việt. Mã 23P01 là `exclusion_violation`.
 *
 * Trường hợp này xảy ra khi hai dispatcher bấm gán cùng lúc: cả hai đều qua được kiểm tra
 * ở tầng ứng dụng, nhưng database chỉ chấp nhận một.
 */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code = (error as { code?: unknown }).code;
  if (code === "23P01" || code === "P2010") {
    return true;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes("exclusion constraint");
}
