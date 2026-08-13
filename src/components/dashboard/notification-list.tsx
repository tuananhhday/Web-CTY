"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, CheckCircle2, AlertTriangle, XCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import { markAllReadAction, markReadAction } from "@/app/tai-khoan/thong-bao/actions";

/**
 * Danh sách thông báo (§21).
 *
 * Bấm vào thông báo vừa đánh dấu đã đọc vừa điều hướng tới nơi liên quan — người dùng bấm
 * là để xem chi tiết, bắt họ bấm thêm nút "đánh dấu đã đọc" là thừa.
 */

export interface NotificationItem {
  id: string;
  eventKey: string;
  severity: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const SEVERITY_CONFIG: Record<string, { icon: typeof Info; className: string }> = {
  INFO: { icon: Info, className: "bg-navy/5 text-navy" },
  SUCCESS: { icon: CheckCircle2, className: "bg-success-bg text-success" },
  WARNING: { icon: AlertTriangle, className: "bg-warning-bg text-warning" },
  ERROR: { icon: XCircle, className: "bg-error-bg text-error" },
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = items.filter((item) => item.readAt === null);

  const handleOpen = (item: NotificationItem) => {
    if (item.readAt === null) {
      startTransition(async () => {
        await markReadAction(item.id);
        if (!item.linkUrl) router.refresh();
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllReadAction();
                router.refresh();
              })
            }
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const config = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.INFO;
          const Icon = config.icon;
          const isUnread = item.readAt === null;

          const inner = (
            <article
              className={`flex gap-4 rounded-lg border bg-white p-5 transition-colors ${
                isUnread ? "border-orange/35 bg-orange/[0.03]" : "border-border"
              } ${item.linkUrl ? "hover:border-orange/60" : ""}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${config.className}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-navy">{item.title}</h2>
                  {isUnread && <Badge variant="orange">Chưa đọc</Badge>}
                </div>
                <p className="mt-1 text-sm text-foreground/70">{item.body}</p>
                <time
                  dateTime={item.createdAt.toISOString()}
                  className="mt-2 block text-xs text-muted"
                >
                  {formatDateTime(item.createdAt)}
                </time>
              </div>
            </article>
          );

          return (
            <li key={item.id}>
              {item.linkUrl ? (
                <Link
                  href={item.linkUrl}
                  onClick={() => handleOpen(item)}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  disabled={!isUnread}
                  className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text disabled:cursor-default"
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
