import Link from "next/link";
import { Truck } from "lucide-react";
import { company } from "@/config/company";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";

  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text",
        isLight ? "text-white" : "text-navy",
        className
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md",
          isLight ? "bg-white text-navy" : "bg-navy text-white"
        )}
      >
        <Truck className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-extrabold tracking-tight">{company.shortName}</span>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            isLight ? "text-white/60" : "text-muted"
          )}
        >
          Vận tải hàng hóa
        </span>
      </span>
    </Link>
  );
}
