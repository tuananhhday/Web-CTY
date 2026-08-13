import "server-only";
import { db } from "@/lib/db";
import type { StoredRole } from "@/modules/auth/permissions";

/**
 * Truy cập dữ liệu cho module auth.
 * Chỉ tầng service được gọi các hàm này; component và route handler không gọi trực tiếp (§4).
 */

export interface UserAuthRecord {
  id: string;
  email: string;
  name: string;
  status: string;
  deletedAt: Date | null;
  roles: StoredRole[];
  driverProfileId: string | null;
  mfaVerified: boolean;
}

/**
 * Nạp thông tin phân quyền của người dùng.
 * Chỉ lấy vai trò chưa bị thu hồi (`revokedAt = null`) — thu hồi vai trò có hiệu lực ngay.
 */
export async function findUserForAuth(userId: string): Promise<UserAuthRecord | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      deletedAt: true,
      roles: {
        where: { revokedAt: null },
        select: { role: true },
      },
      driverProfile: {
        where: { deletedAt: null },
        select: { id: true },
      },
      mfaCredentials: {
        where: { verifiedAt: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    deletedAt: user.deletedAt,
    roles: user.roles.map((r) => r.role as StoredRole),
    driverProfileId: user.driverProfile?.id ?? null,
    mfaVerified: user.mfaCredentials.length > 0,
  };
}

/** Gán vai trò. Dùng upsert để gọi lại nhiều lần không tạo bản ghi trùng. */
export async function grantRole(
  userId: string,
  role: StoredRole,
  grantedById: string | null
): Promise<void> {
  await db.userRoleAssignment.upsert({
    where: { userId_role: { userId, role } },
    update: { revokedAt: null, grantedAt: new Date(), grantedById },
    create: { userId, role, grantedById },
  });
}

/** Thu hồi vai trò bằng cách đánh dấu thời điểm, giữ lại lịch sử để audit (§8). */
export async function revokeRole(userId: string, role: StoredRole): Promise<void> {
  await db.userRoleAssignment.updateMany({
    where: { userId, role, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Đăng xuất mọi thiết bị: đánh dấu thu hồi thay vì xoá, giữ vết phục vụ điều tra (§9). */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function isSessionRevoked(sessionToken: string): Promise<boolean> {
  const session = await db.session.findUnique({
    where: { token: sessionToken },
    select: { revokedAt: true },
  });
  return session?.revokedAt !== null && session?.revokedAt !== undefined;
}
