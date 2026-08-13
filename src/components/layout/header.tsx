"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogIn, ArrowRight } from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { mainNav } from "@/config/nav";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 border-b border-border">
      <TopBar />
      <div className="border-b border-border/60">
        <div className="container-content flex h-16 items-center justify-between md:h-[72px]">
          <Logo />

          <nav aria-label="Điều hướng chính" className="hidden lg:flex lg:items-center lg:gap-1">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text",
                  isActive(item.href)
                    ? "bg-navy/5 text-navy"
                    : "text-foreground/70 hover:text-navy hover:bg-navy/5"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dang-nhap">
                <LogIn className="h-4 w-4" aria-hidden />
                Đăng nhập
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/bao-gia">
                Yêu cầu báo giá
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu điều hướng">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="max-w-[300px]">
              <VisuallyHidden>
                <SheetTitle>Menu điều hướng</SheetTitle>
                <SheetDescription>Danh sách liên kết điều hướng chính của website</SheetDescription>
              </VisuallyHidden>
              <Logo className="mb-2" />
              <nav aria-label="Điều hướng di động" className="flex flex-col gap-1">
                {mainNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3.5 py-3 text-sm font-semibold transition-colors",
                      isActive(item.href)
                        ? "bg-navy/5 text-navy"
                        : "text-foreground/70 hover:text-navy hover:bg-navy/5"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                <Button asChild variant="outline" onClick={() => setOpen(false)}>
                  <Link href="/dang-nhap">
                    <LogIn className="h-4 w-4" aria-hidden />
                    Đăng nhập
                  </Link>
                </Button>
                <Button asChild onClick={() => setOpen(false)}>
                  <Link href="/bao-gia">Yêu cầu báo giá</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
