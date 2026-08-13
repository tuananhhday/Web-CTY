"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  MEDIA_STAGES,
  MEDIA_STAGE_LABELS,
  type MediaStage,
} from "@/modules/media/schema";
import { ALLOWED_MIME_TYPES, maxSizeFor } from "@/modules/media/file-types";

/**
 * Tải ảnh và video theo giai đoạn (§16.3).
 *
 * Ba bước gọi mạng, chạy tuần tự cho từng tệp:
 *   1. `POST /api/uploads/intent` — xin phép, nhận mã tệp và đích tải lên
 *   2. `PUT` thẳng lên đích đó — nội dung không đi qua server ứng dụng
 *   3. `POST /api/uploads/confirm` — server xác minh magic bytes rồi mới cho hiển thị
 *
 * Tải từng tệp một chứ không song song: tài xế thường dùng 3G/4G, chạy song song làm nghẽn
 * và khó biết tệp nào lỗi.
 */

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

interface UploadOutcome {
  fileName: string;
  ok: boolean;
  message?: string;
}

async function uploadOne(input: {
  file: File;
  trackingCode: string;
  stage: MediaStage;
  visibility: "INTERNAL" | "CUSTOMER";
}): Promise<UploadOutcome> {
  const { file, trackingCode, stage, visibility } = input;

  const limit = maxSizeFor(file.type);
  if (limit === null) {
    return { fileName: file.name, ok: false, message: "Định dạng tệp không được hỗ trợ." };
  }
  if (file.size > limit) {
    return {
      fileName: file.name,
      ok: false,
      message: `Tệp lớn hơn giới hạn ${Math.round(limit / 1024 / 1024)}MB.`,
    };
  }

  const intentResponse = await fetch("/api/uploads/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trackingCode,
      stage,
      mimeType: file.type,
      sizeBytes: file.size,
      visibility,
      capturedAt: new Date(file.lastModified).toISOString(),
    }),
  });

  const intent = await intentResponse.json();
  if (!intentResponse.ok) {
    return {
      fileName: file.name,
      ok: false,
      message: intent?.error?.message ?? "Không xin được quyền tải lên.",
    };
  }

  const putResponse = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: file,
  });

  if (!putResponse.ok) {
    return { fileName: file.name, ok: false, message: "Tải tệp lên thất bại." };
  }

  const confirmResponse = await fetch("/api/uploads/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaId: intent.mediaId }),
  });

  if (!confirmResponse.ok) {
    const error = await confirmResponse.json();
    return {
      fileName: file.name,
      ok: false,
      message: error?.error?.message ?? "Tệp không qua được bước kiểm tra.",
    };
  }

  return { fileName: file.name, ok: true };
}

export function MediaUpload({
  trackingCode,
  defaultStage,
}: {
  trackingCode: string;
  defaultStage: MediaStage;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [stage, setStage] = useState<MediaStage>(defaultStage);
  const [shareWithCustomer, setShareWithCustomer] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = [...fileList];
    setOutcomes([]);

    startTransition(async () => {
      const results: UploadOutcome[] = [];

      for (const [index, file] of files.entries()) {
        setProgress(`Đang tải ${index + 1}/${files.length}: ${file.name}`);
        results.push(
          await uploadOne({
            file,
            trackingCode,
            stage,
            visibility: shareWithCustomer ? "CUSTOMER" : "INTERNAL",
          })
        );
      }

      setProgress(null);
      setOutcomes(results);
      if (inputRef.current) inputRef.current.value = "";
      if (results.some((r) => r.ok)) router.refresh();
    });
  };

  const failed = outcomes.filter((outcome) => !outcome.ok);
  const succeeded = outcomes.filter((outcome) => outcome.ok);

  return (
    <div className="flex flex-col gap-4">
      <Field id="media-stage" label="Giai đoạn" required>
        <select
          id="media-stage"
          value={stage}
          onChange={(event) => setStage(event.target.value as MediaStage)}
          className={selectClass}
          disabled={pending}
        >
          {MEDIA_STAGES.map((value) => (
            <option key={value} value={value}>
              {MEDIA_STAGE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="share-customer"
          checked={shareWithCustomer}
          onCheckedChange={(checked) => setShareWithCustomer(checked === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <Label htmlFor="share-customer" className="cursor-pointer text-sm font-normal">
          Cho khách hàng xem
          <span className="mt-0.5 block text-xs text-muted">
            Không tick thì chỉ nhân viên công ty xem được.
          </span>
        </Label>
      </div>

      {/*
        `capture` gợi ý mở thẳng camera trên điện thoại. Vẫn cho chọn từ thư viện vì tài xế
        có thể chụp trước rồi tải lên sau khi có sóng.
      */}
      <input
        ref={inputRef}
        id="media-files"
        type="file"
        multiple
        accept={ALLOWED_MIME_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
        disabled={pending}
      />

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-4 w-4" aria-hidden />
        )}
        {pending ? "Đang tải..." : "Chụp hoặc chọn ảnh"}
      </Button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {progress && <p className="text-xs text-muted">{progress}</p>}

        {succeeded.length > 0 && (
          <Alert variant="success">
            <CheckCircle2 aria-hidden />
            <p>Đã tải lên {succeeded.length} tệp.</p>
          </Alert>
        )}

        {failed.length > 0 && (
          <Alert variant="error" role="alert">
            <AlertCircle aria-hidden />
            <div>
              <p className="font-semibold">{failed.length} tệp không tải được</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {failed.map((outcome) => (
                  <li key={outcome.fileName}>
                    {outcome.fileName}: {outcome.message}
                  </li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
      </div>
    </div>
  );
}
