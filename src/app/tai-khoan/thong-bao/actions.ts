"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/modules/auth/session";
import { markAllRead, markRead } from "@/modules/notifications/service";
import { isAppError } from "@/lib/errors";

/** Server action cho trung tâm thông báo (§21). */

export interface NotificationActionResult {
  ok: boolean;
  message?: string;
}

function toMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "Thao tác không thành công. Vui lòng thử lại.";
}

export async function markReadAction(notificationId: string): Promise<NotificationActionResult> {
  const actor = await getActor();

  try {
    await markRead(actor, notificationId);
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath("/tai-khoan/thong-bao");
  revalidatePath("/tai-khoan");

  return { ok: true };
}

export async function markAllReadAction(): Promise<NotificationActionResult> {
  const actor = await getActor();

  try {
    const count = await markAllRead(actor);
    revalidatePath("/tai-khoan/thong-bao");
    revalidatePath("/tai-khoan");

    return {
      ok: true,
      message: count > 0 ? `Đã đánh dấu ${count} thông báo là đã đọc.` : "Không có thông báo chưa đọc.",
    };
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }
}
