import "server-only";
import { createHash } from "node:crypto";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  generateRequestCode,
  generateSecureToken,
  generateRequestId,
} from "@/lib/ids";
import { normalizePhone } from "@/lib/normalize";
import { addDays } from "@/lib/datetime";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requirePermission, requireReadOwned } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import * as repo from "@/modules/service-requests/repository";
import {
  assertTransition,
  transitionActorOf,
  type RequestStatus,
} from "@/modules/service-requests/state-machine";
import type {
  FreightRequestInput,
  MovingRequestInput,
  ListRequestsQuery,
} from "@/modules/service-requests/schema";

/**
 * Nghiệp vụ yêu cầu dịch vụ (§11, §12).
 *
 * Mọi thao tác ghi đều nằm trong transaction cùng với `RequestStatusEvent`, `AuditLog`
 * và `OutboxEvent` — nếu một phần thất bại thì toàn bộ rollback, không để lại trạng thái
 * nửa vời hay thông báo sai sự thật (§21, §32.2).
 */

/** Token truy cập dành cho khách chưa đăng nhập, hết hạn sau 30 ngày. */
const GUEST_TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Ghi OutboxEvent trong cùng transaction để không mất thông báo (§21). */
async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "ServiceRequest",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

export interface CreateRequestResult {
  code: string;
  /** Chỉ trả về khi khách CHƯA đăng nhập — dùng để dựng link theo dõi gửi qua email. */
  guestAccessToken?: string;
}

// -----------------------------------------------------------------------------
// Tạo yêu cầu vận chuyển hàng hóa
// -----------------------------------------------------------------------------

export async function createFreightRequest(
  actor: Actor,
  input: FreightRequestInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<CreateRequestResult> {
  const contactPhoneNormalized = normalizePhone(input.contactPhone);
  if (!contactPhoneNormalized) {
    throw appError("VALIDATION_ERROR", "Số điện thoại không hợp lệ.", {
      fields: [{ path: "contactPhone", message: "Số điện thoại không hợp lệ" }],
    });
  }

  const service = await db.service.findFirst({
    where: { slug: input.serviceSlug, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!service) {
    throw appError("VALIDATION_ERROR", "Dịch vụ không tồn tại hoặc chưa được công bố.", {
      fields: [{ path: "serviceSlug", message: "Dịch vụ không hợp lệ" }],
    });
  }

  const vehicleType = input.requestedVehicleTypeSlug
    ? await db.vehicleType.findFirst({
        where: { slug: input.requestedVehicleTypeSlug, status: "PUBLISHED" },
        select: { id: true },
      })
    : null;

  const userId = isAuthenticated(actor) ? actor.userId : null;
  const code = generateRequestCode();

  // Khách chưa đăng nhập cần token để xem lại yêu cầu; token thô chỉ tồn tại trong
  // biến này và trong email gửi đi, database chỉ lưu hash (§11).
  const guestToken = userId ? undefined : generateSecureToken();

  const created = await db.$transaction(async (tx) => {
    const request = await tx.serviceRequest.create({
      data: {
        code,
        kind: "FREIGHT",
        userId,
        serviceId: service.id,
        requestedVehicleTypeId: vehicleType?.id ?? null,

        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactPhoneNormalized,
        contactEmail: input.contactEmail ?? null,
        companyName: input.companyName ?? null,

        preferredPickupAt: input.preferredPickupAt ? new Date(input.preferredPickupAt) : null,
        preferredDeliveryAt: input.preferredDeliveryAt
          ? new Date(input.preferredDeliveryAt)
          : null,

        needsLoading: input.needsLoading,
        needsPacking: input.needsPacking,
        needsAssembly: input.needsAssembly,
        needsHoisting: input.needsHoisting,

        declaredValue: input.declaredValue?.toFixed(0) ?? null,
        note: input.note ?? null,

        status: "SUBMITTED",
        submittedAt: new Date(),

        ...(guestToken
          ? {
              guestAccessTokenHash: hashToken(guestToken),
              guestTokenExpiresAt: addDays(new Date(), GUEST_TOKEN_TTL_DAYS),
            }
          : {}),

        stops: {
          create: [
            { ...toStopData(input.pickup), kind: "PICKUP", sequence: 0 },
            { ...toStopData(input.dropoff), kind: "DELIVERY", sequence: 1 },
          ],
        },

        cargoItems: {
          create: input.items.map((item) => ({
            cargoType: item.cargoType,
            quantity: item.quantity,
            weightKg: item.weightKg.toFixed(2),
            lengthCm: item.lengthCm ?? null,
            widthCm: item.widthCm ?? null,
            heightCm: item.heightCm ?? null,
            volumeM3: computeVolumeM3(item),
            isFragile: item.isFragile,
            isValuable: item.isValuable,
            note: item.note ?? null,
          })),
        },

        // Sự kiện trạng thái đầu tiên nằm cùng transaction (§11).
        statusEvents: {
          create: {
            fromStatus: null,
            toStatus: "SUBMITTED",
            actorId: userId,
            actorRole: isAuthenticated(actor) ? (actor.roles[0] ?? null) : null,
            reason: "Khách hàng gửi yêu cầu",
          },
        },
      },
      select: { id: true, code: true },
    });

    await enqueueOutbox(tx, {
      eventKey: "request.submitted",
      aggregateId: request.id,
      payload: { code: request.code, kind: "FREIGHT", hasAccount: Boolean(userId) },
    });

    await recordAudit(
      actor,
      {
        action: "request.created",
        resourceType: "ServiceRequest",
        resourceId: request.id,
        after: { code: request.code, kind: "FREIGHT", status: "SUBMITTED" },
        context,
      },
      tx
    );

    return request;
  });

  logger.info({ code: created.code, kind: "FREIGHT" }, "Đã tạo yêu cầu vận chuyển");

  return { code: created.code, guestAccessToken: guestToken };
}

// -----------------------------------------------------------------------------
// Tạo yêu cầu chuyển nhà
// -----------------------------------------------------------------------------

export async function createMovingRequest(
  actor: Actor,
  input: MovingRequestInput,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<CreateRequestResult> {
  const contactPhoneNormalized = normalizePhone(input.contactPhone);
  if (!contactPhoneNormalized) {
    throw appError("VALIDATION_ERROR", "Số điện thoại không hợp lệ.", {
      fields: [{ path: "contactPhone", message: "Số điện thoại không hợp lệ" }],
    });
  }

  // Dịch vụ chuyển nhà phải đang bật thì mới nhận yêu cầu (§3.1).
  const service = await db.service.findFirst({
    where: { isMovingService: true, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!service) {
    throw appError(
      "VALIDATION_ERROR",
      "Dịch vụ chuyển nhà hiện chưa được cung cấp. Vui lòng liên hệ hotline."
    );
  }

  const userId = isAuthenticated(actor) ? actor.userId : null;
  const code = generateRequestCode();
  const guestToken = userId ? undefined : generateSecureToken();

  const created = await db.$transaction(async (tx) => {
    const request = await tx.serviceRequest.create({
      data: {
        code,
        kind: "MOVING",
        userId,
        serviceId: service.id,

        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactPhoneNormalized,
        contactEmail: input.contactEmail ?? null,
        companyName: input.companyName ?? null,

        needsPacking: input.needsPacking,
        needsAssembly: input.needsDisassembly,
        note: input.note ?? null,

        status: "SUBMITTED",
        submittedAt: new Date(),

        ...(guestToken
          ? {
              guestAccessTokenHash: hashToken(guestToken),
              guestTokenExpiresAt: addDays(new Date(), GUEST_TOKEN_TTL_DAYS),
            }
          : {}),

        stops: {
          create: [
            { ...toStopData(input.origin), kind: "PICKUP", sequence: 0 },
            { ...toStopData(input.destination), kind: "DELIVERY", sequence: 1 },
          ],
        },

        movingDetail: {
          create: {
            propertyType: input.propertyType,

            originFloor: input.origin.floorNumber ?? null,
            originHasElevator: input.origin.hasElevator ?? null,
            originCarryDistanceM: input.origin.carryDistanceM ?? null,

            destinationFloor: input.destination.floorNumber ?? null,
            destinationHasElevator: input.destination.hasElevator ?? null,
            destinationCarryDistanceM: input.destination.carryDistanceM ?? null,

            preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
            preferredTimeSlot: input.preferredTimeSlot ?? null,

            needsCartons: input.needsCartons,
            cartonQuantity: input.cartonQuantity ?? null,
            needsPacking: input.needsPacking,
            needsDisassembly: input.needsDisassembly,
            needsCleaning: input.needsCleaning,

            requestsSiteSurvey: input.requestsSiteSurvey,
            note: input.note ?? null,

            inventoryItems: {
              create: input.inventoryItems.map((item) => ({
                category: item.category,
                name: item.name,
                quantity: item.quantity,
                estimatedWeightKg: item.estimatedWeightKg?.toFixed(2) ?? null,
                isFragile: item.isFragile,
                isHighValue: item.isHighValue,
                needsDisassembly: item.needsDisassembly,
                note: item.note ?? null,
                // Phân biệt rõ mục do khách khai với mục nhân viên bổ sung sau khảo sát (§12).
                addedByStaff: false,
              })),
            },
          },
        },

        statusEvents: {
          create: {
            fromStatus: null,
            toStatus: "SUBMITTED",
            actorId: userId,
            actorRole: isAuthenticated(actor) ? (actor.roles[0] ?? null) : null,
            reason: "Khách hàng gửi yêu cầu chuyển nhà",
          },
        },
      },
      select: { id: true, code: true },
    });

    await enqueueOutbox(tx, {
      eventKey: "request.submitted",
      aggregateId: request.id,
      payload: {
        code: request.code,
        kind: "MOVING",
        requestsSiteSurvey: input.requestsSiteSurvey,
        hasAccount: Boolean(userId),
      },
    });

    await recordAudit(
      actor,
      {
        action: "request.created",
        resourceType: "ServiceRequest",
        resourceId: request.id,
        after: {
          code: request.code,
          kind: "MOVING",
          status: "SUBMITTED",
          inventoryCount: input.inventoryItems.length,
        },
        context,
      },
      tx
    );

    return request;
  });

  logger.info({ code: created.code, kind: "MOVING" }, "Đã tạo yêu cầu chuyển nhà");

  return { code: created.code, guestAccessToken: guestToken };
}

// -----------------------------------------------------------------------------
// Đổi trạng thái
// -----------------------------------------------------------------------------

export async function changeStatus(
  actor: Actor,
  code: string,
  toStatus: RequestStatus,
  reason: string | undefined,
  context: { ipAddress?: string | null; userAgent?: string | null; requestId?: string }
): Promise<void> {
  const existing = await repo.findRequestOwnership(code);
  if (!existing) throw appError("NOT_FOUND");

  // Không có quyền toàn hệ thống thì phải là chủ sở hữu; trả NOT_FOUND để không lộ.
  requireReadOwned(actor, existing.userId, "request.read_all");

  const from = existing.status as RequestStatus;
  const by = transitionActorOf(actor);

  // Ném INVALID_STATE_TRANSITION nếu bước chuyển không hợp lệ hoặc thiếu lý do.
  assertTransition(from, toStatus, by, { reason });

  await db.$transaction(async (tx) => {
    // Điều kiện `status: from` chống race: hai người cùng đổi thì người sau thất bại
    // thay vì ghi đè âm thầm.
    const updated = await tx.serviceRequest.updateMany({
      where: { id: existing.id, status: from },
      data: { status: toStatus },
    });

    if (updated.count === 0) {
      throw appError(
        "STALE_VERSION",
        "Trạng thái yêu cầu vừa được người khác thay đổi. Vui lòng tải lại trang."
      );
    }

    await tx.requestStatusEvent.create({
      data: {
        serviceRequestId: existing.id,
        fromStatus: from,
        toStatus,
        actorId: isAuthenticated(actor) ? actor.userId : null,
        actorRole: isAuthenticated(actor) ? (actor.roles[0] ?? null) : null,
        reason: reason ?? null,
      },
    });

    await enqueueOutbox(tx, {
      eventKey: `request.${toStatus.toLowerCase()}`,
      aggregateId: existing.id,
      payload: { code, fromStatus: from, toStatus },
    });

    await recordAudit(
      actor,
      {
        action: "request.status_changed",
        resourceType: "ServiceRequest",
        resourceId: existing.id,
        before: { status: from },
        after: { status: toStatus, reason: reason ?? null },
        context,
      },
      tx
    );
  });

  logger.info({ code, from, to: toStatus }, "Đã đổi trạng thái yêu cầu");
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export async function listMyRequests(actor: Actor, query: ListRequestsQuery) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");
  return repo.listRequestsForUser(actor.userId, query);
}

export async function getMyRequest(actor: Actor, code: string) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const request = await repo.findRequestForUser(code, actor.userId);
  if (!request) throw appError("NOT_FOUND");

  return request;
}

export async function listAllRequests(actor: Actor, query: ListRequestsQuery) {
  requirePermission(actor, "request.read_all");
  return repo.listAllRequests(query);
}

export async function getRequestAsStaff(actor: Actor, code: string) {
  requirePermission(actor, "request.read_all");

  const request = await repo.findRequestByCode(code);
  if (!request) throw appError("NOT_FOUND");

  return request;
}

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------

function toStopData(stop: {
  contactName?: string;
  contactPhone?: string;
  line: string;
  ward?: string;
  district?: string;
  province: string;
  latitude?: number;
  longitude?: number;
  floorNumber?: number;
  hasElevator?: boolean;
  carryDistanceM?: number;
  accessNote?: string;
}) {
  return {
    contactName: stop.contactName || null,
    contactPhone: stop.contactPhone || null,
    line: stop.line,
    ward: stop.ward || null,
    district: stop.district || null,
    province: stop.province,
    latitude: stop.latitude?.toFixed(7) ?? null,
    longitude: stop.longitude?.toFixed(7) ?? null,
    floorNumber: stop.floorNumber ?? null,
    hasElevator: stop.hasElevator ?? null,
    carryDistanceM: stop.carryDistanceM ?? null,
    accessNote: stop.accessNote || null,
  };
}

/** Tính thể tích từ kích thước, chỉ khi có đủ ba chiều. */
function computeVolumeM3(item: {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
}): string | null {
  if (!item.lengthCm || !item.widthCm || !item.heightCm) return null;

  const cubicMeters =
    (item.lengthCm * item.widthCm * item.heightCm * item.quantity) / 1_000_000;

  return cubicMeters.toFixed(3);
}
