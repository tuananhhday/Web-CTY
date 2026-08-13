import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
  description: "Đặt mật khẩu mới cho tài khoản của bạn.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  // ResetPasswordForm đọc `?token=` bằng useSearchParams — cần Suspense để prerender.
  return (
    <Suspense fallback={<AuthFormSkeleton title="Đặt lại mật khẩu" rows={2} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
