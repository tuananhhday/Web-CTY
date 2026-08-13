import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập để theo dõi yêu cầu báo giá và đơn hàng của bạn.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  // LoginForm đọc query `?tiep-tuc=` bằng useSearchParams. Bọc Suspense để phần vỏ trang
  // vẫn được prerender tĩnh, chỉ riêng form chờ tới lúc chạy trên trình duyệt.
  return (
    <Suspense fallback={<AuthFormSkeleton title="Đăng nhập" rows={2} />}>
      <LoginForm />
    </Suspense>
  );
}
