import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Container } from "@/components/shared/container";
import { TrackingForm } from "@/components/shared/tracking-form";
import { CUSTOMER_MILESTONES } from "@/modules/shipments/state-machine";

export const metadata: Metadata = {
  title: "Tra cứu vận đơn",
  description: "Tra cứu tiến trình vận chuyển bằng mã vận đơn và 4 số cuối điện thoại.",
};

export default function TrackingPage() {
  return (
    <>
      <PageHeader
        title="Tra cứu vận đơn"
        description="Nhập mã vận đơn và 4 số cuối điện thoại đã đăng ký để xem tiến trình vận chuyển."
        breadcrumbs={[{ label: "Tra cứu" }]}
      />

      <Container className="py-14 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-bold text-navy">Thông tin tra cứu</h2>
            <TrackingForm />
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-32">
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-base font-bold text-navy">Các mốc tiến trình</h2>
              <ol className="mt-4 flex flex-col gap-2.5 text-sm">
                {CUSTOMER_MILESTONES.map((milestone) => (
                  <li
                    key={milestone.key}
                    className="flex items-start gap-2.5 text-foreground/75"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange"
                      aria-hidden
                    />
                    {milestone.label}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-navy/[0.03] p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Vì sao cần 4 số cuối?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                Mã vận đơn có thể bị người khác nhìn thấy trên bao bì hoặc giấy tờ. Bước xác
                minh này đảm bảo chỉ người liên quan xem được tiến trình đơn hàng.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground/75">
                Tra cứu công khai chỉ hiện mốc tiến trình và tỉnh/thành, không hiện địa chỉ
                chi tiết, tên người nhận hay thông tin tài xế.{" "}
                <Link
                  href="/dang-nhap"
                  className="font-semibold text-orange-text hover:underline"
                >
                  Đăng nhập
                </Link>{" "}
                để xem đầy đủ đơn hàng của bạn.
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
