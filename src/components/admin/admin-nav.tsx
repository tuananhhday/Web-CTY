"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Permission } from "@/modules/auth/permissions";

/**
 * Điều hướng khu vực quản trị.
 *
 * Ẩn mục không có quyền chỉ để giao diện gọn — KHÔNG phải cơ chế bảo vệ. Người dùng gõ
 * thẳng URL vẫn bị guard của trang chặn lại (§30.2).
 */

interface AdminNavItem {
  label: string;
  href: string;
  /** Quyền tối thiểu để thấy mục này. */
  permission: Permission;
  /**
   * Trang đã tồn tại chưa.
   *
   * Danh sách giữ đủ cả mục chưa làm để thấy được bức tranh §3.4, nhưng mục chưa có trang
   * thì KHÔNG render — thà thiếu tab còn hơn đưa người dùng tới trang 404.
   */
  ready?: boolean;
}

const ITEMS: AdminNavItem[] = [
  { label: "Yêu cầu", href: "/quan-tri/yeu-cau", permission: "request.read_all", ready: true },
  { label: "Báo giá", href: "/quan-tri/bao-gia", permission: "quote.read_all", ready: true },
  { label: "Đơn hàng", href: "/quan-tri/don-hang", permission: "shipment.read_all" },
  { label: "Điều phối", href: "/quan-tri/dieu-phoi", permission: "shipment.dispatch", ready: true },
  { label: "Đội xe", href: "/quan-tri/xe", permission: "fleet.read", ready: true },
  { label: "Tài xế", href: "/quan-tri/tai-xe", permission: "fleet.read", ready: true },
  { label: "Bảng giá", href: "/quan-tri/bang-gia", permission: "pricing.manage" },
  { label: "Sự cố", href: "/quan-tri/su-co", permission: "incident.read_all", ready: true },
  { label: "Hỗ trợ", href: "/quan-tri/ho-tro", permission: "support.read_all", ready: true },
  { label: "Hóa đơn", href: "/quan-tri/hoa-don", permission: "invoice.read_all", ready: true },
  { label: "Nội dung", href: "/quan-tri/noi-dung", permission: "cms.read" },
  { label: "Người dùng", href: "/quan-tri/nguoi-dung", permission: "user.read" },
  { label: "Nhật ký", href: "/quan-tri/nhat-ky", permission: "audit.read" },
];

export function AdminNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const granted = new Set(permissions);
  const visible = ITEMS.filter((item) => item.ready && granted.has(item.permission));

  return (
    <nav aria-label="Điều hướng quản trị" className="-mb-px flex gap-1 overflow-x-auto">
      {visible.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text",
              isActive
                ? "border-orange text-navy"
                : "border-transparent text-muted hover:border-border hover:text-navy"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
