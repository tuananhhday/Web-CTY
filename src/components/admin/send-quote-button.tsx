"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { sendQuoteAction } from "@/app/quan-tri/bao-gia/actions";

/**
 * Gửi báo giá.
 *
 * Nhãn nút phản ánh đúng việc sẽ xảy ra: vượt ngưỡng thì là "gửi duyệt", không phải
 * "gửi khách" — người bấm cần biết trước kết quả thao tác của mình (§6).
 */
export function SendQuoteButton({
  code,
  needsApproval,
  canApprove,
}: {
  code: string;
  needsApproval: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const willRequireApproval = needsApproval && !canApprove;

  const handleClick = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendQuoteAction(code);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      <Button onClick={handleClick} disabled={pending} size="lg">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        {pending
          ? "Đang xử lý..."
          : willRequireApproval
            ? "Gửi duyệt"
            : "Gửi báo giá cho khách"}
      </Button>

      {willRequireApproval && (
        <p className="text-xs text-muted">
          Báo giá vượt ngưỡng nên sẽ chuyển sang chờ duyệt thay vì gửi thẳng tới khách.
        </p>
      )}
    </div>
  );
}
