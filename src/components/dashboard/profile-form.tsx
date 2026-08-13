"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import { simulateDelay } from "@/lib/demo";
import { demoUser } from "@/data/mock/users";

export function ProfileForm() {
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: demoUser.name,
      email: demoUser.email,
      phone: demoUser.phone,
      companyName: demoUser.companyName ?? "",
      address: "",
    },
  });

  const onSubmit = async () => {
    // DEMO_MODE: không lưu hồ sơ, không gửi tới API.
    setSaved(false);
    await simulateDelay(900);
    setSaved(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label="Họ và tên" required error={errors.fullName?.message}>
          <Input id="p-name" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        </Field>
        <Field id="p-phone" label="Số điện thoại" required error={errors.phone?.message}>
          <Input
            id="p-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
        <Field id="p-email" label="Email" required error={errors.email?.message}>
          <Input id="p-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field id="p-company" label="Tên doanh nghiệp" hint="Không bắt buộc">
          <Input id="p-company" autoComplete="organization" {...register("companyName")} />
        </Field>
      </div>

      <Field id="p-address" label="Địa chỉ liên hệ" hint="Không bắt buộc">
        <Input id="p-address" autoComplete="street-address" {...register("address")} />
      </Field>

      <Button type="submit" disabled={isSubmitting} className="w-fit">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Save className="h-4 w-4" aria-hidden />
        )}
        {isSubmitting ? "Đang xử lý..." : "Lưu thay đổi (xem thử)"}
      </Button>

      {saved && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <p>
            Phản hồi mô phỏng của chế độ DEMO_MODE. Thông tin hồ sơ chưa được lưu vào bất kỳ hệ
            thống nào.
          </p>
        </Alert>
      )}
    </form>
  );
}
