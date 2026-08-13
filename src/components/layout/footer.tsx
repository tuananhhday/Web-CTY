import Link from "next/link";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { company } from "@/config/company";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/layout/logo";
import {
  footerServiceLinks,
  footerQuickLinks,
  footerPolicyLinks,
} from "@/config/nav";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-navy text-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Logo variant="light" />
          <p className="text-sm text-white/70">{company.slogan}</p>
          <div className="flex flex-col gap-2 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              {company.phone}
            </span>
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              {company.email}
            </span>
            <span className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              {company.address}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {company.workingHours}
            </span>
          </div>
        </div>

        <nav aria-label="Dịch vụ" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Dịch vụ</h3>
          {footerServiceLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/80 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Liên kết nhanh" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Liên kết nhanh</h3>
          {footerQuickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/80 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Chính sách" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Chính sách</h3>
          {footerPolicyLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/80 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/60 sm:flex-row">
          <p>
            © {year} {company.name}. MST: {company.taxCode}.
          </p>
          <p>
            Nội dung minh họa cho giai đoạn phát triển giao diện. Vui lòng không sử dụng để giao dịch thật.
          </p>
        </Container>
      </div>
    </footer>
  );
}
