import "server-only";
import { db } from "@/lib/db";

/**
 * Ngưỡng duyệt báo giá (§13.3).
 *
 * Tách khỏi service.ts để Server Component đọc được mà không kéo theo cả tầng nghiệp vụ.
 * Giá trị mặc định cố ý SIẾT CHẶT: thiếu cấu hình thì thà bắt duyệt thừa còn hơn để lọt
 * báo giá lớn ra ngoài mà không ai kiểm.
 */

export const DEFAULT_APPROVAL_AMOUNT = "20000000";
export const DEFAULT_MAX_DISCOUNT_PERCENT = 15;
export const DEFAULT_VALIDITY_DAYS = 7;

export interface ApprovalThresholdConfig {
  maxAmountWithoutApproval: string;
  maxDiscountPercent: number;
  defaultValidityDays: number;
}

export async function loadApprovalThresholds(): Promise<ApprovalThresholdConfig> {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          "quote.approval_threshold_vnd",
          "quote.max_discount_percent",
          "quote.default_validity_days",
        ],
      },
    },
    select: { key: true, value: true },
  });

  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    maxAmountWithoutApproval: String(
      map["quote.approval_threshold_vnd"] ?? DEFAULT_APPROVAL_AMOUNT
    ),
    maxDiscountPercent: Number(map["quote.max_discount_percent"] ?? DEFAULT_MAX_DISCOUNT_PERCENT),
    defaultValidityDays: Number(map["quote.default_validity_days"] ?? DEFAULT_VALIDITY_DAYS),
  };
}
