import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { requirePermission } from "@/modules/auth/policy";
import { findVehicleById, listVehicleTypesForSelect } from "@/modules/fleet/repository";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sửa thông tin xe" };

/** `<input type="date">` cần chuỗi `yyyy-mm-dd`. */
function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditVehiclePage({ params }: PageProps<"/quan-tri/xe/[id]/sua">) {
  const { id } = await params;
  const actor = await getActor();
  requirePermission(actor, "fleet.manage");

  const [vehicle, vehicleTypes] = await Promise.all([
    findVehicleById(id),
    listVehicleTypesForSelect(),
  ]);

  if (!vehicle) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
        <Link href="/quan-tri/xe">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Đội xe
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-navy">
          Sửa xe <span className="font-mono">{vehicle.plateNumber}</span>
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Thay đổi được ghi vào nhật ký hệ thống kèm tên người thực hiện.
        </p>
      </div>

      <VehicleForm
        vehicleId={vehicle.id}
        vehicleTypes={vehicleTypes}
        initial={{
          plateNumber: vehicle.plateNumber,
          vehicleTypeSlug: vehicle.vehicleType.slug,
          status: vehicle.status,
          brand: vehicle.brand ?? "",
          model: vehicle.model ?? "",
          manufactureYear: vehicle.manufactureYear?.toString() ?? "",
          inspectionExpiresAt: toDateInput(vehicle.inspectionExpiresAt),
          insuranceExpiresAt: toDateInput(vehicle.insuranceExpiresAt),
          internalNote: vehicle.internalNote ?? "",
        }}
      />
    </div>
  );
}
