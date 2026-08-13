"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { PasswordInput } from "@/components/shared/password-input";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { signIn } from "@/lib/auth-client";

/** Chỉ chấp nhận đường dẫn nội bộ, chống open redirect (§9, §30.1). */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/tai-khoan";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/tai-khoan";
  return value;
}

/**
 * Ánh xạ mã lỗi của Better Auth sang thông báo tiếng Việt.
 *
 * Sai mật khẩu và email không tồn tại dùng CHUNG một thông báo — không để kẻ tấn công
 * dò được email nào đã đăng ký (§9).
 */
function messageForError(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email hoặc mật khẩu không đúng.";
    case "EMAIL_NOT_VERIFIED":
      return "Tài khoản chưa xác minh email. Vui lòng kiểm tra hộp thư để kích hoạt.";
    case "TOO_MANY_REQUESTS":
      return "Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
    default:
      return "Không đăng nhập được. Vui lòng thử lại sau ít phút.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);

    const { error } = await signIn.email({
      // Chuẩn hoá về chữ thường để khớp unique index trên cột email.
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });

    if (error) {
      setFormError(messageForError(error.code));
      return;
    }

    // refresh() để Server Component đọc lại phiên vừa tạo trước khi điều hướng.
    router.refresh();
    router.push(safeNext(searchParams.get("tiep-tuc")));
  };

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy">Đăng nhập</h1>
      <p className="mt-1.5 text-sm text-foreground/70">
        Truy cập khu vực khách hàng để xem yêu cầu báo giá và đơn hàng.
      </p>

      {formError && (
        <Alert variant="error" className="mt-5" role="alert">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <Field id="login-email" label="Email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field id="login-password" label="Mật khẩu" required error={errors.password?.message}>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        <div className="flex justify-end">
          <Link
            href="/quen-mat-khau"
            className="rounded-sm text-sm font-medium text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground/70">
        Chưa có tài khoản?{" "}
        <Link
          href="/dang-ky"
          className="rounded-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
        >
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
