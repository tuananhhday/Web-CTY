import type { Metadata } from "next";
import { getActor } from "@/modules/auth/session";
import { listMyNotifications } from "@/modules/notifications/service";
import { NotificationList } from "@/components/dashboard/notification-list";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "Thông báo",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const actor = await getActor();
  const notifications = await listMyNotifications(actor);

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Thông báo</h1>
        <p className="mt-1 text-sm text-foreground/70">
          {unreadCount > 0
            ? `${unreadCount} thông báo chưa đọc`
            : `${notifications.length} thông báo`}
        </p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="Chưa có thông báo"
          description="Thông báo về trạng thái đơn hàng, báo giá và yêu cầu hỗ trợ sẽ hiển thị tại đây."
        />
      ) : (
        <NotificationList items={notifications} />
      )}
    </div>
  );
}
