"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  DELIVERY_OUTCOMES,
  DELIVERY_OUTCOME_LABELS,
  outcomeNeedsReason,
  type DeliveryOutcome,
} from "@/modules/proof-of-delivery/schema";
import { recordDeliveryAction, requestDeliveryOtpAction } from "@/app/tai-xe/actions";

/**
 * Lập biên bản giao hàng tại điểm giao (§18).
 *
 * Hai bước rõ ràng: gửi mã cho người nhận, rồi nhập mã người nhận đọc lại. Mã là bằng chứng
 * có người thật ở đó nhận hàng — GPS không thay thế được (§18).
 *
 * Nhánh "người nhận từ chối" bỏ yêu cầu mã: không có ai đọc mã cho tài xế thì đòi mã là bế
 * tắc, và tài xế sẽ tìm cách lách bằng cách khai man kết quả.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function DeliveryProofForm({ trackingCode }: { trackingCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<DeliveryOutcome>("DELIVERED_FULL");
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const needsOtp = outcome !== "REFUSED";
  const needsReason = outcomeNeedsReason(outcome);

  const sendOtp = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await requestDeliveryOtpAction(trackingCode);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) setOtpSent(result.maskedPhone ?? null);
    });
  };

  const submit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await recordDeliveryAction(trackingCode, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {feedback && (
          <Alert variant={feedback.ok ? "success" : "error"} role="alert">
            {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
            <p>{feedback.message}</p>
          </Alert>
        )}

        <Button className="h-14 w-full text-base" onClick={() => setOpen(true)}>
          <ClipboardCheck className="h-5 w-5" aria-hidden />
          Lập biên bản giao hàng
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4 rounded-lg border border-orange/40 bg-orange/5 p-4">
      <h3 className="text-sm font-bold text-navy">Biên bản giao hàng</h3>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      <Field id="pod-outcome" label="Kết quả giao hàng" required>
        <select
          id="pod-outcome"
          name="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as DeliveryOutcome)}
          className={selectClass}
          disabled={pending}
        >
          {DELIVERY_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {DELIVERY_OUTCOME_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field id="pod-receiver" label="Tên người nhận" required>
        <Input
          id="pod-receiver"
          name="receiverName"
          required
          minLength={2}
          placeholder="Họ tên người ký nhận"
          disabled={pending}
        />
      </Field>

      <Field
        id="pod-relation"
        label="Quan hệ với người đặt"
        hint="VD: chủ nhà, bảo vệ, nhân viên kho"
      >
        <Input id="pod-relation" name="receiverRelation" disabled={pending} />
      </Field>

      {needsReason && (
        <Field
          id="pod-exception"
          label={outcome === "REFUSED" ? "Lý do từ chối nhận" : "Lý do giao thiếu"}
          required
        >
          <Textarea
            id="pod-exception"
            name="exceptionReason"
            rows={2}
            required
            disabled={pending}
          />
        </Field>
      )}

      {needsOtp && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-3">
          <p className="text-xs text-foreground/75">
            Gửi mã tới điện thoại người nhận, rồi nhập mã họ đọc cho bạn.
          </p>

          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={sendOtp}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MessageSquare className="h-4 w-4" aria-hidden />
            )}
            {otpSent ? "Gửi lại mã" : "Gửi mã cho người nhận"}
          </Button>

          {otpSent && <p className="text-xs text-success">Đã gửi tới số {otpSent}</p>}

          <Field id="pod-otp" label="Mã xác nhận" required>
            <Input
              id="pod-otp"
              name="otp"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="6 chữ số"
              autoComplete="off"
              disabled={pending}
            />
          </Field>
        </div>
      )}

      <Field id="pod-condition" label="Tình trạng hàng" hint="Ghi rõ nếu có hư hỏng, móp méo">
        <Textarea id="pod-condition" name="condition" rows={2} disabled={pending} />
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" className="h-12" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang lưu..." : "Xác nhận và hoàn tất"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-12"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Hủy
        </Button>
      </div>

      <p className="text-xs text-muted">
        Biên bản đã lập không sửa được. Nếu ghi sai, liên hệ điều phối để lập biên bản điều
        chỉnh.
      </p>
    </form>
  );
}
