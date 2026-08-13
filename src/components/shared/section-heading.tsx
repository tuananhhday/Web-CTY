import { cn } from "@/lib/utils";

/**
 * Tiêu đề cho một khối nội dung.
 *
 * `as` quyết định cấp heading. Mặc định `h2` vì phần lớn trường hợp là khối bên trong
 * một trang đã có `h1`. Khi khối này ĐÓNG VAI TRÒ tiêu đề chính của trang, truyền
 * `as="h1"` — mỗi trang phải có đúng một `h1` và thứ tự heading không được nhảy cấp (§29).
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Heading = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-wider text-orange-text">
          {eyebrow}
        </span>
      )}
      <Heading className="text-2xl font-bold text-navy sm:text-3xl">{title}</Heading>
      {description && (
        <p className={cn("max-w-2xl text-foreground/70", align === "center" && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
