import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Boxes, Wrench, PackageCheck, ClipboardList, ArrowRight } from "lucide-react";
import { getMovingService } from "@/modules/cms/service";
import { getImageSource } from "@/data/image-sources";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Trang chuyển nhà / chuyển văn phòng.
 *
 * §3.1 nói rõ: chỉ hiển thị "nếu doanh nghiệp bật dịch vụ này". Vì vậy trang trả 404 khi
 * không có Service nào được đánh dấu `isMovingService` và đang PUBLISHED — không quảng cáo
 * dịch vụ doanh nghiệp chưa cung cấp.
 */

export async function generateMetadata(): Promise<Metadata> {
  const service = await getMovingService();
  if (!service) return { title: "Không tìm thấy trang" };

  return {
    title: service.name,
    description: service.shortDescription,
    alternates: { canonical: "/chuyen-nha" },
  };
}

const SURVEY_POINTS = [
  {
    icon: ClipboardList,
    title: "Lập danh sách đồ đạc",
    description:
      "Liệt kê theo nhóm: nội thất, thiết bị điện, thùng carton, đồ dễ vỡ. Danh sách có cấu trúc giúp chọn đúng loại xe và số nhân công.",
  },
  {
    icon: Boxes,
    title: "Ghi nhận điều kiện tiếp cận",
    description:
      "Tầng đi và tầng đến, có thang máy hay không, khoảng cách từ chỗ đỗ xe tới cửa. Đây là yếu tố ảnh hưởng lớn nhất đến chi phí nhân công.",
  },
  {
    icon: Wrench,
    title: "Xác định nhu cầu tháo lắp",
    description:
      "Giường, tủ, kệ lớn thường phải tháo rời mới qua được cửa và thang máy. Thống nhất trước để bố trí đủ thợ và dụng cụ.",
  },
  {
    icon: PackageCheck,
    title: "Thống nhất dịch vụ đóng gói",
    description:
      "Bạn tự đóng gói hay cần chúng tôi hỗ trợ, có cần cung cấp thùng carton và vật liệu chèn lót không.",
  },
];

export default async function MovingPage() {
  const service = await getMovingService();

  // Doanh nghiệp chưa bật dịch vụ chuyển nhà — không tạo trang giới thiệu rỗng.
  if (!service) notFound();

  const heroImage = getImageSource("cargo-loading");

  return (
    <>
      <Container className="pb-16">
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: "Dịch vụ", href: "/dich-vu" },
            { label: service.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-text">
              CHUYỂN NHÀ · CHUYỂN VĂN PHÒNG
            </span>
            <h1 className="mt-3 text-2xl font-bold text-navy sm:text-3xl lg:text-4xl">
              {service.name}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-foreground/75">
              {service.description}
            </p>

            {service.highlights.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2.5">
                {service.highlights.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-foreground/80">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/chuyen-nha/yeu-cau">
                  Gửi yêu cầu khảo sát
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/bang-gia/boc-xep">Xem giá bốc xếp</Link>
              </Button>
            </div>
          </div>

          <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-navy/5">
            <Image
              src={heroImage.url}
              alt={heroImage.description}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>

      <section className="border-y border-border bg-white py-14">
        <Container>
          <SectionHeading
            eyebrow="TRƯỚC KHI CHUYỂN"
            title="Bốn việc cần làm rõ khi khảo sát"
            description="Chuyển nhà phức tạp hơn vận chuyển hàng thông thường vì đồ đạc đa dạng và điều kiện mỗi nơi mỗi khác."
          />

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {SURVEY_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-3 p-6">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <h3 className="font-semibold text-navy">{point.title}</h3>
                      <p className="text-sm leading-relaxed text-foreground/70">
                        {point.description}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <Container className="py-14">
        <div className="rounded-lg bg-navy p-8 text-white sm:p-10">
          <h2 className="text-xl font-bold sm:text-2xl">Đặt lịch khảo sát trực tiếp</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            Với khối lượng đồ đạc lớn hoặc điều kiện tiếp cận phức tạp, khảo sát tại chỗ cho ra
            phương án sát thực tế hơn nhiều so với mô tả qua điện thoại. Bạn có thể yêu cầu khảo
            sát ngay trong biểu mẫu gửi yêu cầu.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/chuyen-nha/yeu-cau">Gửi yêu cầu</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/lien-he">Liên hệ tư vấn</Link>
            </Button>
          </div>
        </div>
      </Container>
    </>
  );
}
