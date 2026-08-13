import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { getVehicleTypes } from "@/modules/cms/service";
import { getImageSource } from "@/data/image-sources";

export async function FleetSection() {
  const vehicleTypes = await getVehicleTypes();
  const fleetImage = getImageSource("fleet-warehouse");
  const loadingImage = getImageSource("cargo-loading");

  return (
    <section aria-labelledby="doi-xe-heading" className="border-y border-border bg-white py-16 md:py-20">
      <Container>
        <SectionHeading
          eyebrow="Đội xe"
          title="Nhóm phương tiện phục vụ vận chuyển"
          description="Loại xe cụ thể, tải trọng và tình trạng khả dụng được xác nhận theo từng yêu cầu vận chuyển."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-navy/10">
            <Image
              src={fleetImage.url}
              alt={fleetImage.description}
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-navy/10">
            <Image
              src={loadingImage.url}
              alt={loadingImage.description}
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicleTypes.map((vehicle) => (
            <li key={vehicle.id}>
              <article className="flex h-full flex-col gap-2 rounded-lg border border-border p-5">
                <h3 className="text-base font-bold text-navy">{vehicle.name}</h3>
                <p className="text-sm leading-relaxed text-foreground/70">{vehicle.description}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {vehicle.suitableFor.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-navy/5 px-2.5 py-1 text-xs text-navy/75"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/doi-xe#${vehicle.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-orange-text hover:text-orange-text-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text rounded-sm"
                >
                  Xem phương tiện phù hợp
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
