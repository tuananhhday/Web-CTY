"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/shared/field";
import { assignAction, previewConflictsAction } from "@/app/quan-tri/dieu-phoi/actions";

/**
 * Phân công xe và tài xế cho một chuyến (§14.3).
 *
 * Xung đột được kiểm tra ngay khi dispatcher đổi lựa chọn, trước khi bấm lưu — mục đích là
 * để họ THẤY vấn đề rồi mới quyết định, thay vì bấm lưu rồi nhận lỗi.
 *
 * Kiểm tra ở đây chỉ là gợi ý cho người dùng. Lớp chặn thật nằm ở service và exclusion
 * constraint của database (§14.3), nên không có gì mất an toàn khi giao diện đoán sai.
 */

export interface VehicleOption {
  id: string;
  plateNumber: string;
  typeName: string;
}

export interface DriverOption {
  id: string;
  fullName: string;
  employeeCode: string;
  licenseClass: string | null;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground focus-visible:border-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text";

/** `datetime-local` cần chuỗi không có timezone; Date.toISOString() thì có. */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function AssignmentForm({
  trackingCode,
  vehicles,
  drivers,
  defaultFrom,
  defaultTo,
  current,
}: {
  trackingCode: string;
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  defaultFrom: Date;
  defaultTo: Date;
  current: {
    vehicleId: string | null;
    primaryDriverId: string | null;
    secondaryDriverId: string | null;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [vehicleId, setVehicleId] = useState(current?.vehicleId ?? "");
  const [primaryDriverId, setPrimaryDriverId] = useState(current?.primaryDriverId ?? "");
  const [secondaryDriverId, setSecondaryDriverId] = useState(current?.secondaryDriverId ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(toLocalInputValue(defaultFrom));
  const [effectiveTo, setEffectiveTo] = useState(toLocalInputValue(defaultTo));
  const [overrideChecked, setOverrideChecked] = useState(false);

  const windowValid =
    Boolean(effectiveFrom) &&
    Boolean(effectiveTo) &&
    new Date(effectiveFrom).getTime() < new Date(effectiveTo).getTime();

  const ready = Boolean(vehicleId) && Boolean(primaryDriverId) && windowValid;

  /**
   * Chữ ký của bộ lựa chọn hiện tại. Kết quả kiểm tra được lưu kèm chữ ký sinh ra nó, nên
   * chỉ cần so sánh là biết kết quả còn khớp với những gì đang hiển thị hay đã cũ — không
   * phải xoá state trong effect mỗi lần người dùng đổi lựa chọn.
   */
  const key = ready
    ? [vehicleId, primaryDriverId, secondaryDriverId, effectiveFrom, effectiveTo].join("|")
    : "";

  const [preview, setPreview] = useState<{
    key: string;
    conflicts: string[];
    overridable: boolean;
  } | null>(null);

  // Hoãn 400ms để không gọi server sau từng lần gõ phím vào ô thời gian.
  useEffect(() => {
    if (!key) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      const result = await previewConflictsAction({
        vehicleId,
        primaryDriverId,
        secondaryDriverId: secondaryDriverId || null,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: new Date(effectiveTo).toISOString(),
        trackingCode,
      });

      if (cancelled) return;

      setPreview({
        key,
        conflicts: result.conflicts ?? [],
        overridable: result.overridable ?? false,
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, trackingCode, vehicleId, primaryDriverId, secondaryDriverId, effectiveFrom, effectiveTo]);

  const fresh = preview !== null && preview.key === key ? preview : null;
  const conflicts = fresh?.conflicts ?? [];
  const overridable = fresh?.overridable ?? false;
  const checking = Boolean(key) && fresh === null;

  // Tick "bỏ qua cảnh báo" chỉ có ý nghĩa khi đang thật sự có cảnh báo. Suy ra thay vì
  // lưu riêng, để đổi lựa chọn xong là cờ tự mất, không lưu nhầm vào database.
  const override = overrideChecked && conflicts.length > 0;

  const blocked = conflicts.length > 0 && !overridable;

  const handleSubmit = (formData: FormData) => {
    setFeedback(null);

    startTransition(async () => {
      const result = await assignAction(trackingCode, {
        vehicleId,
        primaryDriverId,
        secondaryDriverId: secondaryDriverId || undefined,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: new Date(effectiveTo).toISOString(),
        overrideConflict: override,
        overrideReason: String(formData.get("overrideReason") ?? "") || undefined,
        note: String(formData.get("note") ?? "") || undefined,
      });

      setFeedback({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  if (vehicles.length === 0 || drivers.length === 0) {
    return (
      <Alert variant="warning">
        <AlertTriangle aria-hidden />
        <div>
          <p className="font-semibold">Chưa đủ dữ liệu để phân công</p>
          <p className="mt-1">
            {vehicles.length === 0 && "Chưa có xe nào đang hoạt động. "}
            {drivers.length === 0 && "Chưa có tài xế nào đang làm việc. "}
            Cần nhập dữ liệu đội xe thật của doanh nghiệp trước.
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-base font-bold text-navy">
        {current ? "Đổi phân công" : "Phân công xe và tài xế"}
      </h2>

      {feedback && (
        <Alert variant={feedback.ok ? "success" : "error"} role="alert">
          {feedback.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
          <p>{feedback.message}</p>
        </Alert>
      )}

      <Field id="vehicleId" label="Xe" required>
        <select
          id="vehicleId"
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          className={selectClass}
        >
          <option value="">— Chọn xe —</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plateNumber} · {vehicle.typeName}
            </option>
          ))}
        </select>
      </Field>

      <Field id="primaryDriverId" label="Tài xế chính" required>
        <select
          id="primaryDriverId"
          value={primaryDriverId}
          onChange={(event) => setPrimaryDriverId(event.target.value)}
          className={selectClass}
        >
          <option value="">— Chọn tài xế —</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.fullName} ({driver.employeeCode})
              {driver.licenseClass ? ` · hạng ${driver.licenseClass}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="secondaryDriverId"
        label="Tài xế phụ"
        hint="Không bắt buộc. Dùng cho chuyến đường dài hoặc cần thêm người bốc xếp."
      >
        <select
          id="secondaryDriverId"
          value={secondaryDriverId}
          onChange={(event) => setSecondaryDriverId(event.target.value)}
          className={selectClass}
        >
          <option value="">— Không có —</option>
          {drivers
            .filter((driver) => driver.id !== primaryDriverId)
            .map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName} ({driver.employeeCode})
              </option>
            ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="effectiveFrom" label="Bắt đầu" required>
          <Input
            id="effectiveFrom"
            type="datetime-local"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>
        <Field
          id="effectiveTo"
          label="Kết thúc"
          required
          error={
            effectiveFrom && effectiveTo && !windowValid
              ? "Thời điểm kết thúc phải sau thời điểm bắt đầu"
              : undefined
          }
        >
          <Input
            id="effectiveTo"
            type="datetime-local"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
          />
        </Field>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {checking && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Đang kiểm tra lịch xe và tài xế...
          </p>
        )}

        {!checking && ready && conflicts.length === 0 && (
          <p className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Xe và tài xế đều rảnh trong khoảng thời gian này.
          </p>
        )}

        {!checking && conflicts.length > 0 && (
          <Alert variant={overridable ? "warning" : "error"}>
            {overridable ? <AlertTriangle aria-hidden /> : <ShieldAlert aria-hidden />}
            <div>
              <p className="font-semibold">
                {overridable
                  ? `Phát hiện ${conflicts.length} trùng lịch`
                  : "Không thể phân công"}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {conflicts.map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
              </ul>
              {!overridable && (
                <p className="mt-2">
                  Bảo trì và nghỉ phép là ràng buộc thực tế, không bỏ qua được. Hãy chọn xe
                  hoặc tài xế khác, hoặc đổi khung giờ.
                </p>
              )}
            </div>
          </Alert>
        )}
      </div>

      {/* Chỉ hiện lựa chọn bỏ qua khi thật sự bỏ qua được (§14.3). */}
      {overridable && conflicts.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-bg p-4">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="overrideConflict"
              checked={overrideChecked}
              onCheckedChange={(checked) => setOverrideChecked(checked === true)}
            />
            <Label htmlFor="overrideConflict" className="cursor-pointer">
              Vẫn phân công dù trùng lịch
            </Label>
          </div>
          {override && (
            <Field
              id="overrideReason"
              label="Lý do bỏ qua cảnh báo"
              required
              hint="Lý do được ghi vào nhật ký hệ thống kèm tên người thực hiện."
            >
              <Textarea id="overrideReason" name="overrideReason" rows={2} required />
            </Field>
          )}
        </div>
      )}

      <Field id="note" label="Ghi chú nội bộ" hint="Khách hàng không nhìn thấy ghi chú này.">
        <Textarea id="note" name="note" rows={2} />
      </Field>

      <Button
        type="submit"
        disabled={pending || !ready || blocked || (conflicts.length > 0 && !override)}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Đang lưu..." : current ? "Cập nhật phân công" : "Phân công"}
      </Button>
    </form>
  );
}
