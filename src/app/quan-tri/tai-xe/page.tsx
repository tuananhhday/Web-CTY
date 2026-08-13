import type { Metadata } from "next";
import Link from "next/link";
import { UserRound, AlertTriangle } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission, can } from "@/modules/auth/policy";
import { listDrivers } from "@/modules/fleet/repository";
import { DRIVER_STATUS_LABELS } from "@/modules/fleet/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, addDays } from "@/lib/datetime";
import { formatPhoneForDisplay } from "@/lib/normalize";

export const metadata: Metadata = { title: "Tài xế" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error"> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  SUSPENDED: "error",
  INACTIVE: "neutral",
};

export default async function DriversPage() {
  const actor = await getActor();
  requirePermission(actor, "fleet.read");

  const drivers = await listDrivers();
  const canManage = can(actor, "fleet.manage");
  const soon = addDays(new Date(), 30);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Tài xế</h1>
          <p className="mt-1 text-sm text-foreground/70">{drivers.length} tài xế</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/quan-tri/xe">Xem đội xe</Link>
        </Button>
      </div>

      {drivers.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <UserRound className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Chưa có tài xế nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Tài khoản tài xế do quản trị viên tạo, không đăng ký công khai (§9).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Danh sách tài xế</caption>
            <thead>
              <tr className="border-b border-border bg-navy/5">
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Mã NS</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Họ tên</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Điện thoại</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Hạng bằng</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Hạn bằng lái</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Trạng thái</th>
                {canManage && (
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const expiry = driver.licenseExpiresAt;
                const expired = expiry !== null && expiry <= new Date();
                const expiringSoon = expiry !== null && !expired && expiry <= soon;

                return (
                  <tr key={driver.id} className="border-b border-border last:border-0">
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-mono text-xs font-bold text-navy"
                    >
                      {driver.employeeCode}
                    </th>
                    <td className="px-4 py-3 font-medium text-navy">{driver.fullName}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${driver.workPhoneNormalized}`}
                        className="text-foreground/80 hover:text-orange-text"
                      >
                        {formatPhoneForDisplay(driver.workPhoneNormalized)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{driver.licenseClass ?? "—"}</td>
                    <td className="px-4 py-3">
                      {!expiry ? (
                        <span className="text-muted">Chưa có thông tin</span>
                      ) : expired ? (
                        <Badge variant="error">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Hết hạn {formatDate(expiry)}
                        </Badge>
                      ) : expiringSoon ? (
                        <Badge variant="warning">Còn hạn tới {formatDate(expiry)}</Badge>
                      ) : (
                        <span className="text-foreground/70">{formatDate(expiry)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_TONE[driver.status] ?? "neutral"}>
                        {DRIVER_STATUS_LABELS[
                          driver.status as keyof typeof DRIVER_STATUS_LABELS
                        ] ?? driver.status}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/quan-tri/tai-xe/${driver.id}/sua`}
                          className="rounded text-sm font-medium text-orange-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                        >
                          Sửa
                          <span className="sr-only"> hồ sơ {driver.fullName}</span>
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
        Người liên hệ khẩn cấp của tài xế chỉ hiển thị cho nhân viên có quyền, không đưa vào
        danh sách này (§14.2).
      </p>
    </div>
  );
}
