"use client";

import Link from "next/link";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Loader2, MailCheck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/shared/field";
import { PasswordInput, PasswordStrength } from "@/components/shared/password-input";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { signUp } from "@/lib/auth-client";

/** Ánh xạ mã lỗi Better Auth sang thông báo tiếng Việt an toàn. */
function messageForError(code: string | undefined): string {
  switch (code) {
    case "USER_ALREADY_EXISTS":
											      return "Email này đã được đăng ký. Bạn có thể đăng nhập hoặc dùng chức năng quên mật khẩu.";
    case "PASSWORD_TOO_SHORT":
      return "Mật khẩu quá ngắn. Vui lòng dùng tối thiểu 10 ký tự.";
    case "TOO_MANY_REQUESTS":
      return "Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
    default:
      return "Không tạo được tài khoản. Vui lòng thử lại sau ít phút.";
  }
}

export function RegisterForm() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      companyName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);
    const email = values.email.trim().toLowerCase();

    const { error } = await signUp.email({
      email,
      password: values.password,
      name: values.fullName.trim(),
    });

    if (error) {
      setFormError(messageForError(error.code));
      return;
    }

    setRegisteredEmail(email);
  };

  if (registeredEmail) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <MailCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-bold text-navy">Kiểm tra hộp thư của bạn</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Chúng tôi đã gửi liên kết xác minh tới <strong className="text-navy">{registeredEmail}</strong>.
          Mở liên kết đó để kích hoạt tài khoản. Nếu không thấy email, hãy kiểm tra thư mục spam.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link href="/xac-minh">Chưa nhận được email?</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dang-nhap">Về trang đăng nhập</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy">Đăng ký tài khoản</h1>
      <p className="mt-1.5 text-sm text-foreground/70">
        Tạo tài khoản để lưu lịch sử yêu cầu báo giá và theo dõi đơn hàng.
      </p>

      {formError && (
        <Alert variant="error" className="mt-5" role="alert">
          <AlertCircle aria-hidden />
          <p>{formError}</p>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <Field id="reg-name" label="Họ và tên" required error={errors.fullName?.message}>
          <Input id="reg-name" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        </Field>

        <Field id="reg-email" label="Email" required error={errors.email?.message}>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field id="reg-phone" label="Số điện thoại" required error={errors.phone?.message}>
          <Input
            id="reg-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>

        <Field id="reg-company" label="Tên doanh nghiệp" hint="Không bắt buộc">
          <Input id="reg-company" autoComplete="organization" {...register("companyName")} />
        </Field>

        <Field
          id="reg-password"
          label="Mật khẩu"
          required
          hint="Tối thiểu 10 ký tự, gồm chữ hoa, chữ thường và số"
          error={errors.password?.message}
        >
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        <PasswordStrength password={password} />

        <Field
          id="reg-confirm"
          label="Xác nhận mật khẩu"
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="reg-confirm"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2.5">
            <Controller
              name="acceptTerms"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="reg-terms"
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={!!errors.acceptTerms}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="reg-terms" className="font-normal leading-relaxed text-foreground/75">
              Tôi đồng ý với{" "}
              <Link href="/chinh-sach/dieu-khoan" className="font-semibold text-orange-text hover:underline">
                Điều khoản sử dụng
              </Link>{" "}
              và{" "}
              <Link href="/chinh-sach/bao-mat" className="font-semibold text-orange-text hover:underline">
                Chính sách bảo mật
              </Link>
            </Label>
          </div>
          {errors.acceptTerms && (
            <p role="alert" className="text-xs font-medium text-error">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground/70">
        Đã có tài khoản?{" "}
        <Link
          href="/dang-nhap"
          className="rounded-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
