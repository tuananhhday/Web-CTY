"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { contactInquirySchema, type ContactInquiryInput } from "@/modules/support/schema";

/**
 * Form liên hệ trang công khai (§23).
 *
 * Gửi tới API thật và lưu vào `ContactInquiry`. Ba lớp chống spam: rate limit theo IP ở
 * server, bẫy bot ẩn, và độ dài nội dung tối thiểu.
 */

type State =
  | { kind: "idle" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInquiryInput>({
    resolver: zodResolver(contactInquirySchema),
    defaultValues: { name: "", phone: "", email: "", subject: "", message: "", website: "" },
  });

  const onSubmit = async (values: ContactInquiryInput) => {
    setState({ kind: "idle" });

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setState({
          kind: "error",
          message: body?.error?.message ?? "Không gửi được liên hệ. Vui lòng thử lại.",
        });
        return;
      }

      setState({ kind: "sent" });
      reset();
    } catch {
      setState({
        kind: "error",
        message: "Không kết nối được tới máy chủ. Vui lòng gọi hotline nếu cần gấp.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/*
        Bẫy bot: người dùng thật không nhìn thấy nên không bao giờ điền. Ẩn bằng cả CSS lẫn
        `tabIndex={-1}` và `aria-hidden` để trình đọc màn hình cũng bỏ qua (§23).
      */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Đừng điền vào ô này</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label="Họ và tên" required error={errors.name?.message}>
          <Input
            id="c-name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field id="c-phone" label="Số điện thoại" required error={errors.phone?.message}>
          <Input
            id="c-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
      </div>

      <Field id="c-email" label="Email" hint="Không bắt buộc" error={errors.email?.message}>
        <Input
          id="c-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field id="c-subject" label="Tiêu đề" required error={errors.subject?.message}>
        <Input
          id="c-subject"
          placeholder="VD: Tư vấn vận chuyển hàng liên tỉnh"
          aria-invalid={!!errors.subject}
          {...register("subject")}
        />
      </Field>

      <Field id="c-message" label="Nội dung" required error={errors.message?.message}>
        <Textarea id="c-message" rows={5} aria-invalid={!!errors.message} {...register("message")} />
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-fit">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        {isSubmitting ? "Đang gửi..." : "Gửi liên hệ"}
      </Button>

      <div aria-live="polite">
        {state.kind === "sent" && (
          <Alert variant="success">
            <CheckCircle2 aria-hidden />
            <div>
              <p className="font-semibold">Đã nhận liên hệ của bạn</p>
              <p className="mt-1">
                Chúng tôi sẽ liên hệ lại trong giờ làm việc. Nếu cần hỗ trợ ngay, vui lòng
                gọi hotline.
              </p>
            </div>
          </Alert>
        )}

        {state.kind === "error" && (
          <Alert variant="error" role="alert">
            <AlertCircle aria-hidden />
            <p>{state.message}</p>
          </Alert>
        )}
      </div>
    </form>
  );
}
