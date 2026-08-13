"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from "@/modules/support/state-machine";
import { changeStatusAction } from "@/app/tai-khoan/ho-tro/actions";

/**
 * Đổi trạng thái phiếu hỗ trợ (§19).
 *
 * Danh sách bước lấy từ state machine, không hardcode. Lý do nhập ở đây được lưu thành
 * TIN NHẮN cho khách đọc chứ không giấu trong nhật ký hệ thống — khách có quyền biết vì sao
 * phiếu của mình được đánh dấu đã xử lý.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function TicketStatusForm({
  code,
  transitions,
}: {
  code: string;
  transitions: readonly { to: TicketStatus; requiresNote?: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const chosen = transitions.find((transition) => transition.to === selected);
  const noteRequired = chosen?.requiresNote ?? false;

  if (transitions.length === 0) {
    return (
      <Alert variant="info">
        <Flag aria-hidden />
        <p>Phiếu đã đóng, không còn bước chuyển nào.</p>
      </Alert>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await changeStatusAction(
        code,
        String(formData.get("toStatus") ?? ""),
        String(formData.get("note") ?? "") || undefined
      );

      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setSelected("");
        router.refresh();
      }
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-base font-bold text-navy">Cập nhật trạng thái</h2>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      <Field id="ticket-status" label="Chuyển sang" required>
        <select
          id="ticket-status"
          name="toStatus"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={selectClass}
          disabled={pending}
        >
          <option value="">— Chọn trạng thái —</option>
          {transitions.map((transition) => (
            <option key={transition.to} value={transition.to}>
              {TICKET_STATUS_LABELS[transition.to]}
              {transition.requiresNote ? " (cần giải thích)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="ticket-note"
        label="Nội dung gửi khách"
        required={noteRequired}
        hint="Nội dung này hiển thị trong luồng trao đổi của khách hàng."
      >
        <Textarea
          id="ticket-note"
          name="note"
          rows={3}
          required={noteRequired}
          disabled={pending}
        />
      </Field>

      <Button type="submit" disabled={pending || !selected}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Đang cập nhật..." : "Cập nhật"}
      </Button>
    </form>
  );
}
