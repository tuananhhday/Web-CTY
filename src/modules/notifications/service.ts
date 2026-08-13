import "server-only";
import { db } from "@/lib/db";
import { appError } from "@/lib/errors";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";

/**
 * Trung tâm thông báo trong ứng dụng (§21).
 *
 * Mọi truy vấn lọc theo `userId` ngay trong `where` — thông báo là dữ liệu riêng tư, không
 * có đường nào để người này đọc thông báo của người khác (§30.2).
 */

export async function listMyNotifications(actor: Actor, limit = 50) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  return db.notification.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventKey: true,
      severity: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUnread(actor: Actor): Promise<number> {
  if (!isAuthenticated(actor)) return 0;

  return db.notification.count({
    where: { userId: actor.userId, readAt: null },
  });
}

/**
 * Đánh dấu đã đọc.
 *
 * Dùng `updateMany` kèm điều kiện `userId` thay vì `update` theo id: `update` sẽ ném lỗi
 * khi không tìm thấy, và phân biệt được "không tồn tại" với "của người khác" — đúng thứ
 * không nên tiết lộ (§30.2). `updateMany` trả `count = 0` cho cả hai trường hợp.
 */
export async function markRead(actor: Actor, notificationId: string): Promise<void> {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  await db.notification.updateMany({
    where: { id: notificationId, userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(actor: Actor): Promise<number> {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const result = await db.notification.updateMany({
    where: { userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}
