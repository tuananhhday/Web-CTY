"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { estimateSchema, type EstimateInput } from "@/lib/validations";
import { DEMO_NOTICE, simulateDelay } from "@/lib/demo";

export function EstimateForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EstimateInput>({
    resolver: zodResolver(estimateSchema),
    defaultValues: { pickupAddress: "", dropoffAddress: "", cargoType: "" },
  });

  const onSubmit = async () => {
    // DEMO_MODE: không gửi dữ liệu đi đâu, chỉ mô phỏng độ trễ và hiển thị thông báo.
    setSubmitted(false);
    await simulateDelay();
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="est-pickup" label="Điểm lấy hàng" required error={errors.pickupAddress?.message}>
          <Input
            id="est-pickup"
            placeholder="VD: Quận 7, TP. Hồ Chí Minh"
            aria-invalid={!!errors.pickupAddress}
            aria-describedby={errors.pickupAddress ? "est-pickup-error" : undefined}
            {...register("pickupAddress")}
          />
        </Field>

        <Field id="est-dropoff" label="Điểm giao hàng" required error={errors.dropoffAddress?.message}>
          <Input
            id="est-dropoff"
            placeholder="VD: TP. Biên Hòa, Đồng Nai"
            aria-invalid={!!errors.dropoffAddress}
            aria-describedby={errors.dropoffAddress ? "est-dropoff-error" : undefined}
            {...register("dropoffAddress")}
          />
        </Field>

        <Field id="est-cargo" label="Loại hàng" required error={errors.cargoType?.message}>
          <Input
            id="est-cargo"
            placeholder="VD: Hàng bách hóa đóng thùng"
            aria-invalid={!!errors.cargoType}
            aria-describedby={errors.cargoType ? "est-cargo-error" : undefined}
            {...register("cargoType")}
          />
        </Field>

        <Field
          id="est-weight"
          label="Trọng lượng dự kiến (kg)"
          required
          error={errors.weightKg?.message}
        >
          <Input
            id="est-weight"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="VD: 500"
            aria-invalid={!!errors.weightKg}
            aria-describedby={errors.weightKg ? "est-weight-error" : undefined}
            {...register("weightKg", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Calculator className="h-4 w-4" aria-hidden />
        )}
        {isSubmitting ? "Đang xử lý..." : "Ước tính"}
      </Button>

      {submitted && (
        <Alert variant="warning">
          <Info aria-hidden />
          <div>
            <p className="font-semibold">Chưa thể đưa ra mức giá</p>
            <p className="mt-1">{DEMO_NOTICE.estimate}</p>
          </div>
        </Alert>
      )}
    </form>
  );
}
