import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

/**
 * Bảng chi tiết hóa đơn (§20).
 *
 * Dùng chung cho màn hình nhân viên và khách hàng — cùng một hóa đơn phải hiện cùng một con
 * số cho cả hai bên, khác nhau là hỏng niềm tin.
 */

export interface InvoiceLineView {
  id: string;
  description: string;
  quantity: unknown;
  unit: string;
  unitPrice: unknown;
  discountAmount: unknown;
  taxPercent: unknown;
  lineTotal: unknown;
}

export interface InvoiceTotalsView {
  subtotal: unknown;
  discountAmount: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
}

export function InvoiceSummary({
  lines,
  totals,
}: {
  lines: InvoiceLineView[];
  totals: InvoiceTotalsView;
}) {
  const balance = Number(String(totals.balanceAmount));

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Chi tiết các dòng của hóa đơn</caption>
          <thead>
            <tr className="border-b border-border bg-navy/5">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                Nội dung
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                SL
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">
                Đơn vị
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                Đơn giá
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-navy">
                  {line.description}
                  {Number(String(line.taxPercent)) > 0 && (
                    <Badge variant="neutral" className="ml-2">
                      Thuế {String(line.taxPercent)}%
                    </Badge>
                  )}
                </th>
                <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                  {String(line.quantity)}
                </td>
                <td className="px-4 py-3 text-foreground/80">{line.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                  {formatMoney(String(line.unitPrice))}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-navy">
                  {formatMoney(String(line.lineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto flex w-full max-w-sm flex-col gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Thành tiền</dt>
          <dd className="tabular-nums text-navy">{formatMoney(String(totals.subtotal))}</dd>
        </div>

        {Number(String(totals.discountAmount)) > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Giảm giá</dt>
            <dd className="tabular-nums text-navy">
              −{formatMoney(String(totals.discountAmount))}
            </dd>
          </div>
        )}

        {Number(String(totals.taxAmount)) > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Thuế</dt>
            <dd className="tabular-nums text-navy">{formatMoney(String(totals.taxAmount))}</dd>
          </div>
        )}

        <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
          <dt className="font-bold text-navy">Tổng cộng</dt>
          <dd className="font-bold tabular-nums text-navy">
            {formatMoney(String(totals.totalAmount))}
          </dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-muted">Đã thanh toán</dt>
          <dd className="tabular-nums text-success">{formatMoney(String(totals.paidAmount))}</dd>
        </div>

        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="font-semibold text-navy">
            {balance < 0 ? "Trả thừa" : "Còn phải trả"}
          </dt>
          <dd
            className={`font-bold tabular-nums ${
              balance > 0 ? "text-error" : balance < 0 ? "text-warning" : "text-success"
            }`}
          >
            {formatMoney(String(Math.abs(balance)))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
