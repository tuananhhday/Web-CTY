"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Undo2,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/shared/field";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  type PaymentMethod,
  type PaymentStatus,
} from "@/modules/invoices/state-machine";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  confirmPaymentAction,
  recordPaymentAction,
  reversePaymentAction,
} from "@/app/quan-tri/hoa-don/actions";

/**
 * Ghi nhận và đối chiếu thanh toán (§20).
 *
 * Hai bước tách bạch: GHI NHẬN khoản khách báo đã chuyển, rồi XÁC NHẬN sau khi đối chiếu
 * sao kê. Chỉ khoản đã xác nhận mới làm giảm công nợ — lời khai chưa phải là tiền.
 *
 * Không có ô nào nhập dữ liệu thẻ: hệ thống không xử lý thanh toán online.
 */

export interface PaymentItem {
  id: string;
  amount: string;
  method: string;
  status: string;
  referenceCode: string | null;
  paidAt: Date;
  note: string | null;
  reverseReason: string | null;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

function toLocalInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function PaymentPanel({
  invoiceNumber,
  payments,
  canAcceptNew,
  blockedReason,
}: {
  invoiceNumber: string;
  payments: PaymentItem[];
  canAcceptNew: boolean;
  blockedReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reversing, setReversing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) {
        setOpen(false);
        setReversing(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-navy">Thanh toán ({payments.length})</h2>
        {canAcceptNew && !open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Ghi nhận khoản mới
          </Button>
        )}
      </div>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      {!canAcceptNew && blockedReason && (
        <Alert variant="info">
          <ShieldAlert aria-hidden />
          <p>{blockedReason}</p>
        </Alert>
      )}

      {open && (
        <form
          action={(formData) => run(() => recordPaymentAction(invoiceNumber, formData))}
          className="flex flex-col gap-4 rounded-lg border border-orange/40 bg-orange/5 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pay-amount" label="Số tiền (đ)" required>
              <Input
                id="pay-amount"
                name="amount"
                inputMode="numeric"
                required
                placeholder="Chỉ nhập số, không dấu phẩy"
                disabled={pending}
              />
            </Field>

            <Field id="pay-method" label="Phương thức" required>
              <select id="pay-method" name="method" className={selectClass} disabled={pending}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="pay-reference"
              label="Mã tham chiếu"
              hint="Mã giao dịch ngân hàng hoặc số phiếu thu, để đối chiếu sao kê"
            >
              <Input id="pay-reference" name="referenceCode" disabled={pending} />
            </Field>

            <Field id="pay-date" label="Thời điểm nhận tiền" required>
              <Input
                id="pay-date"
                name="paidAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(new Date())}
                disabled={pending}
              />
            </Field>
          </div>

          <Field id="pay-note" label="Ghi chú">
            <Textarea id="pay-note" name="note" rows={2} disabled={pending} />
          </Field>

          <p className="text-xs text-muted">
            Khoản ghi nhận ở đây ở trạng thái chờ đối chiếu. Công nợ chỉ giảm sau khi xác nhận
            tiền đã về tài khoản.
          </p>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Đang lưu..." : "Ghi nhận"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-foreground/65">Chưa ghi nhận khoản thanh toán nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payments.map((payment) => {
            const status = payment.status as PaymentStatus;

            return (
              <li key={payment.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-navy">{formatMoney(payment.amount)}</span>
                  <Badge variant={PAYMENT_STATUS_TONE[status]}>
                    {PAYMENT_STATUS_LABELS[status]}
                  </Badge>
                  <Badge variant="neutral">
                    {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
                  </Badge>
                  <time
                    dateTime={payment.paidAt.toISOString()}
                    className="ml-auto text-xs text-muted"
                  >
                    {formatDateTime(payment.paidAt)}
                  </time>
                </div>

                {payment.referenceCode && (
                  <p className="mt-1 font-mono text-xs text-foreground/70">
                    Mã tham chiếu: {payment.referenceCode}
                  </p>
                )}
                {payment.note && (
                  <p className="mt-1 text-sm text-foreground/70">{payment.note}</p>
                )}
                {payment.reverseReason && (
                  <p className="mt-1 text-sm text-error">Lý do đảo: {payment.reverseReason}</p>
                )}

                {status !== "REVERSED" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {status === "PENDING" && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => confirmPaymentAction(invoiceNumber, payment.id))}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Xác nhận đã nhận tiền
                      </Button>
                    )}

                    {reversing === payment.id ? (
                      <form
                        action={(formData) =>
                          run(() => reversePaymentAction(invoiceNumber, payment.id, formData))
                        }
                        className="flex w-full flex-col gap-2 rounded-md border border-error/25 bg-error-bg p-3"
                      >
                        <Field id={`reverse-${payment.id}`} label="Lý do đảo khoản" required>
                          <Input
                            id={`reverse-${payment.id}`}
                            name="reason"
                            required
                            minLength={5}
                            placeholder="VD: ghi nhầm số tiền, khách chuyển lại"
                            disabled={pending}
                          />
                        </Field>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" variant="outline" disabled={pending}>
                            Xác nhận đảo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setReversing(null)}
                            disabled={pending}
                          >
                            Hủy
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setReversing(payment.id)}
                      >
                        <Undo2 className="h-4 w-4" aria-hidden />
                        Đảo khoản
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
