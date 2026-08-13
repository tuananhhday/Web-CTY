import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "@/modules/auth/session";
import type { Actor, AuthenticatedActor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import type { Permission, StoredRole } from "@/modules/auth/permissions";

/**
 * Guard cho Server Component và server action (§30.2).
 *
 * Đây mới là lớp bảo vệ thật. Middleware chỉ điều hướng cho đẹp trải nghiệm; route group
 * chỉ tổ chức mã nguồn. Cả hai đều KHÔNG được coi là bảo vệ (§5).
 *
 * Khác với `policy.ts` (ném AppError cho API), các hàm ở đây redirect — phù hợp với trang.
 */

/**
 * Chỉ nhận đường dẫn nội bộ, chống open redirect (§9, §30.1).
 * Chặn cả `//evil.com` và `https://evil.com` lẫn `/\evil.com`.
 */
export function sanitizeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

function loginUrl(returnTo: string): string {
  return `/dang-nhap?tiep-tuc=${encodeURIComponent(sanitizeRedirect(returnTo))}`;
}

/** Bắt buộc đăng nhập. Chưa đăng nhập thì chuyển tới trang đăng nhập kèm đường dẫn quay lại. */
export async function requireUser(returnTo: string): Promise<AuthenticatedActor> {
  const actor = await getActor();
  if (!isAuthenticated(actor)) {
    redirect(loginUrl(returnTo));
  }
  return actor;
}

/**
 * Bắt buộc có một quyền cụ thể.
 * Thiếu quyền thì trả về 404 thay vì 403 để không tiết lộ sự tồn tại của khu vực quản trị.
 */
export async function requireUserWithPermission(
  permission: Permission,
  returnTo: string
): Promise<AuthenticatedActor> {
  const actor = await requireUser(returnTo);
  if (!actor.permissions.has(permission)) {
    // notFound() ném lỗi nên hàm không chạy tiếp.
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return actor;
}

export async function requireUserWithAnyRole(
  roles: readonly StoredRole[],
  returnTo: string
): Promise<AuthenticatedActor> {
  const actor = await requireUser(returnTo);
  if (!roles.some((role) => actor.roles.includes(role))) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return actor;
}

/** Khu vực tài xế: chỉ DRIVER có hồ sơ tài xế hợp lệ mới vào được. */
export async function requireDriver(returnTo: string): Promise<AuthenticatedActor> {
  const actor = await requireUserWithAnyRole(["DRIVER"], returnTo);
  if (!actor.driverProfileId) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return actor;
}

/** Khu vực quản trị: bất kỳ vai trò nhân viên nào, phân quyền chi tiết ở từng trang. */
export async function requireStaff(returnTo: string): Promise<AuthenticatedActor> {
  return requireUserWithAnyRole(
    ["DISPATCHER", "EDITOR", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"],
    returnTo
  );
}

/** Dùng ở trang đăng nhập/đăng ký: đã đăng nhập rồi thì không cần vào nữa. */
export async function redirectIfAuthenticated(target = "/tai-khoan"): Promise<Actor> {
  const actor = await getActor();
  if (isAuthenticated(actor)) {
    redirect(sanitizeRedirect(target, "/tai-khoan"));
  }
  return actor;
}
