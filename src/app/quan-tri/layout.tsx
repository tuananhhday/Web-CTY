import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/modules/auth/guards";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Container } from "@/components/shared/container";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Khu vực quản trị.
 *
 * `requireStaff` chỉ chặn ở mức "có phải nhân viên không". Phân quyền chi tiết theo từng
 * chức năng nằm ở mỗi trang và mỗi service — một EDITOR vào được layout này nhưng vẫn
 * không mở được trang điều phối (§30.2).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s | Quản trị" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaff("/quan-tri");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden rounded-md bg-navy px-2 py-1 text-xs font-bold uppercase tracking-wide text-white sm:inline">
              Quản trị
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-navy">{actor.name}</p>
              <p className="text-xs text-muted">{actor.roles.join(", ")}</p>
            </div>
            <SignOutButton />
          </div>
        </Container>
      </header>

      <div className="border-b border-border bg-white">
        <Container>
          {/* Chỉ hiển thị mục người dùng có quyền — nhưng đây chỉ là tiện ích giao diện,
              bảo vệ thật nằm ở guard của từng trang. */}
          <AdminNav permissions={Array.from(actor.permissions)} />
        </Container>
      </div>

      <main id="noi-dung-chinh" className="flex-1 py-8">
        <Container>{children}</Container>
      </main>

      <footer className="border-t border-border bg-white py-4">
        <Container className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>Khu vực nội bộ. Mọi thao tác đều được ghi nhật ký.</span>
          <Link href="/" className="hover:text-navy">
            Về trang chủ
          </Link>
        </Container>
      </footer>
    </div>
  );
}
