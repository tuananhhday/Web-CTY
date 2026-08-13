import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { company } from "@/config/company";

/**
 * Ép render động cho toàn bộ nhóm `(auth)`.
 *
 * Không phải để lấy dữ liệu mới, mà để CSP nghiêm ngặt theo nonce áp được (§30.1): HTML
 * prerender sinh lúc build không thể mang nonce của request hiện tại, nên trang tĩnh buộc
 * phải dùng mức CSP nới `'unsafe-inline'`. Trang đăng nhập là đích ngắm hàng đầu của XSS
 * đánh cắp thông tin đăng nhập, nên đây là chỗ đáng đổi.
 *
 * Chi phí bằng không: middleware vốn đã đặt `Cache-Control: no-store` cho các trang này,
 * nên prerender không giúp gì.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-white">
        <div className="container-content flex h-16 items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground/70 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Về trang chủ
          </Link>
        </div>
      </header>

      <main id="noi-dung-chinh" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {children}
          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <Link href="/chinh-sach/dieu-khoan" className="font-medium underline hover:text-navy">
              Điều khoản sử dụng
            </Link>{" "}
            và{" "}
            <Link href="/chinh-sach/bao-mat" className="font-medium underline hover:text-navy">
              Chính sách bảo mật
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-5">
        <div className="container-content text-center text-xs text-muted">
          © {new Date().getFullYear()} {company.name}
        </div>
      </footer>
    </div>
  );
}
