import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Đăng ký",
  description: "Giao diện đăng ký tài khoản ở chế độ xem thử, chưa tạo tài khoản thật.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
