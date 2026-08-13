import { appError } from "@/lib/errors";
import type { Actor, AuthenticatedActor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import type { Permission, StoredRole } from "@/modules/auth/permissions";
import { HIGH_PRIVILEGE_ROLES, REAUTH_REQUIRED_PERMISSIONS } from "@/modules/auth/permissions";

/**
 * Policy dùng chung (§8, §30.2).
 *
 * Hai lớp kiểm tra tách bạch:
 *   1. Permission — vai trò này về nguyên tắc được làm gì.
 *   2. Ownership / assignment — bản ghi cụ thể này có thuộc về họ không.
 *
 * Có quyền `shipment.read_all` thì bỏ qua lớp 2. Không có thì bắt buộc qua lớp 2.
 * Deny by default: mọi hàm mặc định trả về false / ném lỗi.
 *
 * QUAN TRỌNG: các hàm `can*` chỉ trả lời câu hỏi phân quyền. Chúng KHÔNG thay thế việc
 * lọc theo owner ngay trong câu truy vấn database. Query phải luôn kèm điều kiện
 * `userId = actor.userId` khi người dùng không có quyền `*_all` (§30.2).
 */

// -----------------------------------------------------------------------------
// Kiểm tra cơ bản
// -----------------------------------------------------------------------------

export function can(actor: Actor, permission: Permission): boolean {
  return actor.permissions.has(permission);
}

export function canAll(actor: Actor, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => actor.permissions.has(permission));
}

export function canAny(actor: Actor, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => actor.permissions.has(permission));
}

// -----------------------------------------------------------------------------
// Hàm assert — ném AppError để route handler map thành HTTP status
// -----------------------------------------------------------------------------

/** @throws UNAUTHENTICATED nếu chưa đăng nhập. */
export function requireAuth(actor: Actor): AuthenticatedActor {
  if (!isAuthenticated(actor)) {
    throw appError("UNAUTHENTICATED");
  }
  return actor;
}

/** @throws UNAUTHENTICATED hoặc FORBIDDEN. */
export function requirePermission(actor: Actor, permission: Permission): AuthenticatedActor {
  const user = requireAuth(actor);
  if (!user.permissions.has(permission)) {
    throw appError("FORBIDDEN");
  }
  return user;
}

export function requireAnyPermission(
  actor: Actor,
  permissions: readonly Permission[]
): AuthenticatedActor {
  const user = requireAuth(actor);
  if (!canAny(user, permissions)) {
    throw appError("FORBIDDEN");
  }
  return user;
}

export function requireRole(actor: Actor, role: StoredRole): AuthenticatedActor {
  const user = requireAuth(actor);
  if (!user.roles.includes(role)) {
    throw appError("FORBIDDEN");
  }
  return user;
}

/**
 * Thao tác nhạy cảm cần xác thực gần đây (§30.2).
 * Mặc định coi phiên xác thực quá 15 phút là cần đăng nhập lại.
 */
const REAUTH_WINDOW_MS = 15 * 60 * 1000;

export function requireFreshAuth(
  actor: Actor,
  permission: Permission,
  now: Date = new Date()
): AuthenticatedActor {
  const user = requirePermission(actor, permission);

  if (!REAUTH_REQUIRED_PERMISSIONS.includes(permission)) {
    return user;
  }

  const elapsed = now.getTime() - user.authenticatedAt.getTime();
  if (elapsed > REAUTH_WINDOW_MS) {
    throw appError("REAUTH_REQUIRED");
  }

  // Tài khoản quyền cao còn phải qua MFA cho nhóm thao tác này.
  const isHighPrivilege = user.roles.some((role) => HIGH_PRIVILEGE_ROLES.includes(role));
  if (isHighPrivilege && !user.mfaVerified) {
    throw appError("MFA_REQUIRED");
  }

  return user;
}

// -----------------------------------------------------------------------------
// Ownership và assignment
// -----------------------------------------------------------------------------

/**
 * Người dùng đọc được tài nguyên khi: có quyền đọc toàn hệ thống, HOẶC là chủ sở hữu.
 *
 * @param ownerId chủ sở hữu bản ghi; null nghĩa là bản ghi không có chủ (ví dụ yêu cầu
 *                do khách chưa đăng nhập gửi) — khi đó chỉ người có quyền `*_all` đọc được.
 */
export function canReadOwned(
  actor: Actor,
  ownerId: string | null,
  readAllPermission: Permission
): boolean {
  if (actor.permissions.has(readAllPermission)) return true;
  if (!isAuthenticated(actor)) return false;
  return ownerId !== null && ownerId === actor.userId;
}

export function requireReadOwned(
  actor: Actor,
  ownerId: string | null,
  readAllPermission: Permission
): void {
  if (!canReadOwned(actor, ownerId, readAllPermission)) {
    // Trả NOT_FOUND thay vì FORBIDDEN để không tiết lộ bản ghi có tồn tại hay không.
    throw appError("NOT_FOUND");
  }
}

/**
 * Người dùng sửa được tài nguyên của chính mình khi có quyền quản lý toàn hệ thống,
 * hoặc là chủ sở hữu.
 */
export function canWriteOwned(
  actor: Actor,
  ownerId: string | null,
  manageAllPermission: Permission
): boolean {
  if (actor.permissions.has(manageAllPermission)) return true;
  if (!isAuthenticated(actor)) return false;
  return ownerId !== null && ownerId === actor.userId;
}

export function requireWriteOwned(
  actor: Actor,
  ownerId: string | null,
  manageAllPermission: Permission
): void {
  if (!canWriteOwned(actor, ownerId, manageAllPermission)) {
    throw appError("NOT_FOUND");
  }
}

export interface AssignmentWindow {
  primaryDriverId: string | null;
  secondaryDriverId: string | null;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date;
}

/**
 * Tài xế chỉ thao tác được chuyến đang hoặc từng được phân công cho mình (§8).
 *
 * Kiểm tra cả `isActive` lẫn khoảng thời gian hiệu lực: tài xế đã bị gỡ khỏi chuyến
 * không được truy cập tiếp, kể cả khi vẫn còn giữ link cũ.
 */
export function isAssignedDriver(
  actor: Actor,
  assignments: readonly AssignmentWindow[],
  options: { requireCurrentlyActive?: boolean; now?: Date } = {}
): boolean {
  if (!isAuthenticated(actor)) return false;

  const driverId = actor.driverProfileId;
  if (!driverId) return false;

  const now = options.now ?? new Date();

  return assignments.some((assignment) => {
    const isMine =
      assignment.primaryDriverId === driverId || assignment.secondaryDriverId === driverId;
    if (!isMine) return false;

    if (!options.requireCurrentlyActive) return true;

    return (
      assignment.isActive &&
      assignment.effectiveFrom.getTime() <= now.getTime() &&
      now.getTime() < assignment.effectiveTo.getTime()
    );
  });
}

/**
 * Quyền truy cập một chuyến hàng, gộp cả ba đường: quyền toàn hệ thống, chủ đơn hàng,
 * và tài xế được phân công.
 */
export function canAccessShipment(
  actor: Actor,
  shipment: { userId: string | null; assignments: readonly AssignmentWindow[] },
  options: { requireCurrentlyActive?: boolean; now?: Date } = {}
): boolean {
  if (actor.permissions.has("shipment.read_all")) return true;
  if (!isAuthenticated(actor)) return false;
  if (shipment.userId !== null && shipment.userId === actor.userId) return true;
  return isAssignedDriver(actor, shipment.assignments, options);
}

export function requireShipmentAccess(
  actor: Actor,
  shipment: { userId: string | null; assignments: readonly AssignmentWindow[] },
  options: { requireCurrentlyActive?: boolean; now?: Date } = {}
): void {
  if (!canAccessShipment(actor, shipment, options)) {
    throw appError("NOT_FOUND");
  }
}

/** Chuyến đã khép lại thì không ai cập nhật được nữa, kể cả tài xế đã chạy nó. */
const TERMINAL_SHIPMENT_STATUSES = ["COMPLETED", "CANCELLED", "FAILED"];

/**
 * Tài xế cập nhật chuyến: đổi trạng thái, tải ảnh, báo sự cố, lập biên bản.
 *
 * Điều kiện là GIỮ PHÂN CÔNG ĐANG HIỆU LỰC (`isActive`), KHÔNG phải nằm trong khung giờ
 * `effectiveFrom`–`effectiveTo`.
 *
 * Lý do: khung giờ là công cụ LẬP LỊCH để chống trùng xe và tài xế (§14.3), không phải ranh
 * giới phân quyền. Chuyến chạy trễ hơn dự kiến là chuyện thường ngày trong vận tải — lấy
 * khung giờ làm điều kiện phân quyền sẽ khoá tài xế khỏi hệ thống đúng lúc họ cần báo sự cố
 * nhất. Đã gặp thật khi kiểm thử: chuyến còn `IN_TRANSIT` nhưng khung giờ hết 7 tiếng trước,
 * tài xế không báo được xe hỏng.
 *
 * Thu hồi quyền là hành động rõ ràng: điều phối gỡ phân công (`isActive = false`), hoặc
 * chuyến đi tới trạng thái kết thúc.
 */
export function requireShipmentUpdateAccess(
  actor: Actor,
  shipment: { assignments: readonly AssignmentWindow[]; status?: string }
): AuthenticatedActor {
  const user = requirePermission(actor, "shipment.update");

  // Nhân viên điều phối có quyền đọc toàn hệ thống thì cập nhật được mọi chuyến.
  if (user.permissions.has("shipment.read_all")) return user;

  if (shipment.status && TERMINAL_SHIPMENT_STATUSES.includes(shipment.status)) {
    throw appError(
      "RESOURCE_LOCKED",
      "Chuyến đã khép lại. Liên hệ điều phối nếu cần bổ sung thông tin."
    );
  }

  // Còn lại là tài xế: phải đang giữ phân công chưa bị gỡ.
  const holdsActiveAssignment = shipment.assignments.some(
    (assignment) =>
      assignment.isActive &&
      (assignment.primaryDriverId === user.driverProfileId ||
        assignment.secondaryDriverId === user.driverProfileId)
  );

  if (!user.driverProfileId || !holdsActiveAssignment) {
    throw appError("FORBIDDEN");
  }

  return user;
}
