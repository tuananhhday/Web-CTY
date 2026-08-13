import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { OrganizationJsonLd } from "@/components/shared/organization-json-ld";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="noi-dung-chinh" className="flex-1">
        {children}
      </main>
      <Footer />
      {/* Structured data cấp site, chỉ phát ở khu vực public (§28). */}
      <OrganizationJsonLd />
    </>
  );
}
