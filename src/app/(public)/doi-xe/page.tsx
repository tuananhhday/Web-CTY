import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getVehicleTypes } from "@/modules/cms/service";
import { getVehicleImage } from "@/lib/vehicle-image";

export const metadata: Metadata = {
  title: "Đội xe",
  description: "Các nhóm phương tiện phục vụ vận chuyển hàng hóa theo từng nhu cầu.",
};

export default async function FleetPage() {
  const vehicleTypes = await getVehicleTypes();

  return (
    <>
      <PageHeader
        title="Đội xe và phương tiện"
        description="Nhóm phương tiện được phân loại theo khối lượng và tính chất hàng hóa cần vận chuyển."
        breadcrumbs={[{ label: "Đội xe" }]}
      />

      <Container className="py-14 md:py-16">
        <Alert variant="warning" className="mb-10">
          <Info aria-hidden />
          <p>
            Thông tin nhóm phương tiện là nội dung minh họa. Số lượng xe, tải trọng cụ thể và tình
            trạng khả dụng cần được doanh nghiệp cung cấp trước khi công bố.
          </p>
        </Alert>

        <div className="flex flex-col gap-8">
          {vehicleTypes.map((vehicle, index) => {
            const image = getVehicleImage(vehicle);
            const isReversed = index % 2 === 1;

            return (
              <article
                key={vehicle.id}
                id={vehicle.slug}
                className="grid items-center gap-6 overflow-hidden rounded-lg border border-border bg-white lg:grid-cols-2 lg:gap-0 scroll-mt-32"
              >
                <div
                  className={`relative aspect-[16/10] w-full bg-navy/10 lg:aspect-auto lg:h-full lg:min-h-[260px] ${
                    isReversed ? "lg:order-2" : ""
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={`${vehicle.name} — ${image.description}`}
                    fill
                    loading="lazy"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-col gap-3 p-6 lg:p-8">
                  <h2 className="text-xl font-bold text-navy">{vehicle.name}</h2>
                  <p className="leading-relaxed text-foreground/75">{vehicle.description}</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Phù hợp với
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {vehicle.suitableFor.map((item) => (
                        <li
                          key={item}
                          className="rounded-full bg-navy/5 px-3 py-1 text-xs text-navy/75"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button asChild variant="outline" className="mt-2 w-fit">
                    <Link href="/bao-gia">
                      Yêu cầu báo giá với loại xe này
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </>
  );
}
