import type { Metadata } from "next";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = {
  title: "Xác minh email",
  description: "Gửi lại liên kết xác minh email để kích hoạt tài khoản.",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return <ResendVerificationForm />;
}
