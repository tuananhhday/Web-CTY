import Image from "next/image";
import { MapPin, Info } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Alert } from "@/components/ui/alert";
import { serviceAreas } from "@/config/company";
import { getImageSource } from "@/data/image-sources";

export function ServiceAreaSection() {
  const image = getImageSource("domestic-transport");

  return (
    <section
      aria-labelledby="khu-vuc-heading"
      className="border-y border-border bg-white py-16 md:py-20"
    >
      <Container className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <SectionHeading
            eyebrow="Khu vực phục vụ"
            title="Phạm vi vận chuyển được xác nhận theo yêu cầu"
            description="Phạm vi phục vụ được xác nhận theo từng yêu cầu vận chuyển."
          />

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {serviceAreas.map((area) => (
              <div key={area.region}>
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy">
                  <MapPin className="h-4 w-4 text-orange-text" aria-hidden />
                  {area.region}
                </h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground/70">
                  {area.provinces.map((province) => (
                    <li key={province}>{province}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Alert variant="info" className="mt-7">
            <Info aria-hidden />
            <p>
              Danh sách khu vực trên là thông tin minh họa. Doanh nghiệp cần cung cấp phạm vi vận
              chuyển thực tế trước khi công bố.
            </p>
          </Alert>
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
      </Container>
    </section>
  );
}
