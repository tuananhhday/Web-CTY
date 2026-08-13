"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { createVehicle, updateVehicle } from "@/modules/fleet/service";
import { vehicleSchema } from "@/modules/fleet/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/** Server action cho quản lý đội xe (§14.1). Quyền kiểm tra trong service. */

export interface FleetActionResult {
  ok: boolean;
  message?: string;
  /** Lỗi theo từng trường, để form gắn vào đúng ô nhập. */
  fieldErrors?: Record<string, string>;
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
    requestId: generateRequestId(),
  };
}

function toMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "Thao tác không thành công. Vui lòng thử lại.";
}

/** Ô nhập số để trống trả về "" — Zod `.number().optional()` cần undefined, không phải "". */
function parseVehicleForm(formData: FormData) {
  const year = String(formData.get("manufactureYear") ?? "").trim();

  return {
    plateNumber: String(formData.get("plateNumber") ?? ""),
    vehicleTypeSlug: String(formData.get("vehicleTypeSlug") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    brand: String(formData.get("brand") ?? "") || undefined,
    model: String(formData.get("model") ?? "") || undefined,
    manufactureYear: year ? Number(year) : undefined,
    inspectionExpiresAt: String(formData.get("inspectionExpiresAt") ?? "") || undefined,
    insuranceExpiresAt: String(formData.get("insuranceExpiresAt") ?? "") || undefined,
    internalNote: String(formData.get("internalNote") ?? "") || undefined,
  };
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createVehicleAction(formData: FormData): Promise<FleetActionResult> {
  const parsed = vehicleSchema.safeParse(parseVehicleForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng kiểm tra lại thông tin.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const actor = await getActor();

  try {
    await createVehicle(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath("/quan-tri/xe");

  return { ok: true, message: `Đã thêm xe ${parsed.data.plateNumber}.` };
}

export async function updateVehicleAction(
  id: string,
  formData: FormData
): Promise<FleetActionResult> {
  const parsed = vehicleSchema.safeParse(parseVehicleForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng kiểm tra lại thông tin.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const actor = await getActor();

  try {
    await updateVehicle(actor, id, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidatePath("/quan-tri/xe");
  revalidatePath(`/quan-tri/xe/${id}`);

  return { ok: true, message: "Đã cập nhật thông tin xe." };
}
