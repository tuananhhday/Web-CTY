import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chỉ báo tiến trình cho form nhiều bước (§6).
 *
 * Dùng `<ol>` để công nghệ hỗ trợ hiểu đây là chuỗi có thứ tự, và `aria-current="step"`
 * cho bước đang thực hiện. Trạng thái không chỉ dựa vào màu sắc — bước đã xong có thêm
 * dấu tick, bước hiện tại có chữ đậm (§29: không dùng màu làm tín hiệu duy nhất).
 */
export function FormSteps({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  /** Chỉ số bắt đầu từ 0. */
  currentStep: number;
}) {
  return (
    <nav aria-label="Tiến trình điền biểu mẫu">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
        {steps.map((label, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone && "bg-success text-white",
                  isCurrent && "bg-orange text-navy",
                  !isDone && !isCurrent && "bg-navy/8 text-muted"
                )}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>

              <span
                className={cn(
                  "text-sm",
                  isCurrent ? "font-semibold text-navy" : "text-muted"
                )}
              >
                {label}
                {isDone && <span className="sr-only"> (đã hoàn thành)</span>}
              </span>

              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    isDone ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="sr-only" role="status">
        Bước {currentStep + 1} trên {steps.length}: {steps[currentStep]}
      </p>
    </nav>
  );
}
