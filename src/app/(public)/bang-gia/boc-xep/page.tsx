import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getLaborPricing } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  PricingPendingNotice,
  ReferenceOnlyBanner,
} from "@/components/shared/pricing-pending-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Bảng giá bốc xếp và nhân công",
  description:
    "Chi phí nhân công bốc xếp, đóng gói và tháo lắp. Mức giá phụ thuộc điều kiện tầng, thang máy và khoảng cách bê hàng.",
  alternates: { canonical: "/bang-gia/boc-xep" },
};

const UNIT_LABELS: Record<string, string> = {
  HOUR: "giờ",
  SHIFT: "ca",
  TONNE: "tấn",
  M3: "m³",
  PACKAGE: "kiện",
  FLOOR: "tầng",
  TRIP: "chuyến",
};

export default async function LaborPricingPage() {
  const version = await getLaborPricing();
  const rates = version?.laborRates ?? [];
  const surcharges = version?.surchargeRules ?? [];

  // Gộp danh sách hàng không nhận từ mọi mức giá, khử trùng lặp.
  const exclusions = Array.from(new Set(rates.flatMap((rate) => rate.exclusions)));

  return (
    <Container className="pb-16">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Bảng giá", href: "/bang-gia" },
          { label: "Bốc xếp và nhân công" },
        ]}
      />

      <SectionHeading
        eyebrow="NHÂN CÔNG"
        title="Bảng giá bốc xếp và nhân công"
        as="h1"
        description="Chi phí nhân công tính theo giờ, ca hoặc khối lượng, tùy điều kiện thực tế tại điểm lấy và điểm giao."
      />

      {rates.length === 0 ? (
        <PricingPendingNotice
          title="Bảng giá bốc xếp chưa được công bố"
          description="Chi phí nhân công phụ thuộc nhiều vào điều kiện thực tế: số tầng, có thang máy hay không, khoảng cách từ chỗ đỗ xe tới cửa. Chúng tôi báo giá riêng sau khi nắm được các thông tin này."
        />
      ) : (
        <>
          {version?.isReferenceOnly && <ReferenceOnlyBanner />}

          <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Bảng giá nhân công bốc xếp theo đơn vị tính</caption>
              <thead>
                <tr className="border-b border-border bg-navy/5">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                    Hạng mục
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                    Đơn vị
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Đơn giá
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Tối thiểu
                  </th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-navy">
                      {rate.name}
                      {rate.note && (
                        <span className="mt-0.5 block text-xs font-normal text-muted">
                          {rate.note}
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-3 text-foreground/70">
                      {UNIT_LABELS[rate.unit] ?? rate.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(rate.price.toString())}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/70">
                      {[
                        rate.minimumWorkers ? `${rate.minimumWorkers} người` : null,
                        rate.minimumHours ? `${rate.minimumHours.toString()} giờ` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {surcharges.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-navy">Phụ phí</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {surcharges.map((rule) => (
                  <li key={rule.id} className="rounded-md border border-border bg-white p-4 text-sm">
                    <p className="font-medium text-navy">{rule.name}</p>
                    <p className="mt-1 text-foreground/70">
                      {rule.calculationType === "PERCENT"
                        ? `${rule.percent.toString()}%`
                        : formatMoney(rule.amount.toString())}
                      {rule.unit ? ` / ${rule.unit}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {exclusions.length > 0 && (
            <Alert variant="warning" className="mt-8">
              <ShieldAlert aria-hidden />
              <div>
                <p className="font-semibold">Hàng hóa không nhận bốc xếp</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {exclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {version && (
            <p className="mt-6 text-xs text-muted">
              Bảng giá phiên bản {version.versionNumber}, hiệu lực từ{" "}
              {formatDate(version.effectiveFrom)}
              {version.effectiveTo ? ` đến ${formatDate(version.effectiveTo)}` : ""}.
            </p>
          )}
        </>
      )}

      <section className="mt-12 rounded-lg border border-border bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold text-navy">Yếu tố ảnh hưởng đến chi phí nhân công</h2>
        <ul className="mt-4 grid gap-2.5 text-sm text-foreground/75 sm:grid-cols-2">
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Số tầng và việc có thang máy hay không
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Khoảng cách từ chỗ đỗ xe tới cửa
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Khối lượng và kích thước từng kiện hàng
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Hàng có cần tháo lắp hoặc đóng gói riêng không
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Thời điểm thực hiện: ngoài giờ, ngày lễ
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-orange-text">•</span>
            Chiều rộng lối đi và hẻm vào
          </li>
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/bao-gia">Gửi thông tin để nhận báo giá</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/bang-gia">Xem bảng giá vận chuyển</Link>
          </Button>
        </div>
      </section>
    </Container>
  );
}
