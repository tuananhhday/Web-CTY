import type { Metadata } from "next";
import { PhoneCall, Mail, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { FreightRequestForm } from "@/components/forms/freight-request-form";
import { getServices, getVehicleTypes, getServiceAreas } from "@/modules/cms/service";
import { company } from "@/config/company";
import { processSteps } from "@/config/site-content";

export const metadata: Metadata = {
  title: "Yêu cầu báo giá",
  description: "Gửi thông tin hàng hóa để nhận báo giá vận chuyển sau khi được xác nhận.",
};

export default async function QuotePage() {
  const [services, vehicleTypes, areas] = await Promise.all([
    getServices(),
    getVehicleTypes(),
    getServiceAreas(),
  ]);

  // Danh sách tỉnh lấy từ khu vực phục vụ đã cấu hình, khử trùng lặp và sắp xếp.
  const provinces = Array.from(new Set(areas.map((area) => area.province))).sort((a, b) =>
    a.localeCompare(b, "vi")
  );

  return (
    <>
      <PageHeader
        title="Yêu cầu báo giá"
        description="Cung cấp thông tin hàng hóa và lộ trình để đội ngũ vận hành xác nhận và phản hồi báo giá."
        breadcrumbs={[{ label: "Báo giá" }]}
      />

      <Container className="py-14 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-bold text-navy">Thông tin yêu cầu</h2>
            <FreightRequestForm
              services={services.map((s) => ({ slug: s.slug, name: s.name }))}
              vehicleTypes={vehicleTypes.map((v) => ({ slug: v.slug, name: v.name }))}
              provinces={provinces}
            />
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-32">
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-base font-bold text-navy">Sau khi gửi yêu cầu</h2>
              <ol className="mt-4 flex flex-col gap-3">
                {processSteps.slice(1, 4).map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                      {step.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-navy">{step.title}</p>
                      <p className="mt-0.5 text-sm text-foreground/70">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-navy p-6 text-white">
              <h2 className="text-base font-bold">Cần hỗ trợ ngay?</h2>
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                <li>
                  <a
                    href={`tel:${company.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 text-white/85 hover:text-white"
                  >
                    <PhoneCall className="h-4 w-4 shrink-0" aria-hidden />
                    {company.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${company.email}`}
                    className="flex items-center gap-2 text-white/85 hover:text-white"
                  >
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    {company.email}
                  </a>
                </li>
                <li className="flex items-start gap-2 text-white/85">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {company.workingHours}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
