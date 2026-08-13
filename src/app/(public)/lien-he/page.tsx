import type { Metadata } from "next";
import { PhoneCall, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { ContactForm } from "@/components/shared/contact-form";
import { company } from "@/config/company";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Thông tin liên hệ và biểu mẫu gửi yêu cầu tư vấn vận chuyển.",
};

export default function ContactPage() {
  const contactItems = [
    { icon: PhoneCall, label: "Hotline", value: company.phone, href: `tel:${company.phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: "Zalo", value: company.zalo, href: null },
    { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}` },
    { icon: MapPin, label: "Địa chỉ", value: company.address, href: null },
    { icon: Clock, label: "Giờ làm việc", value: company.workingHours, href: null },
  ];

  return (
    <>
      <PageHeader
        title="Liên hệ"
        description="Gửi yêu cầu tư vấn hoặc liên hệ trực tiếp qua hotline trong giờ làm việc."
        breadcrumbs={[{ label: "Liên hệ" }]}
      />

      <Container className="py-14 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-bold text-navy">Gửi yêu cầu tư vấn</h2>
            <ContactForm />
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-32">
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-base font-bold text-navy">Thông tin liên hệ</h2>
              <dl className="mt-5 flex flex-col gap-4 text-sm">
                {contactItems.map((item) => (
                  /* dt và dd phải là con TRỰC TIẾP của div bên trong dl — lồng thêm một
                     cấp div nữa sẽ tạo cấu trúc HTML không hợp lệ. Dùng grid để icon
                     chiếm cột đầu trải hai hàng thay vì bọc dt/dd trong div riêng. */
                  <div
                    key={item.label}
                    className="grid grid-cols-[2.25rem_1fr] items-start gap-x-3"
                  >
                    <span
                      aria-hidden
                      className="row-span-2 flex h-9 w-9 items-center justify-center rounded-md bg-navy/5 text-navy"
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <dt className="text-xs text-muted">{item.label}</dt>
                    <dd className="mt-0.5 font-medium text-navy">
                      {item.href ? (
                        <a href={item.href} className="hover:text-orange-text">
                          {item.value}
                        </a>
                      ) : (
                        item.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-navy/[0.03] p-6">
              <h2 className="text-base font-bold text-navy">Doanh nghiệp</h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Tên doanh nghiệp</dt>
                  <dd className="mt-0.5 font-medium text-navy">{company.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Mã số thuế</dt>
                  <dd className="mt-0.5 font-medium text-navy">{company.taxCode}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
