import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung chờ cho các form auth đọc query string.
 * Giữ đúng chiều cao của form thật để tránh layout nhảy khi form được hydrate.
 */
export function AuthFormSkeleton({ title, rows = 2 }: { title: string; rows?: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy">{title}</h1>
      <Skeleton className="mt-2 h-4 w-3/4" />

      <div className="mt-6 flex flex-col gap-4" aria-hidden>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="mt-2 h-12 w-full" />
      </div>

      <span className="sr-only" role="status">
        Đang tải biểu mẫu
      </span>
    </div>
  );
}
