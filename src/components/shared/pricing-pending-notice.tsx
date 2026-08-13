import Link from "next/link";
import { Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hiển thị khi bảng giá chưa có dữ liệu thật từ doanh nghiệp.
 *
 * Nguyên tắc §1: không bịa mức giá, không hiển thị con số minh họa trông như giá thật.
 * Thay vào đó nói thẳng là chưa công bố và hướng người dùng sang kênh nhận báo giá.
 */
export function PricingPendingNotice({
  title = "Bảng giá chưa được công bố",
  description = "Doanh nghiệp đang hoàn thiện biểu giá chính thức. Trong thời gian này, chi phí được báo riêng cho từng yêu cầu dựa trên khối lượng, quãng đường và điều kiện bốc xếp thực tế.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-navy/25 bg-white p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-navy">
        <Info className="h-6 w-6" aria-hidden />
      </span>

      <h2 className="mt-5 text-lg font-bold text-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-foreground/70">
        {description}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/bao-gia">
            Nhận báo giá cho lô hàng của bạn
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lien-he">Gọi tư vấn</Link>
        </Button>
      </div>
    </div>
  );
}

/** Cảnh báo hiển thị phía trên bảng giá khi phiên bản được đánh dấu chỉ tham khảo (§13.1). */
export function ReferenceOnlyBanner() {
  return (
    <div className="mt-6 flex gap-3 rounded-md border border-warning/20 bg-warning-bg p-4 text-sm text-warning">
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>
        <strong className="font-semibold">Giá tham khảo.</strong> Các mức giá dưới đây dùng để
        ước lượng ban đầu. Chi phí chính thức được xác nhận sau khi kiểm tra khối lượng, kích
        thước hàng hóa và điều kiện tại điểm lấy, điểm giao.
      </p>
    </div>
  );
}
