"use client";

import { useEffect } from "react";

/**
 * Cảnh báo trước khi rời trang nếu form đang có dữ liệu chưa gửi (§6).
 *
 * Trình duyệt không cho tuỳ biến nội dung hộp thoại này vì lý do bảo mật — mọi trình
 * duyệt hiện đại đều hiển thị thông báo mặc định của riêng nó.
 */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Một số trình duyệt cũ vẫn cần returnValue được gán để hiện hộp thoại.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
