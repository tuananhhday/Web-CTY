"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  // Không hiển thị stack trace hoặc nội dung lỗi kỹ thuật cho người dùng.
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-error/20 bg-error-bg px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-error">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-2 text-base font-semibold text-error">Không tải được dữ liệu</p>
      <p className="max-w-sm text-sm text-error/85">
        Đã xảy ra sự cố khi hiển thị nội dung. Vui lòng thử lại. Nếu tình trạng tiếp diễn, liên hệ
        bộ phận hỗ trợ.
      </p>
      <Button onClick={reset} variant="outline" className="mt-4">
        <RefreshCcw className="h-4 w-4" aria-hidden />
        Thử lại
      </Button>
    </div>
  );
}
