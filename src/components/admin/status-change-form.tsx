"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  allowedTransitions,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@/modules/service-requests/state-machine";
import { changeRequestStatusAction } from "@/app/quan-tri/yeu-cau/[code]/actions";

/**
 * Đổi trạng thái yêu cầu.
 *
 * Danh sách trạng thái đích lấy TRỰC TIẾP từ state machine, không hardcode — nhân viên
 * chỉ thấy những bước hợp lệ. Server vẫn kiểm tra lại vì giao diện không phải lớp bảo vệ.
 */
export function StatusChangeForm({
  code,
  currentStatus,
}: {
  code: string;
  currentStatus: RequestStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [selected, setSelected] = useState<string>("");

  const transitions = allowedTransitions(currentStatus);
  const chosen = transitions.find((t) => t.to === selected);
  const reasonRequired = chosen?.requiresReason ?? false;

  if (transitions.length === 0) {
    return (
      <Alert variant="info">
        <CheckCircle2 aria-hidden />
        <p>
          Yêu cầu đã ở trạng thái kết thúc. Không thể chuyển tiếp — nếu cần xử lý lại, hãy tạo
          yêu cầu mới để giữ nguyên lịch sử.
        </p>
      </Alert>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await changeRequestStatusAction(code, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) setSelected("");
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
          className="flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
        >
          <option value="">— Chọn trạng thái —</option>
          {transitions.map((transition) => (
            <option key={transition.to} value={transition.to}>
              {REQUEST_STATUS_LABELS[transition.to]}
              {transition.requiresReason ? " (cần lý do)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="reason"
        label="Lý do"
        required={reasonRequired}
        hint={
          reasonRequired
            ? "Bước chuyển này bắt buộc nhập lý do. Lý do được lưu vào lịch sử và khách hàng đọc được."
            : "Không bắt buộc. Nếu nhập, lý do sẽ hiển thị trong tiến trình xử lý của khách."
        }
      >
        <Textarea id="reason" name="reason" rows={3} required={reasonRequired} />
      </Field>

      <Button type="submit" disabled={pending || !selected}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Đang cập nhật..." : "Cập nhật trạng thái"}
      </Button>
    </form>
  );
}
