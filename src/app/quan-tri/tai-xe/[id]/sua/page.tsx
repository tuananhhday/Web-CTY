import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import { findDriverById } from "@/modules/fleet/repository";
import { DriverForm } from "@/components/admin/driver-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sửa hồ sơ tài xế" };

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditDriverPage({ params }: PageProps<"/quan-tri/tai-xe/[id]/sua">) {
  const { id } = await params;
  const actor = await getActor();
  requirePermission(actor, "fleet.manage");

  const driver = await findDriverById(id);
  if (!driver) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/tai-xe">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tài xế
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-navy">Sửa hồ sơ {driver.fullName}</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Tài khoản đăng nhập: {driver.user.email}. Đổi email hoặc mật khẩu thuộc phần quản
          lý người dùng, không sửa được ở đây.
        </p>
      </div>

      <DriverForm
        driverId={driver.id}
        initial={{
          employeeCode: driver.employeeCode,
          fullName: driver.fullName,
          workPhone: driver.workPhone,
          licenseClass: driver.licenseClass ?? "",
          licenseNumber: driver.licenseNumber ?? "",
          licenseExpiresAt: toDateInput(driver.licenseExpiresAt),
          status: driver.status,
          emergencyContactName: driver.emergencyContactName ?? "",
          emergencyContactPhone: driver.emergencyContactPhone ?? "",
          internalNote: driver.internalNote ?? "",
        }}
      />
    </div>
  );
}
