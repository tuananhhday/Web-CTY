"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createShipmentAction } from "@/app/quan-tri/dieu-phoi/actions";

/** Tạo đơn hàng từ một báo giá đã chốt. */
export function CreateShipmentButton({ quoteCode }: { quoteCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await createShipmentAction({ quoteCode });

      if (!result.ok) {
        setError(result.message ?? "Không tạo được đơn hàng.");
        return;
      }

      // Chuyển thẳng sang trang phân công — đó là việc tiếp theo cần làm.
      router.push(`/quan-tri/dieu-phoi/${result.trackingCode}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={handleClick} disabled={pending} size="sm">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Truck className="h-4 w-4" aria-hidden />
        )}
        {pending ? "Đang tạo..." : "Tạo đơn hàng"}
      </Button>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
