"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ReceiptText,
  Package,
  LifeBuoy,
  Bell,
  UserRound,
  Truck,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { dashboardNav } from "@/config/dashboard-nav";
import { cn } from "@/lib/utils";

/**
 * Icon phải khai báo ở đây mới hiện đúng — thiếu thì rơi về icon mặc định và mọi mục trông
 * giống nhau. Danh sách này phải khớp với `dashboardNav`.
 */
const icons: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  ReceiptText,
  Package,
  LifeBuoy,
  Bell,
  UserRound,
};

/**
 * Lối sang khu vực khác cho người có nhiều vai trò.
 *
 * Sau khi đăng nhập, mọi người đều đáp xuống `/tai-khoan`. Không có khối này thì tài xế
 * không có bất kỳ liên kết nào dẫn tới màn hình chuyến của mình — họ phải tự gõ `/tai-xe`
 * vào thanh địa chỉ, điều mà không ai đoán được.
 *
 * Chỉ hiện khi người dùng THẬT SỰ có vai trò tương ứng. Đây là tiện lợi, không phải kiểm
 * soát truy cập — bản thân các khu vực đó vẫn tự kiểm quyền ở server (§30.2).
 */
interface WorkspaceLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function DashboardNav({
  onNavigate,
  workspaces = [],
}: {
  onNavigate?: () => void;
  /** Khu vực khác mà người dùng này vào được. Rỗng với khách hàng thuần. */
  workspaces?: readonly ("driver" | "staff")[];
}) {
  const pathname = usePathname();

  const workspaceLinks: WorkspaceLink[] = [];
  if (workspaces.includes("driver")) {
    workspaceLinks.push({ href: "/tai-xe", label: "Khu vực tài xế", icon: Truck });
  }
  if (workspaces.includes("staff")) {
    workspaceLinks.push({ href: "/quan-tri", label: "Khu vực quản trị", icon: Building2 });
  }

  return (
    <nav aria-label="Điều hướng khu vực khách hàng" className="flex flex-col gap-1">
      {dashboardNav.map((item) => {
        const Icon = icons[item.icon] ?? LayoutDashboard;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text",
              active
                ? "bg-navy text-white"
                : "text-foreground/70 hover:bg-navy/5 hover:text-navy"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      {workspaceLinks.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="px-3.5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Chuyển khu vực
          </p>
          {workspaceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
            >
              <link.icon className="h-4 w-4 shrink-0" aria-hidden />
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
