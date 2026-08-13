import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import { listVehicleTypesForSelect } from "@/modules/fleet/repository";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Thêm xe" };

export default async function NewVehiclePage() {
  const actor = await getActor();
  requirePermission(actor, "fleet.manage");

  const vehicleTypes = await listVehicleTypesForSelect();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/xe">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Đội xe
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-navy">Thêm xe</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Chỉ nhập số liệu có thật trên giấy tờ xe. Trường chưa có thông tin thì để trống.
        </p>
      </div>

      <VehicleForm vehicleTypes={vehicleTypes} />
    </div>
  );
}
