"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { updateDriver } from "@/modules/fleet/service";
import { driverSchema } from "@/modules/fleet/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";
import type { FleetActionResult } from "@/app/quan-tri/xe/actions";

/** Server action cho hồ sơ tài xế (§14.2). Quyền kiểm tra trong service. */

export async function updateDriverAction(
  id: string,
  formData: FormData
): Promise<FleetActionResult> {
  const parsed = driverSchema.safeParse({
    employeeCode: String(formData.get("employeeCode") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    workPhone: String(formData.get("workPhone") ?? ""),
    licenseClass: String(formData.get("licenseClass") ?? "") || undefined,
    licenseNumber: String(formData.get("licenseNumber") ?? "") || undefined,
    licenseExpiresAt: String(formData.get("licenseExpiresAt") ?? "") || undefined,
    status: String(formData.get("status") ?? "ACTIVE"),
    emergencyContactName: String(formData.get("emergencyContactName") ?? "") || undefined,
    emergencyContactPhone: String(formData.get("emergencyContactPhone") ?? "") || undefined,
    internalNote: String(formData.get("internalNote") ?? "") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Vui lòng kiểm tra lại thông tin.", fieldErrors };
  }

  const actor = await getActor();
  const requestHeaders = await headers();

  try {
    await updateDriver(actor, id, parsed.data, {
      ipAddress: getClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      requestId: generateRequestId(),
    });
  } catch (error) {
    return {
      ok: false,
      message: isAppError(error) ? error.message : "Thao tác không thành công. Vui lòng thử lại.",
    };
  }

  revalidatePath("/quan-tri/tai-xe");
  revalidatePath(`/quan-tri/tai-xe/${id}/sua`);

  return { ok: true, message: "Đã cập nhật hồ sơ tài xế." };
}
