"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";
import { requestPasswordReset } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: { email: string }) => {
    // Luôn hiển thị màn hình thành công, kể cả khi email không tồn tại trong hệ thống.
    // Phản hồi khác nhau sẽ để lộ email nào đã đăng ký (§9).
    await requestPasswordReset({
      email: values.email.trim().toLowerCase(),
      redirectTo: "/dat-lai-mat-khau",
    });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <MailCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-bold text-navy">Đã gửi hướng dẫn</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Nếu địa chỉ email bạn nhập đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu tới
          hộp thư đó. Liên kết chỉ dùng được một lần và hết hạn sau 1 giờ.
        </p>
        <p className="mt-3 text-sm text-muted">
          Không thấy email? Kiểm tra thư mục spam trước khi yêu cầu gửi lại.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link href="/dang-nhap">Về trang đăng nhập</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy">Quên mật khẩu</h1>
      <p className="mt-1.5 text-sm text-foreground/70">
        Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.
      </p>


      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <Field id="fp-email" label="Email" required error={errors.email?.message}>
          <Input
            id="fp-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? "Đang gửi..." : "Gửi hướng dẫn đặt lại"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground/70">
        Nhớ lại mật khẩu?{" "}
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
