import type { Permission, Role, StoredRole } from "@/modules/auth/permissions";
import { permissionsForRoles } from "@/modules/auth/permissions";

/**
 * Actor context — "ai đang thực hiện thao tác này".
 *
 * Mọi service method đều nhận Actor (§30.2). Không có hàm nghiệp vụ nào chạy mà
 * không biết chủ thể. Object này thuần dữ liệu, không truy cập database, nên dùng
 * được cả trong unit test lẫn runtime.
 */

export interface AuthenticatedActor {
  kind: "user";
  userId: string;
  email: string;
  name: string;
  roles: readonly StoredRole[];
  permissions: ReadonlySet<Permission>;
  /** Hồ sơ tài xế, chỉ có khi người dùng giữ vai trò DRIVER. */
  driverProfileId?: string;
  sessionId: string;
  /** Thời điểm xác thực gần nhất — dùng cho yêu cầu re-auth thao tác nhạy cảm (§30.2). */
  authenticatedAt: Date;
  mfaVerified: boolean;
}

export interface GuestActor {
  kind: "guest";
  roles: readonly [];
  permissions: ReadonlySet<Permission>;
}

export type Actor = AuthenticatedActor | GuestActor;

const NO_PERMISSIONS: ReadonlySet<Permission> = new Set();

export const GUEST: GuestActor = {
  kind: "guest",
  roles: [],
  permissions: NO_PERMISSIONS,
};

export function createActor(input: {
  userId: string;
  email: string;
  name: string;
  roles: readonly StoredRole[];
  sessionId: string;
  authenticatedAt: Date;
  driverProfileId?: string;
  mfaVerified?: boolean;
}): AuthenticatedActor {
  return {
    kind: "user",
    userId: input.userId,
    email: input.email,
    name: input.name,
    roles: input.roles,
    permissions: permissionsForRoles(input.roles),
    driverProfileId: input.driverProfileId,
    sessionId: input.sessionId,
    authenticatedAt: input.authenticatedAt,
    mfaVerified: input.mfaVerified ?? false,
  };
}

export function isAuthenticated(actor: Actor): actor is AuthenticatedActor {
  return actor.kind === "user";
}

/** Vai trò hiệu lực, dùng để hiển thị và ghi AuditLog. */
export function effectiveRoles(actor: Actor): readonly Role[] {
  return actor.kind === "guest" ? (["GUEST"] as const) : actor.roles;
}

export function hasRole(actor: Actor, role: StoredRole): boolean {
  return actor.kind === "user" && actor.roles.includes(role);
}

export function hasAnyRole(actor: Actor, roles: readonly StoredRole[]): boolean {
  return actor.kind === "user" && roles.some((role) => actor.roles.includes(role));
}
