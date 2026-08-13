import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/guards";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

/**
 * Khu vực riêng tư: mỗi người dùng thấy dữ liệu khác nhau nên tuyệt đối không prerender
 * hay cache dùng chung. Middleware đã đặt `Cache-Control: no-store` cho nhóm route này (§32.1).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Khu vực khách hàng", template: "%s | Khu vực khách hàng" },
  description: "Theo dõi yêu cầu báo giá, đơn hàng và thông báo của bạn.",
  robots: { index: false, follow: false },
};

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  // Lớp bảo vệ THẬT. Middleware chỉ điều hướng sớm cho mượt, không phải bảo vệ (§30.2).
  const actor = await requireUser("/tai-khoan");

  /*
   * Đăng nhập xong ai cũng đáp xuống đây. Với người có thêm vai trò, hiện lối sang khu vực
   * của họ — nếu không, tài xế sẽ không có bất kỳ liên kết nào dẫn tới màn hình chuyến của
   * mình và phải tự gõ `/tai-xe` vào thanh địa chỉ.
   *
   * Chỉ là tiện lợi điều hướng. Bản thân `/tai-xe` và `/quan-tri` vẫn tự kiểm quyền ở
   * server, nên hiện nhầm cũng không mở được cửa nào.
   */
  const workspaces: ("driver" | "staff")[] = [];
  if (actor.roles.includes("DRIVER") && actor.driverProfileId) workspaces.push("driver");
  if (actor.permissions.has("request.read_all")) workspaces.push("staff");

  return (
    <DashboardShell userName={actor.name} workspaces={workspaces}>
      {children}
    </DashboardShell>
  );
}
