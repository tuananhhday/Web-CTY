"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { PasswordInput, PasswordStrength } from "@/components/shared/password-input";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";
import { resetPassword } from "@/lib/auth-client";

function messageForError(code: string | undefined): string {
  switch (code) {
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.";
    case "PASSWORD_TOO_SHORT":
      return "Mật khẩu quá ngắn. Vui lòng dùng tối thiểu 10 ký tự.";
    case "TOO_MANY_REQUESTS":
      return "Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
    default:
      return "Không đặt lại được mật khẩu. Vui lòng yêu cầu liên kết mới.";
  }
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  // Better Auth đính token vào query khi người dùng mở liên kết từ email.
  const token = searchParams.get("token");

  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (values: ResetPasswordInput) => {
    setFormError(null);

    if (!token) {
      setFormError("Thiếu mã xác thực. Hãy mở lại liên kết trong email đặt lại mật khẩu.");
      return;
    }

    const { error } = await resetPassword({ newPassword: values.password, token });

    if (error) {
      setFormError(messageForError(error.code));
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-bold text-navy">Đã đổi mật khẩu</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Mật khẩu mới đã được lưu. Mọi phiên đăng nhập cũ trên các thiết bị khác đã bị thu hồi.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dang-nhap">Về trang đăng nhập</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy">Đặt lại mật khẩu</h1>
      <p className="mt-1.5 text-sm text-foreground/70">
        Nhập mật khẩu mới cho tài khoản của bạn.
      </p>

      {!token && (
        <Alert variant="warning" className="mt-5" role="alert">
          <AlertCircle aria-hidden />
          <p>
            Không tìm thấy mã xác thực trong đường dẫn. Hãy mở lại liên kết trong email đặt lại
            mật khẩu, hoặc{" "}
            <Link href="/quen-mat-khau" className="font-semibold underline">
              yêu cầu liên kết mới
            </Link>
            .
          </p>
        </Alert>
      )}

      {formError && (
        <Alert variant="error" className="mt-5" role="alert">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <Field
          id="rp-password"
          label="Mật khẩu mới"
          required
          hint="Tối thiểu 10 ký tự, gồm chữ hoa, chữ thường và số"
          error={errors.password?.message}
        >
          <PasswordInput
            id="rp-password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        <PasswordStrength password={password} />

        <Field
          id="rp-confirm"
          label="Xác nhận mật khẩu mới"
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="rp-confirm"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
        </Button>
      </form>
    </div>
  );
}
