"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Loader2, PackageX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { TrackingTimeline, type PublicTrackingResult } from "@/components/shared/tracking-timeline";
import { trackingLookupSchema, type TrackingLookupInput } from "@/modules/tracking/schema";

/**
 * Tra cứu vận đơn công khai (§16.1).
 *
 * Gọi API thật. Thông báo lỗi cố tình KHÔNG phân biệt "không có mã này" với "sai số điện
 * thoại" — phân biệt được nghĩa là người dò mã biết mã nào có thật.
 */

type State =
  | { kind: "idle" }
  | { kind: "found"; view: PublicTrackingResult }
  | { kind: "error"; message: string };

export function TrackingForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrackingLookupInput>({
    resolver: zodResolver(trackingLookupSchema),
    defaultValues: { trackingCode: defaultCode, phoneSuffix: "" },
  });

  const onSubmit = async (values: TrackingLookupInput) => {
    setState({ kind: "idle" });

    try {
      const response = await fetch("/api/public/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const body = await response.json();

      if (!response.ok) {
        setState({
          kind: "error",
          message: body?.error?.message ?? "Tra cứu không thành công. Vui lòng thử lại.",
        });
        return;
      }

      setState({ kind: "found", view: body });
    } catch {
      setState({
        kind: "error",
        message: "Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="trk-code"
            label="Mã vận đơn"
            required
            hint="Mã in trên biên nhận hoặc gửi kèm email xác nhận"
            error={errors.trackingCode?.message}
          >
            <Input
              id="trk-code"
              placeholder="VD: VT12AB34CD56"
              autoComplete="off"
              aria-invalid={!!errors.trackingCode}
              aria-describedby={errors.trackingCode ? "trk-code-error" : undefined}
              {...register("trackingCode")}
            />
          </Field>

          <Field
            id="trk-phone"
            label="4 số cuối điện thoại"
            required
            hint="Số điện thoại đã dùng khi đặt dịch vụ"
            error={errors.phoneSuffix?.message}
          >
            <Input
              id="trk-phone"
              inputMode="numeric"
              maxLength={4}
              placeholder="VD: 5678"
              autoComplete="off"
              aria-invalid={!!errors.phoneSuffix}
              aria-describedby={errors.phoneSuffix ? "trk-phone-error" : undefined}
              {...register("phoneSuffix")}
            />
          </Field>
        </div>

        <Button type="submit" disabled={isSubmitting} className="sm:self-start">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? "Đang tra cứu..." : "Tra cứu"}
        </Button>
      </form>

      <div aria-live="polite">
        {state.kind === "error" && (
          <Alert variant="warning">
            <PackageX aria-hidden />
            <div>
              <p className="font-semibold">Không tra cứu được</p>
              <p className="mt-1">{state.message}</p>
            </div>
          </Alert>
        )}

        {state.kind === "found" && (
          <div className="flex flex-col gap-4">
            {state.view.hasException && (
              <Alert variant="warning">
                <AlertTriangle aria-hidden />
                <div>
                  <p className="font-semibold">Chuyến hàng đang cần xử lý</p>
                  <p className="mt-1">
                    Vui lòng liên hệ tổng đài để được cập nhật chi tiết. Thông tin cụ thể
                    không hiển thị công khai vì lý do bảo mật.
                  </p>
                </div>
              </Alert>
            )}

            <div className="rounded-lg border border-border bg-white p-5">
              <TrackingTimeline view={state.view} />
            </div>

            <p className="text-xs text-muted">
              Tra cứu công khai chỉ hiện mốc tiến trình và khu vực. Để xem địa chỉ đầy đủ,
              hình ảnh hàng hóa và thông tin tài xế, vui lòng đăng nhập bằng tài khoản đã
              đặt dịch vụ.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
