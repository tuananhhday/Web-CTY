"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export function DashboardShell({
  children,
  userName,
  userEmail,
  workspaces,
}: {
  children: React.ReactNode;
  /** Tên người dùng đã đăng nhập, do Server Component truyền xuống. */
  userName: string;
  userEmail?: string;
  /** Khu vực khác người dùng vào được, để hiện lối chuyển trong nav. */
  workspaces?: readonly ("driver" | "staff")[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="container-content flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Mở menu khu vực khách hàng"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="max-w-[280px]">
                <VisuallyHidden>
                  <SheetTitle>Menu khu vực khách hàng</SheetTitle>
                  <SheetDescription>Điều hướng giữa các trang trong khu vực khách hàng</SheetDescription>
                </VisuallyHidden>
                <Logo className="mb-4" />
                <DashboardNav onNavigate={() => setOpen(false)} workspaces={workspaces} />
              </SheetContent>
            </Sheet>
            <Logo />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-navy">{userName}</p>
              {userEmail && <p className="text-xs text-muted">{userEmail}</p>}
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="container-content flex flex-1 gap-8 py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">
            <DashboardNav workspaces={workspaces} />
          </div>
        </aside>

        <main id="noi-dung-chinh" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
