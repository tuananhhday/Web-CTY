import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMovingService, getServiceAreas } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { MovingRequestForm } from "@/components/forms/moving-request-form";

export const metadata: Metadata = {
  title: "Yêu cầu chuyển nhà",
  description:
    "Gửi thông tin đồ đạc và điều kiện tiếp cận để nhận phương án chuyển nhà, chuyển văn phòng.",
  alternates: { canonical: "/chuyen-nha/yeu-cau" },
  robots: { index: false, follow: true },
};

export default async function MovingRequestPage() {
  const [service, areas] = await Promise.all([getMovingService(), getServiceAreas()]);

  // Doanh nghiệp chưa bật dịch vụ chuyển nhà thì không nhận yêu cầu (§3.1).
  if (!service) notFound();

  const provinces = Array.from(new Set(areas.map((area) => area.province))).sort((a, b) =>
    a.localeCompare(b, "vi")
  );

  return (
    <Container className="pb-16">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: service.name, href: "/chuyen-nha" },
          { label: "Gửi yêu cầu" },
        ]}
      />

      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">Yêu cầu chuyển nhà</h1>
        <p className="mt-3 text-foreground/70">
          Điền thông tin bên dưới để chúng tôi chuẩn bị phương án. Nếu đồ đạc nhiều hoặc lối đi
          phức tạp, bạn có thể yêu cầu khảo sát trực tiếp thay vì liệt kê chi tiết.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-white p-6 sm:p-8">
          <MovingRequestForm provinces={provinces} />
        </div>
      </div>
    </Container>
  );
}
