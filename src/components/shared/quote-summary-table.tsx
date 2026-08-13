import { QUOTE_LINE_CATEGORY_LABELS } from "@/modules/quotes/schema";
import { formatMoney } from "@/lib/money";

interface LineItem {
  id: string;
  description: string;
  category: string;
  quantity: unknown;
  unit: string;
  unitPrice: unknown;
  discountAmount: unknown;
  taxPercent: unknown;
  lineTotal: unknown;
  note: string | null;
}

interface Revision {
  revisionNumber: number;
  subtotal: unknown;
  discountAmount: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  terms: string | null;
  lineItems: LineItem[];
}

/**
 * Bảng chi tiết một phiên bản báo giá.
 *
 * Dùng chung cho cả khách và nhân viên để hai bên nhìn thấy CÙNG một con số — nếu tách
 * hai component riêng thì rất dễ lệch nhau sau vài lần sửa.
 */
export function QuoteSummaryTable({ revision }: { revision: Revision }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Chi tiết báo giá phiên bản {revision.revisionNumber}
          </caption>
          <thead>
            <tr className="border-b border-border bg-navy/5">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Nội dung</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">SL</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Đơn vị</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">Đơn giá</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {revision.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-navy">
                  {item.description}
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {QUOTE_LINE_CATEGORY_LABELS[
                      item.category as keyof typeof QUOTE_LINE_CATEGORY_LABELS
                    ] ?? item.category}
                    {item.note && ` · ${item.note}`}
                  </span>
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{String(item.quantity)}</td>
                <td className="px-4 py-3 text-foreground/70">{item.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(String(item.unitPrice))}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-navy">
                  {formatMoney(String(item.lineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-foreground/70">Thành tiền</dt>
          <dd className="tabular-nums">{formatMoney(String(revision.subtotal))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-foreground/70">Giảm giá</dt>
          <dd className="tabular-nums">−{formatMoney(String(revision.discountAmount))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-foreground/70">Thuế</dt>
          <dd className="tabular-nums">{formatMoney(String(revision.taxAmount))}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <dt className="font-bold text-navy">Tổng cộng</dt>
          <dd className="text-lg font-bold tabular-nums text-navy">
            {formatMoney(String(revision.totalAmount))}
          </dd>
        </div>
      </dl>

      {revision.terms && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="text-sm font-bold text-navy">Điều khoản</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
            {revision.terms}
          </p>
        </div>
      )}
    </div>
  );
}
