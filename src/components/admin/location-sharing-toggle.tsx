"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLocationSharingAction } from "@/app/quan-tri/dieu-phoi/actions";

/**
 * Bật/tắt cho khách xem vị trí chuyến (§17).
 *
 * Mặc định TẮT. Chia sẻ vị trí một người đang làm việc phải là quyết định có chủ ý, không
 * phải trạng thái mặc định — nên nút này nói rõ hệ quả thay vì chỉ là một công tắc.
 */
export function LocationSharingToggle({
  trackingCode,
  enabled,
}: {
  trackingCode: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await setLocationSharingAction(trackingCode, !enabled);
      if (!result.ok) {
        setError(result.message ?? "Không đổi được cài đặt.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground/75">
        {enabled
          ? "Khách hàng đang xem được vị trí xe ở mức khu vực."
          : "Khách hàng không xem được vị trí xe của chuyến này."}
      </p>

      <Button variant="outline" size="sm" onClick={toggle} disabled={pending} className="self-start">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : enabled ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
        {enabled ? "Tắt chia sẻ cho khách" : "Cho khách xem vị trí"}
      </Button>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
