"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getActor } from "@/modules/auth/session";
import { changeIncidentStatus, updateIncident } from "@/modules/incidents/service";
import {
  changeIncidentStatusSchema,
  updateIncidentSchema,
} from "@/modules/incidents/schema";
import { isAppError } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { getClientIp } from "@/lib/rate-limit";

/** Server action cho quản lý sự cố (§19). Quyền kiểm tra trong service. */

export interface IncidentActionResult {
  ok: boolean;
  message?: string;
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

function revalidate(code: string) {
  revalidatePath("/quan-tri/su-co");
  revalidatePath(`/quan-tri/su-co/${code}`);
  revalidatePath("/quan-tri");
}

export async function changeIncidentStatusAction(
  code: string,
  formData: FormData
): Promise<IncidentActionResult> {
  const parsed = changeIncidentStatusSchema.safeParse({
    code,
    toStatus: String(formData.get("toStatus") ?? ""),
    resolution: String(formData.get("resolution") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await changeIncidentStatus(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(code);

  return { ok: true, message: "Đã cập nhật trạng thái sự cố." };
}

export async function updateIncidentAction(
  code: string,
  formData: FormData
): Promise<IncidentActionResult> {
  const severity = String(formData.get("severity") ?? "");

  const parsed = updateIncidentSchema.safeParse({
    code,
    severity: severity || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const actor = await getActor();

  try {
    await updateIncident(actor, parsed.data, await requestContext());
  } catch (error) {
    return { ok: false, message: toMessage(error) };
  }

  revalidate(code);

  return { ok: true, message: "Đã cập nhật mức độ sự cố." };
}
