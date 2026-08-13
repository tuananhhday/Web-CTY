"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useFieldArray, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/shared/field";
import { FormSteps } from "@/components/forms/form-steps";
import { useUnsavedChangesWarning } from "@/components/forms/use-unsaved-changes-warning";
import {
  movingRequestSchema,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  type MovingRequestInput,
} from "@/modules/service-requests/schema";

const STEPS = ["Địa điểm", "Đồ đạc", "Dịch vụ và liên hệ"] as const;

const STEP_FIELDS: Record<number, string[]> = {
  0: ["propertyType", "origin", "destination"],
  1: ["inventoryItems"],
  2: ["contactName", "contactPhone", "acceptPolicy"],
};

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function MovingRequestForm({ provinces }: { provinces: string[] }) {
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string } | null>(null);

  const form = useForm<MovingRequestInput>({
    resolver: zodResolver(movingRequestSchema) as Resolver<MovingRequestInput>,
    mode: "onBlur",
    defaultValues: {
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      propertyType: "APARTMENT",
      origin: { line: "", province: provinces[0] ?? "" },
      destination: { line: "", province: provinces[0] ?? "" },
      inventoryItems: [
        { category: "FURNITURE", name: "", quantity: 1, isFragile: false, isHighValue: false, needsDisassembly: false },
      ],
      needsCartons: false,
      needsPacking: false,
      needsDisassembly: false,
      needsCleaning: false,
      requestsSiteSurvey: false,
      note: "",
      website: "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const inventory = useFieldArray({ control, name: "inventoryItems" });

  // Dùng useWatch thay cho watch(): watch() trả về hàm không memoize an toàn, khiến
  // React Compiler bỏ qua tối ưu cho cả component.
  const wantsSurvey = useWatch({ control, name: "requestsSiteSurvey" });
  const wantsCartons = useWatch({ control, name: "needsCartons" });

  useUnsavedChangesWarning(isDirty && !result);

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step] as never, { shouldFocus: true });
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (values: MovingRequestInput) => {
    setSubmitError(null);

    try {
      const response = await fetch("/api/public/moving-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        const fields = payload?.error?.fields as { path: string; message: string }[] | undefined;
        for (const issue of fields ?? []) {
          form.setError(issue.path as never, { message: issue.message });
        }
        setSubmitError(payload?.error?.message ?? "Không gửi được yêu cầu. Vui lòng thử lại.");
        return;
      }

      setResult(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Không kết nối được tới máy chủ. Kiểm tra đường truyền và thử lại.");
    }
  };

  if (result) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-bold text-navy">Đã nhận được yêu cầu chuyển nhà</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-foreground/70">
          {wantsSurvey
            ? "Chúng tôi sẽ liên hệ để hẹn lịch khảo sát tại chỗ trước khi báo giá."
            : "Đội ngũ vận hành sẽ liên hệ xác nhận danh sách đồ đạc và điều kiện tiếp cận."}
        </p>
        <div className="mx-auto mt-6 max-w-sm rounded-md bg-navy/5 px-4 py-3">
          <p className="text-xs text-muted">Mã yêu cầu của bạn</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider text-navy">{result.code}</p>
        </div>
        <Button asChild className="mt-8">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <FormSteps steps={STEPS} currentStep={step} />

      {submitError && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{submitError}</p>
        </Alert>
      )}

      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="mv-website">Để trống trường này</label>
        <input id="mv-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-8">
          <Field id="propertyType" label="Loại hình" required error={errors.propertyType?.message}>
            <select id="propertyType" className={selectClass} {...register("propertyType")}>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>

          <MovingAddress
            legend="Nơi chuyển đi"
            prefix="origin"
            register={register}
            control={control}
            errors={errors.origin}
            provinces={provinces}
          />

          <MovingAddress
            legend="Nơi chuyển đến"
            prefix="destination"
            register={register}
            control={control}
            errors={errors.destination}
            provinces={provinces}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="preferredDate" label="Ngày mong muốn" hint="Không bắt buộc">
              <Input id="preferredDate" type="date" {...register("preferredDate")} />
            </Field>
            <Field id="preferredTimeSlot" label="Khung giờ mong muốn" hint="Ví dụ: buổi sáng, sau 17h">
              <Input id="preferredTimeSlot" {...register("preferredTimeSlot")} />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-base font-bold text-navy">Danh sách đồ đạc</h2>
            <p className="mt-1.5 text-sm text-foreground/70">
              Liệt kê theo nhóm giúp chúng tôi chọn đúng loại xe và số nhân công. Nếu đồ quá
              nhiều, bạn có thể chọn yêu cầu khảo sát tại chỗ ở bước sau thay vì liệt kê hết.
            </p>
          </div>

          {typeof errors.inventoryItems?.message === "string" && (
            <Alert variant="warning" role="alert">
              <AlertCircle aria-hidden />
              <p>{errors.inventoryItems.message}</p>
            </Alert>
          )}

          <ul className="flex flex-col gap-3">
            {inventory.fields.map((field, index) => (
              <li key={field.id} className="rounded-lg border border-border bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Field id={`inv-${index}-category`} label="Nhóm" required>
                    <select
                      id={`inv-${index}-category`}
                      className={selectClass}
                      {...register(`inventoryItems.${index}.category`)}
                    >
                      {INVENTORY_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {INVENTORY_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    id={`inv-${index}-name`}
                    label="Tên đồ đạc"
                    required
                    error={errors.inventoryItems?.[index]?.name?.message}
                  >
                    <Input
                      id={`inv-${index}-name`}
                      placeholder="Ví dụ: Tủ quần áo 3 cánh"
                      {...register(`inventoryItems.${index}.name`)}
                    />
                  </Field>

                  <Field
                    id={`inv-${index}-quantity`}
                    label="SL"
                    required
                    className="w-20"
                    error={errors.inventoryItems?.[index]?.quantity?.message}
                  >
                    <Input
                      id={`inv-${index}-quantity`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      {...register(`inventoryItems.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-4">
                    <InlineCheckbox control={control} name={`inventoryItems.${index}.isFragile`} label="Dễ vỡ" />
                    <InlineCheckbox control={control} name={`inventoryItems.${index}.isHighValue`} label="Giá trị cao" />
                    <InlineCheckbox
                      control={control}
                      name={`inventoryItems.${index}.needsDisassembly`}
                      label="Cần tháo lắp"
                    />
                  </div>

                  {inventory.fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => inventory.remove(index)}
                      aria-label={`Xóa dòng ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Xóa
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                inventory.append({
                  category: "FURNITURE",
                  name: "",
                  quantity: 1,
                  isFragile: false,
                  isHighValue: false,
                  needsDisassembly: false,
                })
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              Thêm đồ đạc
            </Button>
            <Badge variant="neutral">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              {inventory.fields.length} dòng
            </Badge>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-base font-bold text-navy">Dịch vụ đi kèm</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineCheckbox control={control} name="needsPacking" label="Cần đóng gói" />
              <InlineCheckbox control={control} name="needsDisassembly" label="Cần tháo lắp nội thất" />
              <InlineCheckbox control={control} name="needsCartons" label="Cần cung cấp thùng carton" />
              <InlineCheckbox control={control} name="needsCleaning" label="Cần vệ sinh sau khi chuyển" />
            </div>

            {wantsCartons && (
              <Field id="cartonQuantity" label="Số thùng carton cần" className="max-w-40">
                <Input
                  id="cartonQuantity"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...register("cartonQuantity", {
                    setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
                  })}
                />
              </Field>
            )}
          </fieldset>

          <div className="rounded-lg border border-orange/30 bg-orange/5 p-4">
            <InlineCheckbox
              control={control}
              name="requestsSiteSurvey"
              label="Tôi muốn được khảo sát trực tiếp trước khi báo giá"
            />
            <p className="mt-2 pl-8 text-sm text-foreground/70">
              Với khối lượng lớn hoặc lối đi phức tạp, khảo sát tại chỗ cho phương án sát thực tế
              hơn nhiều so với mô tả qua điện thoại.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mvName" label="Họ và tên" required error={errors.contactName?.message}>
              <Input id="mvName" autoComplete="name" {...register("contactName")} />
            </Field>
            <Field id="mvPhone" label="Số điện thoại" required error={errors.contactPhone?.message}>
              <Input
                id="mvPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912 345 678"
                {...register("contactPhone")}
              />
            </Field>
            <Field id="mvEmail" label="Email" hint="Không bắt buộc" error={errors.contactEmail?.message}>
              <Input id="mvEmail" type="email" autoComplete="email" {...register("contactEmail")} />
            </Field>
          </div>

          <Field id="mvNote" label="Ghi chú thêm" error={errors.note?.message}>
            <Textarea id="mvNote" rows={4} {...register("note")} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2.5">
              <Controller
                name="acceptPolicy"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="mvAcceptPolicy"
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={!!errors.acceptPolicy}
                    className="mt-0.5"
                  />
                )}
              />
              <Label htmlFor="mvAcceptPolicy" className="font-normal leading-relaxed text-foreground/80">
                Tôi đồng ý để công ty sử dụng thông tin trên nhằm xử lý yêu cầu, theo{" "}
                <Link href="/chinh-sach/bao-mat" className="font-semibold text-orange-text hover:underline">
                  Chính sách bảo mật
                </Link>
                .
              </Label>
            </div>
            {errors.acceptPolicy && (
              <p role="alert" className="text-xs font-medium text-error">
                {errors.acceptPolicy.message}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Quay lại
          </Button>
        ) : (
          <span />
        )}

        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={goNext}>
            Tiếp tục
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </Button>
        )}
      </div>
    </form>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function MovingAddress({
  legend,
  prefix,
  register,
  control,
  errors,
  provinces,
}: {
  legend: string;
  prefix: "origin" | "destination";
  register: any;
  control: any;
  errors: any;
  provinces: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-bold text-navy">{legend}</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}.line`} label="Địa chỉ" required className="sm:col-span-2" error={errors?.line?.message}>
          <Input id={`${prefix}.line`} placeholder="Số nhà, tên đường" {...register(`${prefix}.line`)} />
        </Field>

        <Field id={`${prefix}.district`} label="Quận/Huyện">
          <Input id={`${prefix}.district`} {...register(`${prefix}.district`)} />
        </Field>

        <Field id={`${prefix}.province`} label="Tỉnh/Thành phố" required error={errors?.province?.message}>
          <select id={`${prefix}.province`} className={selectClass} {...register(`${prefix}.province`)}>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </Field>

        {/* Tầng và thang máy là yếu tố quyết định chi phí nhân công (§12). */}
        <Field id={`${prefix}.floorNumber`} label="Tầng">
          <Input
            id={`${prefix}.floorNumber`}
            type="number"
            inputMode="numeric"
            {...register(`${prefix}.floorNumber`, {
              setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
            })}
          />
        </Field>

        <Field id={`${prefix}.carryDistanceM`} label="Khoảng cách từ chỗ đỗ xe tới cửa (m)">
          <Input
            id={`${prefix}.carryDistanceM`}
            type="number"
            min={0}
            inputMode="numeric"
            {...register(`${prefix}.carryDistanceM`, {
              setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
            })}
          />
        </Field>

        <div className="sm:col-span-2">
          <InlineCheckbox control={control} name={`${prefix}.hasElevator`} label="Có thang máy" />
        </div>
      </div>
    </fieldset>
  );
}

function InlineCheckbox({ control, name, label }: { control: any; name: string; label: string }) {
  const id = `mv-${name.replace(/\./g, "-")}`;

  return (
    <div className="flex items-center gap-2.5">
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Checkbox
            id={id}
            checked={field.value === true}
            onCheckedChange={(v) => field.onChange(v === true)}
          />
        )}
      />
      <Label htmlFor={id} className="font-normal text-foreground/80">
        {label}
      </Label>
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */
