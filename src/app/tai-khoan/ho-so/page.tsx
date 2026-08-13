import { Info } from "lucide-react";
import { DashboardPageTitle } from "@/components/dashboard/page-title";
import { Alert } from "@/components/ui/alert";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { DemoBadge } from "@/components/shared/demo-badge";

export default function ProfilePage() {
  return (
    <>
      <DashboardPageTitle
        title="Hồ sơ khách hàng"
        description="Thông tin liên hệ dùng cho các yêu cầu vận chuyển."
        action={<DemoBadge />}
      />

      <Alert variant="warning" className="mb-6">
        <Info aria-hidden />
        <p>
          Hồ sơ hiển thị dữ liệu mô phỏng. Ở chế độ DEMO_MODE, mọi thay đổi không được lưu và không
          được gửi tới máy chủ.
        </p>
      </Alert>

      <div className="rounded-lg border border-border bg-white p-5 sm:p-6">
        <h2 className="mb-5 text-base font-bold text-navy">Thông tin cá nhân</h2>
        <ProfileForm />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-navy">Bảo mật tài khoản</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Chức năng đổi mật khẩu, quản lý phiên đăng nhập và xác thực hai lớp sẽ được triển khai
          cùng hệ thống xác thực thật ở giai đoạn sau. Hiện tại chưa có tài khoản, phiên đăng nhập
          hoặc mật khẩu nào được lưu trữ.
        </p>
      </div>
    </>
  );
}
