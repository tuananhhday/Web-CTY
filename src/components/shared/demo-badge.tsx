import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Nhãn bắt buộc cho mọi chức năng mô phỏng — không để người dùng hiểu nhầm là hệ thống thật. */
export function DemoBadge({ label = "DEMO_MODE", className }: { label?: string; className?: string }) {
  return (
    <Badge variant="warning" className={cn("font-semibold", className)}>
      <FlaskConical className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
