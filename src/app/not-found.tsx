import Link from "next/link";
import { Home, Search, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Container } from "@/components/shared/container";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="noi-dung-chinh" className="flex flex-1 items-center py-20">
        <Container className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/5 text-navy">
            <PackageX className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-widest text-orange-text">Lỗi 404</p>
          <h1 className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">
            Không tìm thấy trang bạn yêu cầu
          </h1>
          <p className="mt-3 max-w-md text-foreground/70">
            Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Bạn có thể quay lại trang chủ hoặc
            tra cứu vận đơn.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden />
                Về trang chủ
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tra-cuu">
                <Search className="h-4 w-4" aria-hidden />
                Tra cứu vận đơn
              </Link>
            </Button>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
