"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { authClient } from "@/lib/auth-client";
import { company } from "@/config/company";

const schema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
});

type FormValues = z.infer<typeof schema>;

export function ResendVerificationForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    // Không phân biệt email tồn tại hay chưa, không phân biệt đã xác minh hay chưa —
    // mọi trường hợp đều hiển thị cùng một màn hình thành công (§9).
    await authClient.sendVerificationEmail({
      email: values.email.trim().toLowerCase(),
      callbackURL: "/dang-nhap",
    });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <MailCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-bold text-navy">Đã gửi liên kết xác minh</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Nếu địa chỉ email bạn nhập đã đăng ký và chưa xác minh, chúng tôi vừa gửi liên kết kích
          hoạt tới hộp thư đó.
        </p>
        <p className="mt-3 text-sm text-muted">
          Không thấy email? Kiểm tra thư mục spam trước khi yêu cầu gửi lại.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/dang-nhap">Về trang đăng nhập</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy/5 text-navy">
        <MailCheck className="h-7 w-7" aria-hidden />
      </span>

      <h1 className="mt-5 text-center text-xl font-bold text-navy">Xác minh email</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-foreground/70">
        Tài khoản cần được xác minh email trước khi đăng nhập. Nhập địa chỉ email đã đăng ký để
        nhận lại liên kết kích hoạt.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <Field id="verify-email" label="Email" required error={errors.email?.message}>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
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
          {isSubmitting ? "Đang gửi..." : "Gửi lại liên kết xác minh"}
        </Button>
      </form>

      <p className="mt-6 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted">
        Vẫn gặp khó khăn? Liên hệ hotline {company.phone} trong giờ làm việc, hoặc{" "}
        <Link href="/lien-he" className="font-semibold text-orange-text hover:underline">
          gửi yêu cầu hỗ trợ
        </Link>
        .
      </p>
    </div>
  );
}
