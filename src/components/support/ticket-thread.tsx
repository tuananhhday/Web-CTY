"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/shared/field";
import { formatDateTime } from "@/lib/datetime";
import { isTicketClosed, type TicketStatus } from "@/modules/support/state-machine";
import { replyAction } from "@/app/tai-khoan/ho-tro/actions";

/**
 * Luồng trao đổi của một phiếu hỗ trợ (§19).
 *
 * Ghi chú nội bộ đã bị lọc TỪ TRUY VẤN nên component này không bao giờ nhận được chúng khi
 * người xem là khách. Nhãn "Nội bộ" chỉ để nhân viên nhìn thấy mình đang xem cái gì, không
 * phải cơ chế bảo vệ.
 */

export interface ThreadMessage {
  id: string;
  body: string;
  visibility: string;
  authorRole: string | null;
  createdAt: Date;
  author: { name: string } | null;
}

export function TicketThread({
  code,
  status,
  messages,
  canWriteInternal,
}: {
  code: string;
  status: TicketStatus;
  messages: ThreadMessage[];
  /** Nhân viên gửi được ghi chú nội bộ; khách thì không. */
  canWriteInternal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [internal, setInternal] = useState(false);

  const closed = isTicketClosed(status);

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await replyAction(code, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setInternal(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-4">
        {messages.map((message) => {
          const isInternal = message.visibility === "INTERNAL";
          const isStaff = message.authorRole !== null && message.authorRole !== "CUSTOMER";

          return (
            <li
              key={message.id}
              className={`rounded-lg border p-4 ${
                isInternal
                  ? "border-warning/30 bg-warning-bg"
                  : isStaff
                    ? "border-border bg-navy/[0.03]"
                    : "border-border bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-navy">
                  {message.author?.name ?? "Hệ thống"}
                </span>
                {isStaff && <Badge variant="neutral">Nhân viên</Badge>}
                {isInternal && (
                  <Badge variant="warning">
                    <Lock className="h-3 w-3" aria-hidden />
                    Nội bộ
                  </Badge>
                )}
                <time
                  dateTime={message.createdAt.toISOString()}
                  className="ml-auto text-xs text-muted"
                >
                  {formatDateTime(message.createdAt)}
                </time>
              </div>

              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {message.body}
              </p>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <Alert variant="info">
          <CheckCircle2 aria-hidden />
          <p>
            Phiếu đã đóng. Nếu cần hỗ trợ tiếp, vui lòng tạo phiếu mới để chúng tôi theo dõi
            rõ ràng từng vụ việc.
          </p>
        </Alert>
      ) : (
        <form action={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-5">
          {feedback && !feedback.ok && (
            <Alert variant="error" role="alert">
              <AlertCircle aria-hidden />
              <p>{feedback.message}</p>
            </Alert>
          )}

          <Field id="reply-body" label="Nội dung trả lời" required>
            <Textarea id="reply-body" name="body" rows={4} required disabled={pending} />
          </Field>

          {canWriteInternal && (
            <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-bg p-3">
              <Checkbox
                id="internal"
                name="internal"
                checked={internal}
                onCheckedChange={(checked) => setInternal(checked === true)}
                disabled={pending}
                className="mt-0.5"
              />
              <Label htmlFor="internal" className="cursor-pointer text-sm font-normal">
                Ghi chú nội bộ
                <span className="mt-0.5 block text-xs text-muted">
                  Khách hàng KHÔNG nhìn thấy nội dung này và trạng thái phiếu không đổi.
                </span>
              </Label>
            </div>
          )}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {pending ? "Đang gửi..." : internal ? "Lưu ghi chú nội bộ" : "Gửi trả lời"}
          </Button>
        </form>
      )}
    </div>
  );
}
