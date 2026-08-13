"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { TICKET_TYPES, TICKET_TYPE_LABELS } from "@/modules/support/state-machine";
import { createTicketAction } from "@/app/tai-khoan/ho-tro/actions";

/**
 * Khách tạo phiếu hỗ trợ (§19).
 *
 * Không có ô chọn mức ưu tiên: khách tự chọn thì ai cũng chọn khẩn cấp và mức ưu tiên mất
 * hết ý nghĩa. Hệ thống suy ra từ loại phiếu.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function CreateTicketForm({
  shipments,
}: {
  /** Đơn hàng của khách, để gắn phiếu vào đúng chuyến. */
  shipments: { trackingCode: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createTicketAction(formData);

      if (!result.ok) {
        setError(result.message ?? "Không tạo được phiếu.");
        return;
      }

      setOpen(false);
      router.push(`/tai-khoan/ho-tro/${result.code}`);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Tạo yêu cầu hỗ trợ
      </Button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5"
    >
      <h2 className="text-base font-bold text-navy">Yêu cầu hỗ trợ mới</h2>

      {error && (
        <Alert variant="error" role="alert">
          <AlertCircle aria-hidden />
          <p>{error}</p>
        </Alert>
      )}

      <Field id="ticket-type" label="Loại yêu cầu" required>
        <select id="ticket-type" name="type" className={selectClass} disabled={pending}>
          {TICKET_TYPES.map((type) => (
            <option key={type} value={type}>
              {TICKET_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      {shipments.length > 0 && (
        <Field
          id="ticket-shipment"
          label="Liên quan đến đơn hàng"
          hint="Bỏ trống nếu câu hỏi không thuộc đơn nào"
        >
          <select
            id="ticket-shipment"
            name="trackingCode"
            className={selectClass}
            disabled={pending}
          >
            <option value="">— Không thuộc đơn nào —</option>
            {shipments.map((shipment) => (
              <option key={shipment.trackingCode} value={shipment.trackingCode}>
                {shipment.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field id="ticket-subject" label="Tiêu đề" required>
        <Input
          id="ticket-subject"
          name="subject"
          required
          minLength={5}
          placeholder="Tóm tắt ngắn gọn vấn đề"
          disabled={pending}
        />
      </Field>

      <Field
        id="ticket-body"
        label="Mô tả chi tiết"
        required
        hint="Càng cụ thể càng xử lý nhanh: thời gian, địa điểm, số kiện hàng liên quan"
      >
        <Textarea id="ticket-body" name="body" rows={5} required minLength={20} disabled={pending} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang gửi..." : "Gửi yêu cầu"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
