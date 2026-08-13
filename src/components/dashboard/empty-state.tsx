import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-navy/40">
        <Inbox className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-2 text-base font-semibold text-navy">{title}</p>
      <p className="max-w-sm text-sm text-foreground/65">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
