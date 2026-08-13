"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { releaseAssignmentAction } from "@/app/quan-tri/dieu-phoi/actions";

/**
 * Gỡ phân công hiện tại.
 *
 * Bắt buộc nhập lý do: bản ghi cũ không bị xoá mà được đánh dấu hết hiệu lực, nên lý do
 * là thứ duy nhất giải thích được vì sao đổi tài xế khi đọc lại lịch sử (§14.3).
 */
export function ReleaseAssignmentForm({ trackingCode }: { trackingCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await releaseAssignmentAction(trackingCode, formData);
      if (!result.ok) {
        setError(result.message ?? "Không gỡ được phân công.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Unlink className="h-4 w-4" aria-hidden />
        Gỡ phân công
      </Button>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <Field id="reason" label="Lý do gỡ phân công" required>
        <Input id="reason" name="reason" required minLength={3} placeholder="Ví dụ: xe hỏng đột xuất" />
      </Field>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Đang gỡ..." : "Xác nhận gỡ"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
