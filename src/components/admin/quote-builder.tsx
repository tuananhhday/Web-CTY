"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  quoteRevisionSchema,
  QUOTE_LINE_CATEGORIES,
  QUOTE_LINE_CATEGORY_LABELS,
  QUOTE_UNITS,
  type QuoteRevisionInput,
} from "@/modules/quotes/schema";
import { calculateQuoteTotals, requiresApproval } from "@/modules/quotes/pricing";
import { formatMoney } from "@/lib/money";
import { createQuoteAction, createRevisionAction } from "@/app/quan-tri/bao-gia/actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

/**
 * Trình lập báo giá.
 *
 * Tổng tiền tính LẠI ở client để nhân viên thấy ngay khi gõ, nhưng con số ghi vào
 * database là con số server tự tính từ line item — client không gửi tổng lên.
 */
export function QuoteBuilder({
  mode,
  serviceRequestCode,
  quoteCode,
  thresholds,
  defaultValues,
}: {
  mode: "create" | "revise";
  serviceRequestCode?: string;
  quoteCode?: string;
  thresholds: { maxAmountWithoutApproval: string; maxDiscountPercent: number };
  defaultValues?: Partial<QuoteRevisionInput>;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const form = useForm<QuoteRevisionInput>({
    resolver: zodResolver(quoteRevisionSchema) as Resolver<QuoteRevisionInput>,
    mode: "onBlur",
    defaultValues: {
      lineItems: defaultValues?.lineItems ?? [
        {
          description: "Cước vận chuyển",
          category: "TRANSPORT",
          quantity: 1,
          unit: "chuyến",
          unitPrice: "0",
        },
      ],
      discountAmount: defaultValues?.discountAmount ?? "0",
      validityDays: defaultValues?.validityDays ?? 7,
      terms: defaultValues?.terms ?? "",
      note: defaultValues?.note ?? "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const lines = useFieldArray({ control, name: "lineItems" });

  const watchedLines = useWatch({ control, name: "lineItems" });
  const watchedDiscount = useWatch({ control, name: "discountAmount" });

  // Xem trước tổng tiền. Dữ liệu đang gõ có thể chưa hợp lệ nên bọc try/catch —
  // không để lỗi tính toán làm sập form khi người dùng mới gõ nửa chừng.
  const preview = useMemo(() => {
    try {
      const items = (watchedLines ?? []).filter(
        (item) => item?.unitPrice && Number(item.quantity) > 0
      );
      if (items.length === 0) return null;

      const totals = calculateQuoteTotals(
        items.map((item) => ({
          description: item.description ?? "",
          category: item.category ?? "OTHER",
          quantity: Number(item.quantity) || 0,
          unit: item.unit ?? "",
          unitPrice: item.unitPrice ?? "0",
          discountAmount: item.discountAmount,
          taxPercent: item.taxPercent,
        })),
        watchedDiscount || 0
      );

      const approval = requiresApproval(totals, thresholds);
      return { totals, approval };
    } catch {
      return null;
    }
  }, [watchedLines, watchedDiscount, thresholds]);

  const onSubmit = async (values: QuoteRevisionInput) => {
    setFeedback(null);

    const result =
      mode === "create"
        ? await createQuoteAction({ ...values, serviceRequestCode })
        : await createRevisionAction(quoteCode as string, values);

    setFeedback({ ok: result.ok, message: result.message ?? "" });

    if (result.ok && result.code) {
      router.push(`/quan-tri/bao-gia/${result.code}`);
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="text-base font-bold text-navy">Các dòng chi phí</legend>

        {typeof errors.lineItems?.message === "string" && (
          <p role="alert" className="text-sm font-medium text-error">
            {errors.lineItems.message}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {lines.fields.map((field, index) => (
            <li key={field.id} className="rounded-lg border border-border bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-12">
                <Field
                  id={`li-${index}-desc`}
                  label="Nội dung"
                  required
                  className="lg:col-span-4"
                  error={errors.lineItems?.[index]?.description?.message}
                >
                  <Input id={`li-${index}-desc`} {...register(`lineItems.${index}.description`)} />
                </Field>

                <Field id={`li-${index}-cat`} label="Nhóm" required className="lg:col-span-2">
                  <select
                    id={`li-${index}-cat`}
                    className={selectClass}
                    {...register(`lineItems.${index}.category`)}
                  >
                    {QUOTE_LINE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {QUOTE_LINE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id={`li-${index}-qty`}
                  label="SL"
                  required
                  className="lg:col-span-1"
                  error={errors.lineItems?.[index]?.quantity?.message}
                >
                  <Input
                    id={`li-${index}-qty`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                  />
                </Field>

                <Field id={`li-${index}-unit`} label="Đơn vị" required className="lg:col-span-2">
                  <select
                    id={`li-${index}-unit`}
                    className={selectClass}
                    {...register(`lineItems.${index}.unit`)}
                  >
                    {QUOTE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id={`li-${index}-price`}
                  label="Đơn giá (đ)"
                  required
                  className="lg:col-span-3"
                  error={errors.lineItems?.[index]?.unitPrice?.message}
                >
                  <Input
                    id={`li-${index}-price`}
                    inputMode="numeric"
                    placeholder="1500000"
                    {...register(`lineItems.${index}.unitPrice`)}
                  />
                </Field>
              </div>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-md">
                  <Field
                    id={`li-${index}-disc`}
                    label="Giảm giá dòng (đ)"
                    error={errors.lineItems?.[index]?.discountAmount?.message}
                  >
                    <Input
                      id={`li-${index}-disc`}
                      inputMode="numeric"
                      placeholder="0"
                      {...register(`lineItems.${index}.discountAmount`)}
                    />
                  </Field>
                  <Field id={`li-${index}-tax`} label="Thuế (%)">
                    <Input
                      id={`li-${index}-tax`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      {...register(`lineItems.${index}.taxPercent`, {
                        setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
                      })}
                    />
                  </Field>
                </div>

                {lines.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => lines.remove(index)}
                    aria-label={`Xóa dòng ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Xóa dòng
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            lines.append({
              description: "",
              category: "SURCHARGE",
              quantity: 1,
              unit: "lần",
              unitPrice: "0",
            })
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Thêm dòng
        </Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="discountAmount"
          label="Giảm giá toàn báo giá (đ)"
          error={errors.discountAmount?.message}
        >
          <Input id="discountAmount" inputMode="numeric" {...register("discountAmount")} />
        </Field>

        <Field id="validityDays" label="Hiệu lực (ngày)" error={errors.validityDays?.message}>
          <Input
            id="validityDays"
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            {...register("validityDays", { valueAsNumber: true })}
          />
        </Field>
      </div>

      {preview && (
        <div className="rounded-lg border border-border bg-navy/5 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Tạm tính</h3>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/70">Thành tiền</dt>
              <dd className="tabular-nums">{formatMoney(preview.totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/70">
                Giảm giá{" "}
                {preview.totals.discountPercent > 0 && `(${preview.totals.discountPercent}%)`}
              </dt>
              <dd className="tabular-nums">−{formatMoney(preview.totals.discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/70">Thuế</dt>
              <dd className="tabular-nums">{formatMoney(preview.totals.taxAmount)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2">
              <dt className="font-bold text-navy">Tổng cộng</dt>
              <dd className="text-lg font-bold tabular-nums text-navy">
                {formatMoney(preview.totals.totalAmount)}
              </dd>
            </div>
          </dl>

          {preview.approval.required && (
            <Alert variant="warning" className="mt-4">
              <ShieldAlert aria-hidden />
              <div>
                <p className="font-semibold">Báo giá này cần được duyệt trước khi gửi khách</p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.approval.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}
        </div>
      )}

      <Field id="terms" label="Điều khoản" error={errors.terms?.message}>
        <Textarea
          id="terms"
          rows={4}
          placeholder="Điều kiện thanh toán, thời gian thực hiện, phạm vi công việc..."
          {...register("terms")}
        />
      </Field>

      <Field id="note" label="Ghi chú nội bộ" hint="Khách hàng không nhìn thấy ghi chú này">
        <Textarea id="note" rows={2} {...register("note")} />
      </Field>

      <div className="flex justify-end border-t border-border pt-6">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting
            ? "Đang lưu..."
            : mode === "create"
              ? "Tạo báo giá"
              : "Tạo phiên bản mới"}
        </Button>
      </div>
    </form>
  );
}
