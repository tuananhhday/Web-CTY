"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { acceptQuoteAction, declineQuoteAction } from "@/app/tai-khoan/bao-gia/actions";

/**
 * Khách chấp nhận hoặc từ chối báo giá.
 *
 * `revisionNumber` gửi kèm để server đối chiếu: nếu nhân viên vừa gửi phiên bản mới,
 * thao tác bị từ chối và khách được yêu cầu xem lại thay vì chấp nhận nhầm bản cũ (§13.3).
 */
export function QuoteResponse({
  code,
  revisionNumber,
  totalLabel,
}: {
  code: string;
  revisionNumber: number;
  totalLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "confirmAccept" | "decline">("idle");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const runAccept = () => {
    setFeedback(null);
    const formData = new FormData();
    formData.set("revisionNumber", String(revisionNumber));

    startTransition(async () => {
      const result = await acceptQuoteAction(code, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setMode("idle");
        router.refresh();
      }
    });
  };

  const runDecline = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await declineQuoteAction(code, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setMode("idle");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      {mode === "idle" && (
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={() => setMode("confirmAccept")} disabled={pending}>
            <Check className="h-4 w-4" aria-hidden />
            Chấp nhận báo giá
          </Button>
          <Button variant="outline" onClick={() => setMode("decline")} disabled={pending}>
            <X className="h-4 w-4" aria-hidden />
            Từ chối
          </Button>
        </div>
      )}

      {/* Bước xác nhận: chấp nhận báo giá là cam kết tài chính, không nên chỉ một cú bấm. */}
      {mode === "confirmAccept" && (
        <div className="rounded-lg border border-orange/40 bg-orange/5 p-4">
          <p className="text-sm font-semibold text-navy">
            Xác nhận chấp nhận báo giá phiên bản {revisionNumber}?
          </p>
          <p className="mt-1.5 text-sm text-foreground/75">
            Tổng chi phí <strong className="text-navy">{totalLabel}</strong>. Sau khi chấp nhận,
            báo giá được khoá lại và chúng tôi bắt đầu sắp xếp phương tiện.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={runAccept} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Đang xử lý..." : "Xác nhận chấp nhận"}
            </Button>
            <Button variant="outline" onClick={() => setMode("idle")} disabled={pending}>
              Quay lại
            </Button>
          </div>
        </div>
      )}

      {mode === "decline" && (
        <form action={runDecline} className="rounded-lg border border-border bg-white p-4">
          <Field
            id="decline-reason"
            label="Lý do từ chối"
            required
            hint="Cho chúng tôi biết vì sao để có thể điều chỉnh phương án phù hợp hơn."
          >
            <Textarea id="decline-reason" name="reason" rows={3} required minLength={5} />
          </Field>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Đang gửi..." : "Gửi phản hồi"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")} disabled={pending}>
              Hủy
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
