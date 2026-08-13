import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Info, ArrowRight } from "lucide-react";
import { getServiceAreas } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { SectionHeading } from "@/components/shared/section-heading";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Khu vực phục vụ",
  description:
    "Các tỉnh thành hệ thống tiếp nhận yêu cầu vận chuyển. Phạm vi cụ thể được xác nhận theo từng yêu cầu.",
  alternates: { canonical: "/khu-vuc-phuc-vu" },
};

export default async function ServiceAreasPage() {
  const areas = await getServiceAreas();

  return (
    <Container className="pb-16">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Khu vực phục vụ" }]} />

      <SectionHeading
        eyebrow="PHẠM VI HOẠT ĐỘNG"
        title="Khu vực phục vụ"
        as="h1"
        description="Danh sách dưới đây là các tỉnh thành hệ thống đang tiếp nhận yêu cầu vận chuyển."
      />

      {/* Không tuyên bố phủ toàn quốc khi chưa có dữ liệu xác nhận (§8.8). */}
      <Alert variant="info" className="mt-6 max-w-3xl">
        <Info aria-hidden />
        <p>
          Phạm vi phục vụ được xác nhận theo từng yêu cầu vận chuyển. Nếu điểm lấy hoặc điểm giao
          của bạn không nằm trong danh sách, vui lòng liên hệ để chúng tôi kiểm tra khả năng đáp ứng.
        </p>
      </Alert>

      {areas.length === 0 ? (
        <Card className="mt-10">
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-navy/30" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có dữ liệu khu vực phục vụ</p>
            <p className="mt-1.5 text-sm text-foreground/65">
              Danh sách khu vực sẽ hiển thị sau khi được cập nhật trong trang quản trị.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/lien-he">Liên hệ để hỏi khu vực</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <li key={area.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy">
                      <MapPin className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <h2 className="font-semibold text-navy">{area.name}</h2>
                      {area.district && (
                        <p className="text-xs text-muted">{area.district}</p>
                      )}
                    </div>
                  </div>

                  {area.description && (
                    <p className="text-sm leading-relaxed text-foreground/70">{area.description}</p>
                  )}

                  {area.note && (
                    <p className="mt-auto rounded-md bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning">
                      {area.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 rounded-lg border border-border bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold text-navy">Không thấy khu vực của bạn?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
          Chúng tôi vẫn có thể hỗ trợ nhiều tuyến ngoài danh sách. Gửi thông tin điểm lấy và điểm
          giao, đội ngũ vận hành sẽ phản hồi về khả năng đáp ứng.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/bao-gia">
              Gửi yêu cầu báo giá
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/lien-he">Liên hệ tư vấn</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
