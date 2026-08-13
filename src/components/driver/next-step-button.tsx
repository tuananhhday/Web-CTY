"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS } from "@/modules/incidents/state-machine";
import { advanceStatusAction, reportIncidentAction } from "@/app/tai-xe/actions";

/**
 * Một nút CTA duy nhất cho bước kế tiếp (§26.2).
 *
 * Tài xế không phải chọn trong danh sách 19 trạng thái. Hệ thống biết bước tiếp theo là gì;
 * việc của tài xế chỉ là xác nhận đã làm xong.
 *
 * Bước xác nhận hai lớp: bấm nhầm trên điện thoại khi đang cầm hàng là chuyện thường, mà
 * trạng thái đã đẩy lên thì tài xế không tự lùi lại được (§15 ràng buộc 3).
 */
export function NextStepButton({
  trackingCode,
  currentStatus,
  nextStatus,
}: {
  trackingCode: string;
  currentStatus: ShipmentStatus;
  nextStatus: ShipmentStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "confirm" | "incident">("idle");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const runAdvance = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await advanceStatusAction(trackingCode, currentStatus);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setMode("idle");
        router.refresh();
      }
    });
  };

  const runIncident = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await reportIncidentAction(trackingCode, formData);
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setMode("idle");
        router.refresh();
      }
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

      {mode === "idle" && (
        <>
          {nextStatus ? (
            <Button
              size="lg"
              className="h-14 w-full text-base"
              onClick={() => setMode("confirm")}
              disabled={pending}
            >
              {SHIPMENT_STATUS_LABELS[nextStatus]}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          ) : (
            <Alert variant="info">
              <CheckCircle2 aria-hidden />
              <p>
                Chuyến này không còn bước nào bạn tự cập nhật được. Liên hệ điều phối nếu
                cần thay đổi.
              </p>
            </Alert>
          )}

          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => setMode("incident")}
            disabled={pending}
          >
            <TriangleAlert className="h-4 w-4" aria-hidden />
            Báo sự cố
          </Button>
        </>
      )}

      {mode === "confirm" && nextStatus && (
        <div className="rounded-lg border border-orange/40 bg-orange/5 p-4">
          <p className="text-sm font-semibold text-navy">
            Xác nhận chuyển sang &ldquo;{SHIPMENT_STATUS_LABELS[nextStatus]}&rdquo;?
          </p>
          <p className="mt-1.5 text-sm text-foreground/75">
            Khách hàng nhìn thấy cập nhật này ngay. Bạn không tự quay lại bước trước được.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button className="h-12" onClick={runAdvance} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Đang cập nhật..." : "Xác nhận"}
            </Button>
            <Button
              variant="ghost"
              className="h-12"
              onClick={() => setMode("idle")}
              disabled={pending}
            >
              Quay lại
            </Button>
          </div>
        </div>
      )}

      {mode === "incident" && (
        <form
          action={runIncident}
          className="flex flex-col gap-4 rounded-lg border border-error/25 bg-error-bg p-4"
        >
          <Field id="incident-type" label="Loại sự cố" required>
            <select
              id="incident-type"
              name="type"
              required
              disabled={pending}
              className="flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
            >
              {INCIDENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INCIDENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="incident-reason"
            label="Chuyện gì đang xảy ra?"
            required
            hint="Điều phối đọc được ngay. Ghi ngắn gọn, càng cụ thể càng xử lý nhanh."
          >
            <Textarea
              id="incident-reason"
              name="reason"
              rows={3}
              required
              minLength={10}
              placeholder="VD: Xe thủng lốp tại km 32 quốc lộ 51, cần cứu hộ"
              disabled={pending}
            />
          </Field>

          <div className="mt-4 flex flex-col gap-2">
            <Button type="submit" className="h-12" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Đang gửi..." : "Gửi báo cáo"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12"
              onClick={() => setMode("idle")}
              disabled={pending}
            >
              Hủy
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
