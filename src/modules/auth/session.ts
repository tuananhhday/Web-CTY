import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { GUEST, createActor, type Actor } from "@/modules/auth/actor";
import { findUserForAuth } from "@/modules/auth/repository";

/**
 * Lấy Actor cho request hiện tại.
 *
 * Bọc trong `cache()` của React để nhiều Server Component trong cùng một request chỉ
 * truy vấn database một lần.
 *
 * Vai trò LUÔN đọc từ database, không lấy từ cookie hay JWT claim: thu hồi vai trò
 * phải có hiệu lực ngay lập tức, không chờ phiên hết hạn (§8).
 */
export const getActor = cache(async (): Promise<Actor> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return GUEST;

    const record = await findUserForAuth(session.user.id);
    if (!record) return GUEST;

    // Tài khoản bị khoá hoặc vô hiệu hoá mất quyền truy cập ngay, kể cả khi phiên còn hạn.
    if (record.status === "SUSPENDED" || record.status === "DEACTIVATED") {
      return GUEST;
    }

    return createActor({
      userId: record.id,
      email: record.email,
      name: record.name,
      roles: record.roles,
      driverProfileId: record.driverProfileId ?? undefined,
      sessionId: session.session.id,
      authenticatedAt: session.session.createdAt,
      mfaVerified: record.mfaVerified,
    });
  } catch (error) {
    // Next.js dùng exception làm tín hiệu điều khiển: redirect, notFound và đặc biệt là
    // DYNAMIC_SERVER_USAGE (đánh dấu route phải render động vì đã đọc headers/cookies).
    // Nuốt các lỗi này sẽ khiến framework hiểu sai và prerender nhầm trang riêng tư.
    if (isFrameworkControlError(error)) throw error;

    // Lỗi thật khi đọc phiên: ghi log và coi như chưa đăng nhập, không để sập trang.
    logger.error({ err: error }, "Không đọc được phiên đăng nhập");
    return GUEST;
  }
});

/** Nhận diện exception do Next.js ném ra để điều khiển luồng render. */
function isFrameworkControlError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return (
    digest === "DYNAMIC_SERVER_USAGE" ||
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}
