"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { calculateInvoiceTotals } from "@/modules/invoices/totals";
import { formatMoney } from "@/lib/money";
import { createInvoiceAction } from "@/app/quan-tri/hoa-don/actions";

/**
 * Lập hóa đơn (§20).
 *
 * Tổng tiền tính lại NGAY TRÊN GIAO DIỆN bằng đúng module `totals.ts` mà server dùng, nên
 * con số kế toán nhìn thấy trước khi bấm lưu luôn khớp với con số được ghi vào database.
 * Dùng hai công thức khác nhau ở hai phía là cách chắc chắn để sinh ra khiếu nại.
 */

export interface DraftLine {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  discountAmount?: string;
  taxPercent?: number;
}

export interface InvoiceDraft {
  trackingCode?: string;
  billingName: string;
  billingEmail: string;
  discountAmount: string;
  lines: DraftLine[];
}

const EMPTY_LINE: DraftLine = {
  description: "",
  quantity: 1,
  unit: "chuyến",
  unitPrice: "0",
};

export function InvoiceBuilder({ draft }: { draft: InvoiceDraft }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<DraftLine[]>(
    draft.lines.length > 0 ? draft.lines : [{ ...EMPTY_LINE }]
  );
  const [discountAmount, setDiscountAmount] = useState(draft.discountAmount || "0");

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  };

  /**
   * Xem trước chỉ tính khi mọi dòng đều hợp lệ về mặt định dạng — gọi `calculateInvoiceTotals`
   * với chuỗi rỗng sẽ ném lỗi từ Decimal và làm hỏng cả trang khi người dùng đang gõ dở.
   */
  const preview = (() => {
    try {
      return calculateInvoiceTotals(
        lines.map((line) => ({
          ...line,
          unitPrice: /^\d+$/.test(line.unitPrice) ? line.unitPrice : "0",
          discountAmount: /^\d+$/.test(line.discountAmount ?? "") ? line.discountAmount : "0",
        })),
        /^\d+$/.test(discountAmount) ? discountAmount : "0"
      );
    } catch {
      return null;
    }
  })();

  const handleSubmit = (formData: FormData) => {
    setError(null);

    startTransition(async () => {
      const result = await createInvoiceAction({
        trackingCode: draft.trackingCode || undefined,
        billingName: String(formData.get("billingName") ?? ""),
        billingTaxCode: String(formData.get("billingTaxCode") ?? "") || undefined,
        billingAddress: String(formData.get("billingAddress") ?? "") || undefined,
        billingEmail: String(formData.get("billingEmail") ?? "") || undefined,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount || undefined,
          taxPercent: line.taxPercent,
        })),
        discountAmount: discountAmount || undefined,
        note: String(formData.get("note") ?? "") || undefined,
        internalNote: String(formData.get("internalNote") ?? "") || undefined,
      });

      if (!result.ok) {
        setError(result.message ?? "Không lập được hóa đơn.");
        return;
      }

      router.push(`/quan-tri/hoa-don/${result.invoiceNumber}`);
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{error}</p>
        </Alert>
      )}

      <section aria-labelledby="ben-mua" className="flex flex-col gap-4">
        <h2 id="ben-mua" className="text-base font-bold text-navy">
          Thông tin xuất hóa đơn
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="billingName" label="Tên đơn vị" required>
            <Input
              id="billingName"
              name="billingName"
              required
              defaultValue={draft.billingName}
              disabled={pending}
            />
          </Field>

          <Field id="billingTaxCode" label="Mã số thuế">
            <Input id="billingTaxCode" name="billingTaxCode" disabled={pending} />
          </Field>

          <Field id="billingEmail" label="Email nhận hóa đơn">
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={draft.billingEmail}
              disabled={pending}
            />
          </Field>

          <Field id="billingAddress" label="Địa chỉ">
            <Input id="billingAddress" name="billingAddress" disabled={pending} />
          </Field>
        </div>

        <p className="text-xs text-muted">
          Thông tin này được lưu thành bản chụp trên hóa đơn, không thay đổi khi khách cập nhật
          hồ sơ về sau.
        </p>
      </section>

      <section aria-labelledby="dong-chi-phi" className="flex flex-col gap-4">
        <h2 id="dong-chi-phi" className="text-base font-bold text-navy">
          Các dòng chi phí
        </h2>

        <ul className="flex flex-col gap-4">
          {lines.map((line, index) => (
            <li
              key={index}
              className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[2fr_repeat(4,1fr)_auto]"
            >
              <Field id={`li-${index}-desc`} label="Nội dung" required>
                <Input
                  id={`li-${index}-desc`}
                  value={line.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })}
                  required
                  minLength={2}
                  disabled={pending}
                />
              </Field>

              <Field id={`li-${index}-qty`} label="SL" required>
                <Input
                  id={`li-${index}-qty`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: Number(event.target.value) })
                  }
                  required
                  disabled={pending}
                />
              </Field>

              <Field id={`li-${index}-unit`} label="Đơn vị" required>
                <Input
                  id={`li-${index}-unit`}
                  value={line.unit}
                  onChange={(event) => updateLine(index, { unit: event.target.value })}
                  required
                  disabled={pending}
                />
              </Field>

              <Field id={`li-${index}-price`} label="Đơn giá (đ)" required>
                <Input
                  id={`li-${index}-price`}
                  inputMode="numeric"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                  required
                  disabled={pending}
                />
              </Field>

              <Field id={`li-${index}-tax`} label="Thuế (%)">
                <Input
                  id={`li-${index}-tax`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={line.taxPercent ?? ""}
                  onChange={(event) =>
                    updateLine(index, {
                      taxPercent: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                  disabled={pending}
                />
              </Field>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Xóa dòng ${index + 1}`}
                  disabled={pending || lines.length === 1}
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={pending}
          onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Thêm dòng
        </Button>
      </section>

      <section aria-labelledby="tong-ket" className="flex flex-col gap-4">
        <h2 id="tong-ket" className="text-base font-bold text-navy">
          Tổng kết
        </h2>

        <Field id="discountAmount" label="Giảm giá toàn hóa đơn (đ)">
          <Input
            id="discountAmount"
            inputMode="numeric"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
            disabled={pending}
          />
        </Field>

        {preview && (
          <dl className="ml-auto flex w-full max-w-xs flex-col gap-2 rounded-lg border border-border bg-navy/[0.03] p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Thành tiền</dt>
              <dd className="tabular-nums text-navy">{formatMoney(preview.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Giảm giá</dt>
              <dd className="tabular-nums text-navy">−{formatMoney(preview.discountAmount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Thuế</dt>
              <dd className="tabular-nums text-navy">{formatMoney(preview.taxAmount)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <dt className="font-bold text-navy">Tổng cộng</dt>
              <dd className="font-bold tabular-nums text-navy">
                {formatMoney(preview.totalAmount)}
              </dd>
            </div>
          </dl>
        )}

        <Field id="note" label="Ghi chú trên hóa đơn" hint="Khách hàng đọc được nội dung này.">
          <Textarea id="note" name="note" rows={2} disabled={pending} />
        </Field>

        <Field id="internalNote" label="Ghi chú nội bộ" hint="Khách hàng KHÔNG nhìn thấy.">
          <Textarea id="internalNote" name="internalNote" rows={2} disabled={pending} />
        </Field>
      </section>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang lập..." : "Lập hóa đơn nháp"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/quan-tri/hoa-don")}
          disabled={pending}
        >
          Hủy
        </Button>
      </div>

      <p className="text-xs text-muted">
        Hóa đơn được lập ở trạng thái nháp. Kiểm tra lại rồi mới phát hành cho khách.
      </p>
    </form>
  );
}
