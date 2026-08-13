"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/modules/incidents/state-machine";
import {
  changeIncidentStatusAction,
  updateIncidentAction,
} from "@/app/quan-tri/su-co/actions";

/**
 * Cập nhật sự cố (§19).
 *
 * Hai việc tách bạch: đổi trạng thái xử lý, và điều chỉnh mức độ sau khi xác minh. Gộp làm
 * một sẽ khiến việc hạ mức độ bị lẫn vào việc kết luận, mà hai quyết định đó khác nhau.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

export function IncidentStatusForm({
  code,
  currentSeverity,
  transitions,
}: {
  code: string;
  currentSeverity: IncidentSeverity;
  transitions: readonly { to: IncidentStatus; requiresResolution?: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const chosen = transitions.find((transition) => transition.to === selected);
  const resolutionRequired = chosen?.requiresResolution ?? false;

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setSelected("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      {transitions.length === 0 ? (
        <Alert variant="info">
          <Flag aria-hidden />
          <p>Sự cố đã đóng. Nếu phát sinh vấn đề mới, hãy ghi nhận sự cố mới.</p>
        </Alert>
      ) : (
        <form
          action={(formData) => run(() => changeIncidentStatusAction(code, formData))}
          className="flex flex-col gap-4"
        >
          <h2 className="text-base font-bold text-navy">Cập nhật xử lý</h2>

          <Field id="incident-status" label="Chuyển sang" required>
            <select
              id="incident-status"
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
                  {INCIDENT_STATUS_LABELS[transition.to]}
                  {transition.requiresResolution ? " (cần kết luận)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="incident-resolution"
            label="Kết luận và cách xử lý"
            required={resolutionRequired}
            hint="Ghi rõ đã làm gì để khép lại sự cố. Nội dung này lưu vĩnh viễn trong hồ sơ."
          >
            <Textarea
              id="incident-resolution"
              name="resolution"
              rows={4}
              required={resolutionRequired}
              disabled={pending}
            />
          </Field>

          <Button type="submit" disabled={pending || !selected}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Đang cập nhật..." : "Cập nhật"}
          </Button>
        </form>
      )}

      <form
        action={(formData) => run(() => updateIncidentAction(code, formData))}
        className="flex flex-col gap-3 border-t border-border pt-5"
      >
        <Field
          id="incident-severity"
          label="Mức độ nghiêm trọng"
          hint="Điều chỉnh sau khi xác minh thực tế tại hiện trường."
        >
          <select
            id="incident-severity"
            name="severity"
            defaultValue={currentSeverity}
            className={selectClass}
            disabled={pending}
          >
            {INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {INCIDENT_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          Lưu mức độ
        </Button>
      </form>
    </div>
  );
}
