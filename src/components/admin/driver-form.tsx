"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  DRIVER_STATUSES,
  DRIVER_STATUS_LABELS,
  LICENSE_CLASSES,
} from "@/modules/fleet/schema";
import { updateDriverAction } from "@/app/quan-tri/tai-xe/actions";
import type { FleetActionResult } from "@/app/quan-tri/xe/actions";

/**
 * Sửa hồ sơ tài xế (§14.2).
 *
 * Không có form tạo mới: hồ sơ tài xế luôn gắn với một tài khoản đăng nhập, mà việc tạo
 * tài khoản thuộc module quản lý người dùng chưa xây dựng. Thà thiếu chức năng còn hơn
 * tạo hồ sơ mồ côi không đăng nhập được.
 */

export interface DriverFormValues {
  employeeCode: string;
  fullName: string;
  workPhone: string;
  licenseClass: string;
  licenseNumber: string;
  licenseExpiresAt: string;
  status: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  internalNote: string;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function DriverForm({
  driverId,
  initial,
}: {
  driverId: string;
  initial: DriverFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FleetActionResult | null>(null);

  const errors = result?.fieldErrors ?? {};

  const handleSubmit = (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await updateDriverAction(driverId, formData);
      setResult(outcome);

      if (outcome.ok) {
        router.push("/quan-tri/tai-xe");
        router.refresh();
      }
    });
  };

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      {result && !result.ok && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{result.message}</p>
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="employeeCode" label="Mã nhân sự" required error={errors.employeeCode}>
          <Input
            id="employeeCode"
            name="employeeCode"
            required
            defaultValue={initial.employeeCode}
          />
        </Field>

        <Field id="fullName" label="Họ và tên" required error={errors.fullName}>
          <Input id="fullName" name="fullName" required defaultValue={initial.fullName} />
        </Field>

        <Field id="workPhone" label="Điện thoại công việc" required error={errors.workPhone}>
          <Input
            id="workPhone"
            name="workPhone"
            type="tel"
            inputMode="tel"
            required
            defaultValue={initial.workPhone}
          />
        </Field>

        <Field id="status" label="Trạng thái" required error={errors.status}>
          <select
            id="status"
            name="status"
            defaultValue={initial.status}
            className={selectClass}
          >
            {DRIVER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DRIVER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="licenseClass" label="Hạng bằng lái" error={errors.licenseClass}>
          <select
            id="licenseClass"
            name="licenseClass"
            defaultValue={initial.licenseClass}
            className={selectClass}
          >
            <option value="">— Chưa có thông tin —</option>
            {LICENSE_CLASSES.map((licenseClass) => (
              <option key={licenseClass} value={licenseClass}>
                Hạng {licenseClass}
              </option>
            ))}
          </select>
        </Field>

        <Field id="licenseNumber" label="Số bằng lái" error={errors.licenseNumber}>
          <Input id="licenseNumber" name="licenseNumber" defaultValue={initial.licenseNumber} />
        </Field>

        <Field
          id="licenseExpiresAt"
          label="Hạn bằng lái"
          error={errors.licenseExpiresAt}
          hint="Hệ thống cảnh báo trước 30 ngày."
        >
          <Input
            id="licenseExpiresAt"
            name="licenseExpiresAt"
            type="date"
            defaultValue={initial.licenseExpiresAt}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-5 rounded-lg border border-border p-4">
        <legend className="flex items-center gap-1.5 px-2 text-sm font-semibold text-navy">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Liên hệ khẩn cấp
        </legend>

        <p className="text-xs text-muted">
          Chỉ nhân viên có quyền quản lý đội xe xem được phần này. Không hiển thị trong danh
          sách tài xế và không gửi cho khách hàng.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="emergencyContactName"
            label="Người liên hệ"
            error={errors.emergencyContactName}
          >
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={initial.emergencyContactName}
            />
          </Field>

          <Field
            id="emergencyContactPhone"
            label="Điện thoại"
            error={errors.emergencyContactPhone}
          >
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              inputMode="tel"
              defaultValue={initial.emergencyContactPhone}
            />
          </Field>
        </div>
      </fieldset>

      <Field
        id="internalNote"
        label="Ghi chú nội bộ"
        error={errors.internalNote}
        hint="Tài xế và khách hàng không nhìn thấy nội dung này."
      >
        <Textarea id="internalNote" name="internalNote" rows={3} defaultValue={initial.internalNote} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/quan-tri/tai-xe")}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
