"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useFieldArray, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/shared/field";
import { FormSteps } from "@/components/forms/form-steps";
import { useUnsavedChangesWarning } from "@/components/forms/use-unsaved-changes-warning";
import { freightRequestSchema, type FreightRequestInput } from "@/modules/service-requests/schema";

const STEPS = ["Điểm lấy và giao", "Hàng hóa", "Liên hệ"] as const;

/** Trường thuộc từng bước — dùng để chỉ validate phần đang hiển thị khi bấm "Tiếp tục". */
const STEP_FIELDS: Record<number, (keyof FreightRequestInput | string)[]> = {
  0: ["pickup", "dropoff", "serviceSlug"],
  1: ["items"],
  2: ["contactName", "contactPhone", "contactEmail", "acceptPolicy"],
};

export interface FormOption {
  slug: string;
  name: string;
}

export function FreightRequestForm({
  services,
  vehicleTypes,
  provinces,
}: {
  services: FormOption[];
  vehicleTypes: FormOption[];
  provinces: string[];
}) {
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; guestAccessToken?: string } | null>(null);

  const form = useForm<FreightRequestInput>({
    resolver: zodResolver(freightRequestSchema) as Resolver<FreightRequestInput>,
    mode: "onBlur",
    defaultValues: {
      serviceSlug: services[0]?.slug ?? "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      companyName: "",
      pickup: { line: "", province: provinces[0] ?? "", district: "", ward: "" },
      dropoff: { line: "", province: provinces[0] ?? "", district: "", ward: "" },
      items: [{ cargoType: "", quantity: 1, weightKg: 0, isFragile: false, isValuable: false }],
      needsLoading: false,
      needsPacking: false,
      needsAssembly: false,
      needsHoisting: false,
      note: "",
      website: "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const items = useFieldArray({ control, name: "items" });

  // Chỉ cảnh báo khi người dùng đã nhập gì đó và chưa gửi thành công.
  useUnsavedChangesWarning(isDirty && !result);

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step] as never, { shouldFocus: true });
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (values: FreightRequestInput) => {
    setSubmitError(null);

    try {
      const response = await fetch("/api/public/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        // Lỗi theo từng trường thì gắn vào đúng ô để người dùng thấy ngay chỗ cần sửa.
        const fields = payload?.error?.fields as { path: string; message: string }[] | undefined;
        if (fields?.length) {
          for (const issue of fields) {
            form.setError(issue.path as never, { message: issue.message });
          }
          setStep(0);
        }
        setSubmitError(payload?.error?.message ?? "Không gửi được yêu cầu. Vui lòng thử lại.");
        return;
      }

      setResult(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError(
        "Không kết nối được tới máy chủ. Kiểm tra đường truyền và thử lại."
      );
    }
  };

  // Lỗi ở bước không hiển thị sẽ khiến người dùng bấm gửi mà không thấy gì xảy ra —
  // đưa họ về đúng bước có lỗi.
  const onInvalid = () => {
    for (const [stepIndex, fields] of Object.entries(STEP_FIELDS)) {
      const hasError = fields.some((field) => field in errors);
      if (hasError) {
        setStep(Number(stepIndex));
        setTimeout(() => setFocus(fields[0] as never), 0);
        return;
      }
    }
  };

  if (result) {
    return <SubmissionSuccess code={result.code} guestToken={result.guestAccessToken} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex flex-col gap-8">
      <FormSteps steps={STEPS} currentStep={step} />

      {submitError && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{submitError}</p>
        </Alert>
      )}

      {/* Bẫy bot: ẩn khỏi cả mắt người lẫn trình đọc màn hình, chỉ bot mới điền (§23). */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website-hp">Để trống trường này</label>
        <input id="website-hp" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-8">
          <Field id="serviceSlug" label="Loại dịch vụ" required error={errors.serviceSlug?.message}>
            <select
              id="serviceSlug"
              className="flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
              {...register("serviceSlug")}
            >
              {services.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name}
                </option>
              ))}
            </select>
          </Field>

          <StopFieldset
            legend="Điểm lấy hàng"
            prefix="pickup"
            register={register}
            control={control}
            errors={errors.pickup}
            provinces={provinces}
          />

          <StopFieldset
            legend="Điểm giao hàng"
            prefix="dropoff"
            register={register}
            control={control}
            errors={errors.dropoff}
            provinces={provinces}
          />
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-4">
            <legend className="text-base font-bold text-navy">Danh sách hàng hóa</legend>
            <p className="text-sm text-foreground/70">
              Khai báo càng chi tiết, báo giá càng sát thực tế. Không cần chính xác tuyệt đối —
              ước lượng gần đúng là đủ để bắt đầu.
            </p>

            {typeof errors.items?.message === "string" && (
              <p role="alert" className="text-xs font-medium text-error">
                {errors.items.message}
              </p>
            )}

            <ul className="flex flex-col gap-4">
              {items.fields.map((field, index) => (
                <li key={field.id} className="rounded-lg border border-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-navy">Loại hàng {index + 1}</h3>
                    {items.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => items.remove(index)}
                        aria-label={`Xóa loại hàng ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Xóa
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id={`items.${index}.cargoType`}
                      label="Loại hàng"
                      required
                      className="sm:col-span-2"
                      error={errors.items?.[index]?.cargoType?.message}
                    >
                      <Input
                        id={`items.${index}.cargoType`}
                        placeholder="Ví dụ: Hàng bách hóa đóng thùng carton"
                        {...register(`items.${index}.cargoType`)}
                      />
                    </Field>

                    <Field
                      id={`items.${index}.quantity`}
                      label="Số kiện"
                      required
                      error={errors.items?.[index]?.quantity?.message}
                    >
                      <Input
                        id={`items.${index}.quantity`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </Field>

                    <Field
                      id={`items.${index}.weightKg`}
                      label="Tổng khối lượng (kg)"
                      required
                      error={errors.items?.[index]?.weightKg?.message}
                    >
                      <Input
                        id={`items.${index}.weightKg`}
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        {...register(`items.${index}.weightKg`, { valueAsNumber: true })}
                      />
                    </Field>

                    <div className="flex flex-wrap gap-4 sm:col-span-2">
                      <CheckboxField
                        control={control}
                        name={`items.${index}.isFragile`}
                        label="Hàng dễ vỡ"
                      />
                      <CheckboxField
                        control={control}
                        name={`items.${index}.isValuable`}
                        label="Hàng giá trị cao"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                items.append({
                  cargoType: "",
                  quantity: 1,
                  weightKg: 0,
                  isFragile: false,
                  isValuable: false,
                })
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              Thêm loại hàng
            </Button>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-base font-bold text-navy">Dịch vụ đi kèm</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxField control={control} name="needsLoading" label="Cần nhân công bốc xếp" />
              <CheckboxField control={control} name="needsPacking" label="Cần đóng gói" />
              <CheckboxField control={control} name="needsAssembly" label="Cần tháo lắp" />
              <CheckboxField control={control} name="needsHoisting" label="Cần nâng hạ bằng thiết bị" />
            </div>
          </fieldset>

          {vehicleTypes.length > 0 && (
            <Field id="requestedVehicleTypeSlug" label="Loại xe mong muốn" hint="Không bắt buộc — chúng tôi sẽ tư vấn nếu bạn chưa chắc">
              <select
                id="requestedVehicleTypeSlug"
                className="flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                {...register("requestedVehicleTypeSlug")}
              >
                <option value="">Để chúng tôi tư vấn</option>
                {vehicleTypes.map((vehicle) => (
                  <option key={vehicle.slug} value={vehicle.slug}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="contactName" label="Họ và tên" required error={errors.contactName?.message}>
              <Input id="contactName" autoComplete="name" {...register("contactName")} />
            </Field>

            <Field id="contactPhone" label="Số điện thoại" required error={errors.contactPhone?.message}>
              <Input
                id="contactPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912 345 678"
                {...register("contactPhone")}
              />
            </Field>

            <Field id="contactEmail" label="Email" hint="Không bắt buộc — dùng để gửi link theo dõi yêu cầu" error={errors.contactEmail?.message}>
              <Input id="contactEmail" type="email" autoComplete="email" {...register("contactEmail")} />
            </Field>

            <Field id="companyName" label="Tên doanh nghiệp" hint="Không bắt buộc">
              <Input id="companyName" autoComplete="organization" {...register("companyName")} />
            </Field>
          </div>

          <Field id="note" label="Ghi chú thêm" error={errors.note?.message}>
            <Textarea
              id="note"
              rows={4}
              placeholder="Yêu cầu đặc biệt, khung giờ thuận tiện, lưu ý về hàng hóa..."
              {...register("note")}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2.5">
              <Controller
                name="acceptPolicy"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="acceptPolicy"
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={!!errors.acceptPolicy}
                    className="mt-0.5"
                  />
                )}
              />
              <Label htmlFor="acceptPolicy" className="font-normal leading-relaxed text-foreground/80">
                Tôi đồng ý để công ty sử dụng thông tin trên nhằm xử lý yêu cầu vận chuyển, theo{" "}
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
          <Button type="button" variant="outline" onClick={goBack}>
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
            {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu báo giá"}
          </Button>
        )}
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Thành phần con
// -----------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function StopFieldset({
  legend,
  prefix,
  register,
  control,
  errors,
  provinces,
}: {
  legend: string;
  prefix: "pickup" | "dropoff";
  register: any;
  control: any;
  errors: any;
  provinces: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-bold text-navy">{legend}</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${prefix}.line`}
          label="Địa chỉ"
          required
          className="sm:col-span-2"
          error={errors?.line?.message}
        >
          <Input
            id={`${prefix}.line`}
            placeholder="Số nhà, tên đường"
            autoComplete="street-address"
            {...register(`${prefix}.line`)}
          />
        </Field>

        <Field id={`${prefix}.ward`} label="Phường/Xã">
          <Input id={`${prefix}.ward`} {...register(`${prefix}.ward`)} />
        </Field>

        <Field id={`${prefix}.district`} label="Quận/Huyện">
          <Input id={`${prefix}.district`} {...register(`${prefix}.district`)} />
        </Field>

        <Field
          id={`${prefix}.province`}
          label="Tỉnh/Thành phố"
          required
          className="sm:col-span-2"
          error={errors?.province?.message}
        >
          <select
            id={`${prefix}.province`}
            className="flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
            {...register(`${prefix}.province`)}
          >
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Điều kiện tiếp cận là yếu tố gây phát sinh chi phí nhiều nhất (§11). */}
      <details className="rounded-md border border-border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-navy">
          Điều kiện tiếp cận (tầng, thang máy, khoảng cách bê hàng)
        </summary>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

          <Field id={`${prefix}.carryDistanceM`} label="Khoảng cách bê hàng (m)">
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

          <div className="flex items-end pb-2">
            <CheckboxField control={control} name={`${prefix}.hasElevator`} label="Có thang máy" />
          </div>

          <Field id={`${prefix}.accessNote`} label="Ghi chú lối vào" className="sm:col-span-3">
            <Input
              id={`${prefix}.accessNote`}
              placeholder="Ví dụ: hẻm rộng 3m, xe tải 1.5 tấn vào được"
              {...register(`${prefix}.accessNote`)}
            />
          </Field>
        </div>
      </details>
    </fieldset>
  );
}

function CheckboxField({
  control,
  name,
  label,
}: {
  control: any;
  name: string;
  label: string;
}) {
  const id = `cb-${name.replace(/\./g, "-")}`;

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

function SubmissionSuccess({ code, guestToken }: { code: string; guestToken?: string }) {
  const [copied, setCopied] = useState(false);

  const trackingUrl = guestToken
    ? `${window.location.origin}/tra-cuu?ma=${code}&token=${guestToken}`
    : null;

  return (
    <div className="rounded-lg border border-border bg-white p-6 text-center sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </span>

      <h2 className="mt-5 text-xl font-bold text-navy">Đã nhận được yêu cầu của bạn</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-foreground/70">
        Đội ngũ vận hành sẽ liên hệ trong giờ làm việc để xác nhận thông tin hàng hóa trước khi
        lập báo giá.
      </p>

      <div className="mx-auto mt-6 max-w-sm rounded-md bg-navy/5 px-4 py-3">
        <p className="text-xs text-muted">Mã yêu cầu của bạn</p>
        <p className="mt-1 font-mono text-lg font-bold tracking-wider text-navy">{code}</p>
      </div>

      {trackingUrl && (
        <div className="mx-auto mt-4 max-w-xl">
          <p className="text-sm text-foreground/70">
            Lưu lại liên kết dưới đây để xem tiến trình xử lý. Liên kết có hiệu lực 30 ngày.
          </p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={trackingUrl} aria-label="Liên kết theo dõi yêu cầu" className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(trackingUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Đã chép" : "Chép"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Tạo tài khoản để theo dõi toàn bộ yêu cầu ở một nơi mà không cần giữ liên kết.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        {guestToken ? (
          <Button asChild>
            <Link href="/dang-ky">Tạo tài khoản theo dõi</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/tai-khoan/yeu-cau">Xem yêu cầu của tôi</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
