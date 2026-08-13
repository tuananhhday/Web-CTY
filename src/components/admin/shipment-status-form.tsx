"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  allowedTransitions,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_FAILURE_REASONS,
  REASON_CODE_REQUIRED_STATUSES,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { changeShipmentStatusAction } from "@/app/quan-tri/dieu-phoi/actions";

/**
 * Đổi trạng thái đơn hàng (§15).
 *
 * Danh sách trạng thái đích lấy trực tiếp từ state machine theo vai trò điều phối, không
 * hardcode. Server kiểm tra lại toàn bộ — giao diện chỉ để người dùng không phải đoán.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function ShipmentStatusForm({
  trackingCode,
  currentStatus,
  hasProofOfDelivery,
}: {
  trackingCode: string;
  currentStatus: ShipmentStatus;
  hasProofOfDelivery: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [selected, setSelected] = useState<string>("");

  // Chỉ hiện bước dispatcher được phép — tài xế dùng giao diện riêng.
  const transitions = allowedTransitions(currentStatus).filter((t) =>
    t.by.includes("DISPATCHER")
  );

  const chosen = transitions.find((t) => t.to === selected);
  const reasonRequired = chosen?.requiresReason ?? false;
  const needsReasonCode = REASON_CODE_REQUIRED_STATUSES.includes(selected as ShipmentStatus);

  // §15 ràng buộc 2: chặn ngay trên giao diện, và service chặn lần nữa.
  const completeBlocked = selected === "COMPLETED" && !hasProofOfDelivery;

  if (transitions.length === 0) {
    return (
      <Alert variant="info">
        <Flag aria-hidden />
        <p>
          Đơn hàng đã ở trạng thái kết thúc. Lịch sử được giữ nguyên — nếu cần vận chuyển
          lại, hãy tạo đơn mới từ báo giá.
        </p>
      </Alert>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await changeShipmentStatusAction(trackingCode, formData);
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

      <Field id="toStatus" label="Chuyển sang" required>
        <select
          id="toStatus"
          name="toStatus"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={selectClass}
        >
          <option value="">— Chọn trạng thái —</option>
          {transitions.map((transition) => (
            <option key={transition.to} value={transition.to}>
              {SHIPMENT_STATUS_LABELS[transition.to]}
              {transition.requiresReason ? " (cần lý do)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {completeBlocked && (
        <Alert variant="warning">
          <AlertCircle aria-hidden />
          <p>
            Chưa có bằng chứng giao hàng. Cần lập biên bản giao hàng trước khi hoàn tất đơn
            này.
          </p>
        </Alert>
      )}

      {needsReasonCode && (
        <Field id="reasonCode" label="Mã lý do" required>
          <select id="reasonCode" name="reasonCode" required className={selectClass}>
            <option value="">— Chọn mã lý do —</option>
            {SHIPMENT_FAILURE_REASONS.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        id="reason"
        label="Diễn giải"
        required={reasonRequired}
        hint={
          reasonRequired
            ? "Bước chuyển này bắt buộc nhập lý do. Lý do lưu vào lịch sử đơn hàng."
            : "Không bắt buộc."
        }
      >
        <Textarea id="reason" name="reason" rows={3} required={reasonRequired} />
      </Field>

      <Button type="submit" disabled={pending || !selected || completeBlocked}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Đang cập nhật..." : "Cập nhật trạng thái"}
      </Button>
    </form>
  );
}
