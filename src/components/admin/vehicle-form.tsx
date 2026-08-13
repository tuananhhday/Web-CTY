"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from "@/modules/fleet/schema";
import {
  createVehicleAction,
  updateVehicleAction,
  type FleetActionResult,
} from "@/app/quan-tri/xe/actions";

/**
 * Thêm hoặc sửa xe (§14.1).
 *
 * Tải trọng và kích thước KHÔNG nhập ở đây — chúng thuộc về loại xe (`VehicleType`), là
 * dữ liệu doanh nghiệp phải cung cấp một lần, không phải thuộc tính riêng của từng xe.
 * Để trống thay vì đoán là chủ ý (§1).
 */

export interface VehicleTypeOption {
  slug: string;
  name: string;
}

export interface VehicleFormValues {
  plateNumber: string;
  vehicleTypeSlug: string;
  status: string;
  brand: string;
  model: string;
  manufactureYear: string;
  inspectionExpiresAt: string;
  insuranceExpiresAt: string;
  internalNote: string;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function VehicleForm({
  vehicleTypes,
  initial,
  vehicleId,
}: {
  vehicleTypes: VehicleTypeOption[];
  initial?: VehicleFormValues;
  /** Có id nghĩa là đang sửa; không có là thêm mới. */
  vehicleId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FleetActionResult | null>(null);

  const errors = result?.fieldErrors ?? {};

  const handleSubmit = (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      const outcome = vehicleId
        ? await updateVehicleAction(vehicleId, formData)
        : await createVehicleAction(formData);

      setResult(outcome);

      if (outcome.ok) {
        router.push("/quan-tri/xe");
        router.refresh();
      }
    });
  };

  if (vehicleTypes.length === 0) {
    return (
      <Alert variant="warning">
        <AlertCircle aria-hidden />
        <div>
          <p className="font-semibold">Chưa có loại xe nào trong hệ thống</p>
          <p className="mt-1">
            Cần khai báo danh mục loại xe (kèm tải trọng, kích thước thùng thật) trước khi
            thêm phương tiện cụ thể.
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      {result && !result.ok && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{result.message}</p>
        </Alert>
      )}

      {result?.ok && (
        <Alert variant="success" role="status">
          <CheckCircle2 aria-hidden />
          <p>{result.message}</p>
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="plateNumber"
          label="Biển số"
          required
          error={errors.plateNumber}
          hint="Ví dụ: 51C-123.45"
        >
          <Input
            id="plateNumber"
            name="plateNumber"
            required
            defaultValue={initial?.plateNumber}
            aria-invalid={Boolean(errors.plateNumber)}
          />
        </Field>

        <Field id="vehicleTypeSlug" label="Loại xe" required error={errors.vehicleTypeSlug}>
          <select
            id="vehicleTypeSlug"
            name="vehicleTypeSlug"
            required
            defaultValue={initial?.vehicleTypeSlug ?? ""}
            className={selectClass}
          >
            <option value="">— Chọn loại xe —</option>
            {vehicleTypes.map((type) => (
              <option key={type.slug} value={type.slug}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="status" label="Trạng thái" required error={errors.status}>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "ACTIVE"}
            className={selectClass}
          >
            {VEHICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {VEHICLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="manufactureYear" label="Năm sản xuất" error={errors.manufactureYear}>
          <Input
            id="manufactureYear"
            name="manufactureYear"
            type="number"
            inputMode="numeric"
            min={1980}
            max={new Date().getFullYear() + 1}
            defaultValue={initial?.manufactureYear}
          />
        </Field>

        <Field id="brand" label="Hãng xe" error={errors.brand}>
          <Input id="brand" name="brand" defaultValue={initial?.brand} />
        </Field>

        <Field id="model" label="Dòng xe" error={errors.model}>
          <Input id="model" name="model" defaultValue={initial?.model} />
        </Field>

        <Field
          id="inspectionExpiresAt"
          label="Hạn đăng kiểm"
          error={errors.inspectionExpiresAt}
          hint="Để trống nếu chưa có thông tin"
        >
          <Input
            id="inspectionExpiresAt"
            name="inspectionExpiresAt"
            type="date"
            defaultValue={initial?.inspectionExpiresAt}
          />
        </Field>

        <Field
          id="insuranceExpiresAt"
          label="Hạn bảo hiểm"
          error={errors.insuranceExpiresAt}
          hint="Để trống nếu chưa có thông tin"
        >
          <Input
            id="insuranceExpiresAt"
            name="insuranceExpiresAt"
            type="date"
            defaultValue={initial?.insuranceExpiresAt}
          />
        </Field>
      </div>

      <Field
        id="internalNote"
        label="Ghi chú nội bộ"
        error={errors.internalNote}
        hint="Khách hàng không nhìn thấy nội dung này."
      >
        <Textarea id="internalNote" name="internalNote" rows={3} defaultValue={initial?.internalNote} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang lưu..." : vehicleId ? "Lưu thay đổi" : "Thêm xe"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/quan-tri/xe")}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
