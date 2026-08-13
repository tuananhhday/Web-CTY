import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Giao diện khôi phục mật khẩu ở chế độ xem thử.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
