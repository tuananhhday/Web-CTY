"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Send, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { issueInvoiceAction, voidInvoiceAction } from "@/app/quan-tri/hoa-don/actions";

/**
 * Phát hành và hủy hóa đơn (§20).
 *
 * Chỉ hai thao tác thủ công. Mọi trạng thái còn lại suy ra từ số tiền đã thu, nên không có
 * ô nào cho nhân viên tự đặt "đã thanh toán".
 */
export function InvoiceStatusForm({
  invoiceNumber,
  canIssue,
  canVoid,
}: {
  invoiceNumber: string;
  canIssue: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voiding, setVoiding] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setVoiding(false);
        router.refresh();
      }
    });
  };

  if (!canIssue && !canVoid) {
    return (
      <p className="text-sm text-foreground/70">
        Hóa đơn đã khép lại, không còn thao tác nào.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-bold text-navy">Thao tác</h2>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      {canIssue && (
        <div className="flex flex-col gap-2">
          <Button disabled={pending} onClick={() => run(() => issueInvoiceAction(invoiceNumber))}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Phát hành hóa đơn
          </Button>
          <p className="text-xs text-muted">
            Sau khi phát hành, nội dung hóa đơn không sửa được nữa. Hạn thanh toán mặc định
            15 ngày.
          </p>
        </div>
      )}

      {canVoid &&
        (voiding ? (
          <form
            action={(formData) => run(() => voidInvoiceAction(invoiceNumber, formData))}
            className="flex flex-col gap-3 rounded-lg border border-error/25 bg-error-bg p-4"
          >
            <Field id="void-reason" label="Lý do hủy" required>
              <Input
                id="void-reason"
                name="reason"
                required
                minLength={5}
                placeholder="VD: lập nhầm khách hàng"
                disabled={pending}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Xác nhận hủy
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVoiding(false)}
                disabled={pending}
              >
                Quay lại
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setVoiding(true)} disabled={pending}>
            <Ban className="h-4 w-4" aria-hidden />
            Hủy hóa đơn
          </Button>
        ))}
    </div>
  );
}
