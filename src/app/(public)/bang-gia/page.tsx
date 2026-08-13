import type { Metadata } from "next";
import Link from "next/link";
import { getTransportPricing } from "@/modules/cms/service";
import { Container } from "@/components/shared/container";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  PricingPendingNotice,
  ReferenceOnlyBanner,
} from "@/components/shared/pricing-pending-notice";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Bảng giá vận chuyển",
  description:
    "Giá cước vận chuyển theo nhóm phương tiện. Chi phí chính thức được xác nhận theo từng yêu cầu.",
  alternates: { canonical: "/bang-gia" },
};

/** Nhãn đơn vị tính hiển thị cho khách. */
const UNIT_LABELS: Record<string, string> = {
  TRIP: "chuyến",
  KM: "km",
  HOUR: "giờ",
  TONNE: "tấn",
  M3: "m³",
};

export default async function PricingPage() {
  const version = await getTransportPricing();
  const rates = version?.vehicleRates ?? [];
  const surcharges = version?.surchargeRules ?? [];

  return (
    <Container className="pb-16">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Bảng giá vận chuyển" }]} />

      <SectionHeading
        eyebrow="CHI PHÍ"
        title="Bảng giá vận chuyển"
        as="h1"
        description="Mức giá tham khảo theo nhóm phương tiện, giúp bạn ước lượng ngân sách trước khi gửi yêu cầu."
      />

      {rates.length === 0 ? (
        <PricingPendingNotice />
      ) : (
        <>
          {version?.isReferenceOnly && <ReferenceOnlyBanner />}

          {/* Bảng cuộn ngang riêng trên mobile, không đẩy cả trang cuộn (§32.1). */}
          <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Bảng giá cước vận chuyển theo nhóm phương tiện
              </caption>
              <thead>
                <tr className="border-b border-border bg-navy/5">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                    Nhóm phương tiện
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                    Đơn vị
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Giá cơ bản
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Đơn giá
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                    Ghi chú
                  </th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-navy">
                      {rate.vehicleType?.name ?? "Chưa gán nhóm xe"}
                    </th>
                    <td className="px-4 py-3 text-foreground/70">
                      {UNIT_LABELS[rate.unit] ?? rate.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(rate.basePrice.toString())}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {rate.unitPrice.isZero()
                        ? "—"
                        : formatMoney(rate.unitPrice.toString())}
                    </td>
                    <td className="px-4 py-3 text-foreground/65">{rate.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {surcharges.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-navy">Phụ phí có thể phát sinh</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {surcharges.map((rule) => (
                  <li
                    key={rule.id}
                    className="rounded-md border border-border bg-white p-4 text-sm"
                  >
                    <p className="font-medium text-navy">{rule.name}</p>
                    <p className="mt-1 text-foreground/70">
                      {rule.calculationType === "PERCENT"
                        ? `${rule.percent.toString()}% giá cước`
                        : formatMoney(rule.amount.toString())}
                      {rule.unit ? ` / ${rule.unit}` : ""}
                    </p>
                    {rule.note && (
                      <p className="mt-1.5 text-xs text-muted">{rule.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
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

      <div className="mt-12 flex flex-col gap-3 rounded-lg bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-bold">Cần con số cụ thể cho lô hàng của bạn?</h2>
          <p className="mt-1.5 text-sm text-white/75">
            Gửi thông tin hàng hóa, chúng tôi báo giá chi tiết theo đúng tuyến và điều kiện thực tế.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/bao-gia">Yêu cầu báo giá</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10">
            <Link href="/bang-gia/boc-xep">Giá bốc xếp</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
