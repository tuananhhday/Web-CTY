import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { company } from "@/config/company";
import { clientEnv } from "@/lib/env";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const DESCRIPTION =
  "Nền tảng vận chuyển hàng hóa: gửi yêu cầu, nhận báo giá và theo dõi trạng thái đơn hàng minh bạch.";

export const metadata: Metadata = {
  // metadataBase để Next.js chuyển canonical và ảnh OG tương đối thành URL tuyệt đối (§28).
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${company.name} | ${company.slogan}`,
    template: `%s | ${company.shortName}`,
  },
  description: DESCRIPTION,
  applicationName: company.shortName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: company.shortName,
    title: `${company.name} | ${company.slogan}`,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${company.name} | ${company.slogan}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: true, address: false, email: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a href="#noi-dung-chinh" className="skip-link">
          Bỏ qua đến nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
