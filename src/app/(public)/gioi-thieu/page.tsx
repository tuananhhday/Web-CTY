import type { Metadata } from "next";
import Image from "next/image";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Alert } from "@/components/ui/alert";
import { company } from "@/config/company";
import { getImageSource } from "@/data/image-sources";
import { processSteps } from "@/config/site-content";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: "Giới thiệu về cách thức hoạt động và nguyên tắc phục vụ của doanh nghiệp vận tải.",
};

export default function AboutPage() {
  const image = getImageSource("fleet-warehouse");

  return (
    <>
      <PageHeader
        title="Giới thiệu"
        description={`${company.name} cung cấp dịch vụ vận chuyển hàng hóa với quy trình tiếp nhận, xác nhận và theo dõi rõ ràng.`}
        breadcrumbs={[{ label: "Giới thiệu" }]}
      />

      <Container className="py-14 md:py-16">
        <Alert variant="warning" className="mb-10">
          <Info aria-hidden />
          <p>
            Nội dung giới thiệu dưới đây là bản nháp minh họa. Doanh nghiệp cần cung cấp nội dung
            chính thức (lịch sử hình thành, năng lực, chứng nhận, đối tác) trước khi công bố.
          </p>
        </Alert>

        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-5">
            <SectionHeading
              eyebrow="Về chúng tôi"
              title="Đưa hoạt động vận chuyển về một quy trình rõ ràng"
            />
            <p className="leading-relaxed text-foreground/75">
              Hoạt động vận chuyển hàng hóa thường liên quan đến nhiều bên: khách hàng gửi hàng,
              đội ngũ điều phối, tài xế và người nhận. Việc trao đổi qua nhiều kênh khác nhau dễ dẫn
              đến thiếu thông tin và khó đối chiếu khi có phát sinh.
            </p>
            <p className="leading-relaxed text-foreground/75">
              Nền tảng này được xây dựng để tập trung thông tin yêu cầu vận chuyển, báo giá và trạng
              thái đơn hàng tại một nơi duy nhất, giúp các bên cùng nhìn vào một nguồn dữ liệu.
            </p>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-navy/10">
            <Image
              src={image.url}
              alt={image.description}
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-14">
          <SectionHeading
            eyebrow="Nguyên tắc phục vụ"
            title="Những điều chúng tôi cam kết trong cách làm việc"
          />
          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                title: "Minh bạch thông tin",
                body: "Chỉ công bố thông tin đã được xác nhận, không đưa ra cam kết chưa kiểm chứng.",
              },
              {
                title: "Xác nhận trước khi thực hiện",
                body: "Mọi thông tin hàng hóa và phương tiện đều được xác nhận với khách hàng trước khi triển khai.",
              },
              {
                title: "Lưu vết rõ ràng",
                body: "Yêu cầu, báo giá và trạng thái vận chuyển được lưu lại để đối chiếu khi cần.",
              },
            ].map((item) => (
              <li key={item.title} className="rounded-lg border border-border bg-white p-6">
                <h3 className="text-base font-bold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14">
          <SectionHeading eyebrow="Cách làm việc" title="Quy trình phối hợp với khách hàng" />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {processSteps.map((step) => (
              <li key={step.step} className="rounded-lg border border-border bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                  {step.step}
                </span>
                <h3 className="mt-3 text-sm font-bold text-navy">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 rounded-lg border border-border bg-white p-6">
          <h2 className="text-lg font-bold text-navy">Thông tin doanh nghiệp</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Tên doanh nghiệp</dt>
              <dd className="mt-0.5 font-medium text-navy">{company.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Mã số thuế</dt>
              <dd className="mt-0.5 font-medium text-navy">{company.taxCode}</dd>
            </div>
            <div>
              <dt className="text-muted">Địa chỉ</dt>
              <dd className="mt-0.5 font-medium text-navy">{company.address}</dd>
            </div>
            <div>
              <dt className="text-muted">Giờ làm việc</dt>
              <dd className="mt-0.5 font-medium text-navy">{company.workingHours}</dd>
            </div>
          </dl>
        </div>
      </Container>
    </>
  );
}
