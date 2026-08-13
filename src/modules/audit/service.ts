import "server-only";
import { db, type Prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redactSensitive } from "@/modules/audit/redact";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";

/**
 * Nhật ký kiểm toán (§30.3).
 *
 * AuditLog là append-only ở tầng ứng dụng: chỉ có hàm ghi, không có hàm sửa/xoá.
 *
 * TUYỆT ĐỐI không ghi: mật khẩu, token, OTP, cookie, presigned URL, số giấy tờ đầy đủ,
 * nội dung media. Việc lọc do `redactSensitive` trong ./redact.ts đảm nhiệm.
 */

export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  context?: AuditContext;
}

/**
 * Ghi một bản ghi audit.
 *
 * @param tx truyền Prisma transaction client để bản ghi audit nằm cùng transaction với
 *           nghiệp vụ — nếu nghiệp vụ rollback thì audit cũng rollback, tránh log sai sự thật.
 */
export async function recordAudit(
  actor: Actor,
  entry: AuditEntry,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;

  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorId: isAuthenticated(actor) ? actor.userId : null,
    actorRole: isAuthenticated(actor) ? (actor.roles[0] ?? null) : null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    beforeData: entry.before === undefined ? undefined : redactSensitive(entry.before) ?? undefined,
    afterData: entry.after === undefined ? undefined : redactSensitive(entry.after) ?? undefined,
    ipAddress: entry.context?.ipAddress ?? null,
    userAgent: entry.context?.userAgent ?? null,
    requestId: entry.context?.requestId ?? null,
  };

  try {
    await client.auditLog.create({ data });
  } catch (error) {
    // Không để lỗi ghi audit làm thất bại nghiệp vụ khi audit chạy ngoài transaction.
    // Trong transaction thì lỗi sẽ lan ra và rollback — đó là hành vi mong muốn.
    if (tx) throw error;
    logger.error(
      { err: error, action: entry.action, resourceType: entry.resourceType },
      "Không ghi được AuditLog"
    );
  }
}

/** Các action đã dùng, khai báo tập trung để tránh gõ sai chuỗi rải rác. */
export const AUDIT_ACTIONS = {
  USER_SIGNED_UP: "user.signed_up",
  USER_SIGNED_IN: "user.signed_in",
  USER_SIGN_IN_FAILED: "user.sign_in_failed",
  USER_SIGNED_OUT: "user.signed_out",
  USER_SIGNED_OUT_ALL: "user.signed_out_all_devices",
  USER_EMAIL_VERIFIED: "user.email_verified",
  USER_PASSWORD_RESET_REQUESTED: "user.password_reset_requested",
  USER_PASSWORD_CHANGED: "user.password_changed",
  USER_LOCKED: "user.locked",
  USER_STATUS_CHANGED: "user.status_changed",
  ROLE_GRANTED: "role.granted",
  ROLE_REVOKED: "role.revoked",
} as const;
