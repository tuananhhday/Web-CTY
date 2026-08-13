import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { requireDriver } from "@/modules/auth/guards";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

/**
 * Khu vực tài xế (§26.2).
 *
 * Thiết kế mobile-first thật sự chứ không phải desktop thu nhỏ: tài xế dùng điện thoại,
 * thường một tay, đôi khi đeo găng. Không có sidebar, không bảng nhiều cột — chỉ một cột
 * với vùng chạm lớn.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Khu vực tài xế", template: "%s | Tài xế" },
  robots: { index: false, follow: false },
};

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  // Lớp bảo vệ thật. Middleware chỉ điều hướng sớm (§30.2).
  const actor = await requireDriver("/tai-xe");

  return (
    <div className="flex min-h-screen flex-col bg-navy/[0.03]">
      <header className="sticky top-0 z-30 border-b border-border bg-navy text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/tai-xe"
            className="flex items-center gap-2 rounded font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Truck className="h-5 w-5" aria-hidden />
            Chuyến của tôi
          </Link>

          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-white/80">{actor.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="noi-dung-chinh" className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {children}
      </main>
    </div>
  );
}
