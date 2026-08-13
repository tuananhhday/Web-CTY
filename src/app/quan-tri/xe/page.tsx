import type { Metadata } from "next";
import Link from "next/link";
import { Truck, AlertTriangle, Plus } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission, can } from "@/modules/auth/policy";
import { listVehicles, listExpiringDocuments } from "@/modules/fleet/repository";
import { VEHICLE_STATUS_LABELS } from "@/modules/fleet/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDate, addDays } from "@/lib/datetime";

export const metadata: Metadata = { title: "Đội xe" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  MAINTENANCE: "warning",
  RETIRED: "neutral",
};

/** Giấy tờ hết hạn trong 30 ngày tới cần được nhắc (§32.3). */
function expiryTone(date: Date | null): { tone: "error" | "warning" | null; label: string } {
  if (!date) return { tone: null, label: "Chưa có thông tin" };

  const now = new Date();
  if (date <= now) return { tone: "error", label: `Hết hạn ${formatDate(date)}` };
  if (date <= addDays(now, 30)) return { tone: "warning", label: `Còn hạn tới ${formatDate(date)}` };

  return { tone: null, label: formatDate(date) };
}

export default async function VehiclesPage() {
  const actor = await getActor();
  requirePermission(actor, "fleet.read");

  const [vehicles, expiring] = await Promise.all([listVehicles(), listExpiringDocuments()]);

  const canManage = can(actor, "fleet.manage");
  const totalExpiring = expiring.vehicles.length + expiring.drivers.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Đội xe</h1>
          <p className="mt-1 text-sm text-foreground/70">{vehicles.length} phương tiện</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/quan-tri/tai-xe">Xem tài xế</Link>
          </Button>
          {canManage && (
            <Button asChild>
              <Link href="/quan-tri/xe/moi">
                <Plus className="h-4 w-4" aria-hidden />
                Thêm xe
              </Link>
            </Button>
          )}
        </div>
      </div>

      {totalExpiring > 0 && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <div>
            <p className="font-semibold">
              {totalExpiring} giấy tờ sắp hết hạn hoặc đã hết hạn
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {expiring.vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  Xe {vehicle.plateNumber}:{" "}
                  {[
                    vehicle.inspectionExpiresAt && `đăng kiểm ${formatDate(vehicle.inspectionExpiresAt)}`,
                    vehicle.insuranceExpiresAt && `bảo hiểm ${formatDate(vehicle.insuranceExpiresAt)}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              ))}
              {expiring.drivers.map((driver) => (
                <li key={driver.id}>
                  Tài xế {driver.fullName}: bằng lái{" "}
                  {driver.licenseExpiresAt && formatDate(driver.licenseExpiresAt)}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Truck className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có phương tiện nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Đội xe cần được nhập từ dữ liệu thật của doanh nghiệp. Hệ thống không tạo sẵn
              xe mẫu để tránh nhầm lẫn với phương tiện có thật.
            </p>
            {canManage && (
              <Button asChild className="mt-6">
                <Link href="/quan-tri/xe/moi">
                  <Plus className="h-4 w-4" aria-hidden />
                  Thêm xe
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Danh sách phương tiện</caption>
            <thead>
              <tr className="border-b border-border bg-navy/5">
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Biển số</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Loại xe</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Đăng kiểm</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Bảo hiểm</th>
                {canManage && (
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const inspection = expiryTone(vehicle.inspectionExpiresAt);
                const insurance = expiryTone(vehicle.insuranceExpiresAt);

                return (
                  <tr key={vehicle.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-mono font-bold text-navy">
                      {vehicle.plateNumber}
                    </th>
                    <td className="px-4 py-3 text-foreground/80">{vehicle.vehicleType.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_TONE[vehicle.status] ?? "neutral"}>
                        {VEHICLE_STATUS_LABELS[
                          vehicle.status as keyof typeof VEHICLE_STATUS_LABELS
                        ] ?? vehicle.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {inspection.tone ? (
                        <Badge variant={inspection.tone}>{inspection.label}</Badge>
                      ) : (
                        <span className="text-foreground/70">{inspection.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {insurance.tone ? (
                        <Badge variant={insurance.tone}>{insurance.label}</Badge>
                      ) : (
                        <span className="text-foreground/70">{insurance.label}</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quan-tri/xe/${vehicle.id}/sua`}
                          className="rounded text-sm font-medium text-orange-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                        >
                          Sửa
                          <span className="sr-only"> xe {vehicle.plateNumber}</span>
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Tải trọng và kích thước thùng xe chỉ hiển thị khi doanh nghiệp đã nhập số liệu thật.
        Hệ thống không suy đoán từ tên loại xe.
      </p>
    </div>
  );
}
