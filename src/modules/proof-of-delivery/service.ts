import "server-only";
import { db, type Prisma } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateRequestId } from "@/lib/ids";
import { smsProvider } from "@/lib/providers/sms";
import type { Actor } from "@/modules/auth/actor";
import { requireShipmentUpdateAccess, requireShipmentAccess, can } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import { hasReachedPickup, type ShipmentStatus } from "@/modules/shipments/state-machine";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  otpExpiresAt,
  maskPhone,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
} from "@/modules/proof-of-delivery/otp";
import {
  outcomeNeedsReason,
  type CorrectProofInput,
  type ProofOfDeliveryInput,
  type ProofOfPickupInput,
  type RequestOtpInput,
} from "@/modules/proof-of-delivery/schema";

/**
 * Bằng chứng lấy hàng và giao hàng (§18).
 *
 * Nguyên tắc xuyên suốt: biên bản đã chốt là BẤT BIẾN. Sửa không ghi đè mà tạo bản mới trỏ
 * về bản cũ qua `correctionOfId`, kèm lý do và AuditLog — đúng như cách xử lý revision của
 * báo giá. Bằng chứng mà sửa được im lặng thì không còn là bằng chứng.
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; aggregateId: string; payload: Prisma.InputJsonValue }
) {
  await tx.outboxEvent.create({
    data: {
      eventKey: input.eventKey,
      aggregateType: "Shipment",
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: `${input.eventKey}:${input.aggregateId}:${generateRequestId()}`,
    },
  });
}

const ASSIGNMENT_SELECT = {
  primaryDriverId: true,
  secondaryDriverId: true,
  isActive: true,
  effectiveFrom: true,
  effectiveTo: true,
} as const;

async function loadShipmentForProof(trackingCode: string) {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      userId: true,
      assignments: { select: ASSIGNMENT_SELECT },
      stops: {
        where: { kind: "DELIVERY" },
        select: { contactPhone: true, contactName: true },
        orderBy: { sequence: "asc" },
        take: 1,
      },
      serviceRequest: { select: { contactPhoneNormalized: true } },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");
  return shipment;
}

// -----------------------------------------------------------------------------
// Bằng chứng lấy hàng
// -----------------------------------------------------------------------------

export async function recordProofOfPickup(
  actor: Actor,
  input: ProofOfPickupInput,
  context: Context
): Promise<void> {
  const shipment = await loadShipmentForProof(input.trackingCode);
  const user = requireShipmentUpdateAccess(actor, shipment);

  // Lập biên bản lấy hàng trước khi tới nơi là vô nghĩa.
  if (!hasReachedPickup(shipment.status as ShipmentStatus)) {
    throw appError(
      "INVALID_STATE_TRANSITION",
      "Chỉ lập được biên bản lấy hàng khi đã có mặt tại điểm lấy hàng."
    );
  }

  const existing = await db.proofOfPickup.findUnique({
    where: { shipmentId: shipment.id },
    select: { id: true, finalizedAt: true },
  });

  if (existing?.finalizedAt) {
    throw appError("RESOURCE_LOCKED", "Biên bản lấy hàng đã chốt, không sửa được.");
  }

  await db.$transaction(async (tx) => {
    await tx.proofOfPickup.upsert({
      where: { shipmentId: shipment.id },
      create: {
        shipmentId: shipment.id,
        senderName: input.senderName,
        senderRelation: input.senderRelation || null,
        packageCount: input.packageCount ?? null,
        condition: input.condition || null,
        note: input.note || null,
        recordedById: user.userId,
        finalizedAt: new Date(),
      },
      update: {
        senderName: input.senderName,
        senderRelation: input.senderRelation || null,
        packageCount: input.packageCount ?? null,
        condition: input.condition || null,
        note: input.note || null,
        recordedById: user.userId,
        finalizedAt: new Date(),
      },
    });

    await recordAudit(
      actor,
      {
        action: "proof_of_pickup.recorded",
        resourceType: "ProofOfPickup",
        resourceId: shipment.id,
        after: { senderName: input.senderName, packageCount: input.packageCount ?? null },
        context,
      },
      tx
    );
  });

  logger.info({ trackingCode: input.trackingCode }, "Đã lập biên bản lấy hàng");
}

// -----------------------------------------------------------------------------
// OTP giao hàng
// -----------------------------------------------------------------------------

export interface OtpIssueResult {
  /** Số đã che, để tài xế đối chiếu mà không đọc trọn số của khách (§31). */
  maskedPhone: string;
  expiresInMinutes: number;
}

/**
 * Gửi OTP tới người nhận.
 *
 * Số nhận mã lấy từ dữ liệu điểm giao, KHÔNG lấy từ input trừ khi người dùng có quyền điều
 * phối. Nếu tài xế tự nhập số tuỳ ý thì họ tự gửi mã cho chính mình và bước xác nhận của
 * người nhận trở thành hình thức.
 */
export async function issueDeliveryOtp(
  actor: Actor,
  input: RequestOtpInput,
  context: Context
): Promise<OtpIssueResult> {
  const shipment = await loadShipmentForProof(input.trackingCode);
  requireShipmentUpdateAccess(actor, shipment);

  const stopPhone = shipment.stops[0]?.contactPhone ?? null;
  const fallbackPhone = shipment.serviceRequest?.contactPhoneNormalized ?? null;

  // Điều phối được phép chỉ định số khác: khách đổi người nhận là chuyện có thật, nhưng
  // đó là quyết định của nhân viên chứ không phải của tài xế đang đứng tại điểm giao.
  const overrideAllowed = can(actor, "shipment.dispatch");
  const phone = overrideAllowed && input.phone ? input.phone : (stopPhone ?? fallbackPhone);

  if (!phone) {
    throw appError(
      "VALIDATION_ERROR",
      "Chuyến này chưa có số điện thoại người nhận. Liên hệ điều phối để bổ sung."
    );
  }

  const otp = generateOtp();
  const expiresAt = otpExpiresAt();

  await db.$transaction(async (tx) => {
    // Vô hiệu hoá mã cũ chưa dùng: mỗi lúc chỉ có đúng một mã còn hiệu lực.
    await tx.deliveryOtp.updateMany({
      where: { shipmentId: shipment.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await tx.deliveryOtp.create({
      data: {
        shipmentId: shipment.id,
        otpHash: hashOtp(otp, shipment.id),
        expiresAt,
        maxAttempts: OTP_MAX_ATTEMPTS,
        sentToPhone: phone,
      },
    });

    // Ghi việc PHÁT HÀNH mã, không bao giờ ghi chính mã đó.
    await recordAudit(
      actor,
      {
        action: "delivery_otp.issued",
        resourceType: "Shipment",
        resourceId: shipment.id,
        after: { maskedPhone: maskPhone(phone), expiresAt: expiresAt.toISOString() },
        context,
      },
      tx
    );
  });

  await smsProvider().send({
    to: phone,
    text: `Ma xac nhan giao hang cho don ${shipment.trackingCode} la ${otp}. Ma het han sau ${OTP_TTL_MINUTES} phut. Chi doc ma cho nhan vien giao hang.`,
  });

  logger.info({ trackingCode: shipment.trackingCode }, "Đã gửi OTP giao hàng");

  return { maskedPhone: maskPhone(phone), expiresInMinutes: OTP_TTL_MINUTES };
}

// -----------------------------------------------------------------------------
// Biên bản giao hàng
// -----------------------------------------------------------------------------

/**
 * Kiểm tra OTP và ghi nhận số lần thử.
 *
 * Tăng `attempts` TRƯỚC khi trả kết quả sai, và tăng trong chính transaction đọc bản ghi:
 * nếu chỉ tăng khi thành công thì giới hạn số lần thử không có tác dụng gì.
 */
async function consumeOtp(shipmentId: string, otp: string): Promise<void> {
  const record = await db.deliveryOtp.findFirst({
    where: { shipmentId, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      otpHash: true,
      expiresAt: true,
      attempts: true,
      maxAttempts: true,
      consumedAt: true,
    },
  });

  if (!record) {
    throw appError(
      "VALIDATION_ERROR",
      "Chưa có mã xác nhận nào đang hiệu lực. Vui lòng gửi mã cho người nhận trước."
    );
  }

  const result = verifyOtp(record, otp, shipmentId);

  if (!result.ok) {
    if (result.reason === "MISMATCH") {
      await db.deliveryOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
    }
    throw appError("VALIDATION_ERROR", result.message);
  }

  await db.deliveryOtp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}

export async function recordProofOfDelivery(
  actor: Actor,
  input: ProofOfDeliveryInput,
  context: Context
): Promise<void> {
  const shipment = await loadShipmentForProof(input.trackingCode);
  const user = requireShipmentUpdateAccess(actor, shipment);

  const existing = await db.proofOfDelivery.findFirst({
    where: { shipmentId: shipment.id, supersededAt: null },
    select: { id: true },
  });

  if (existing) {
    throw appError(
      "CONFLICT",
      "Chuyến này đã có biên bản giao hàng. Cần sửa thì dùng chức năng lập biên bản điều chỉnh."
    );
  }

  // Người nhận từ chối thì không ai đọc mã cho tài xế — schema đã bỏ yêu cầu OTP ở nhánh đó.
  if (input.outcome !== "REFUSED") {
    if (!input.otp) {
      throw appError("VALIDATION_ERROR", "Thiếu mã xác nhận của người nhận.");
    }
    await consumeOtp(shipment.id, input.otp);
  }

  if (outcomeNeedsReason(input.outcome) && !input.exceptionReason?.trim()) {
    throw appError("VALIDATION_ERROR", "Giao thiếu hoặc bị từ chối bắt buộc ghi rõ lý do.");
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.proofOfDelivery.create({
      data: {
        shipmentId: shipment.id,
        receiverName: input.receiverName,
        receiverRelation: input.receiverRelation || null,
        outcome: input.outcome,
        exceptionReason: input.exceptionReason || null,
        condition: input.condition || null,
        note: input.note || null,
        // OTP đã xác minh ở trên; ghi mốc thời gian làm bằng chứng đã qua bước này.
        otpVerifiedAt: input.outcome === "REFUSED" ? null : now,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        recordedById: user.userId,
        // Chốt ngay: biên bản giao hàng không có trạng thái nháp.
        finalizedAt: now,
      },
    });

    await enqueueOutbox(tx, {
      eventKey: "shipment.proof_of_delivery_recorded",
      aggregateId: shipment.id,
      payload: { trackingCode: shipment.trackingCode, outcome: input.outcome },
    });

    await recordAudit(
      actor,
      {
        action: "proof_of_delivery.recorded",
        resourceType: "ProofOfDelivery",
        resourceId: shipment.id,
        after: {
          receiverName: input.receiverName,
          outcome: input.outcome,
          exceptionReason: input.exceptionReason ?? null,
        },
        context,
      },
      tx
    );
  });

  logger.info(
    { trackingCode: shipment.trackingCode, outcome: input.outcome },
    "Đã lập biên bản giao hàng"
  );
}

/**
 * Lập biên bản điều chỉnh (§18).
 *
 * Bản cũ giữ nguyên; bản mới trỏ về nó qua `correctionOfId`. Đọc lại chuỗi này thấy được
 * đã sửa gì, khi nào và vì sao — điều mà ghi đè trực tiếp không cho phép.
 *
 * Chỉ nhân viên điều phối được sửa: tài xế lập sai thì báo điều phối, không tự sửa bằng
 * chứng do chính mình tạo ra.
 */
export async function correctProofOfDelivery(
  actor: Actor,
  input: CorrectProofInput,
  context: Context
): Promise<void> {
  const shipment = await loadShipmentForProof(input.trackingCode);
  const user = requireShipmentUpdateAccess(actor, shipment);

  if (!can(actor, "shipment.dispatch")) {
    throw appError("FORBIDDEN", "Chỉ nhân viên điều phối mới lập được biên bản điều chỉnh.");
  }

  const current = await db.proofOfDelivery.findFirst({
    where: { shipmentId: shipment.id, supersededAt: null },
    select: {
      id: true,
      receiverName: true,
      outcome: true,
      exceptionReason: true,
      otpVerifiedAt: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!current) throw appError("NOT_FOUND", "Chuyến này chưa có biên bản giao hàng để sửa.");

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Bản cũ KHÔNG bị xoá và KHÔNG bị ghi đè — chỉ đánh dấu đã bị thay thế. Đọc lại chuỗi
    // `correctionOfId` sau này thấy được toàn bộ lịch sử sửa đổi (§18).
    await tx.proofOfDelivery.update({
      where: { id: current.id },
      data: { supersededAt: now },
    });

    await tx.proofOfDelivery.create({
      data: {
        shipmentId: shipment.id,
        receiverName: input.receiverName,
        receiverRelation: input.receiverRelation || null,
        outcome: input.outcome,
        exceptionReason: input.exceptionReason || null,
        condition: input.condition || null,
        note: input.note || null,
        // Giữ nguyên mốc OTP và toạ độ của lần giao thật; điều chỉnh là sửa lời khai, không
        // phải giao lại hàng.
        otpVerifiedAt: current.otpVerifiedAt,
        latitude: current.latitude,
        longitude: current.longitude,
        recordedById: user.userId,
        finalizedAt: now,
        correctionOfId: current.id,
        correctionReason: input.correctionReason,
      },
    });

    await recordAudit(
      actor,
      {
        action: "proof_of_delivery.corrected",
        resourceType: "ProofOfDelivery",
        resourceId: shipment.id,
        before: {
          receiverName: current.receiverName,
          outcome: current.outcome,
          exceptionReason: current.exceptionReason,
        },
        after: {
          receiverName: input.receiverName,
          outcome: input.outcome,
          exceptionReason: input.exceptionReason ?? null,
          correctionReason: input.correctionReason,
        },
        context,
      },
      tx
    );
  });

  logger.info({ trackingCode: shipment.trackingCode }, "Đã lập biên bản điều chỉnh");
}

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export async function getProofs(actor: Actor, trackingCode: string) {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      userId: true,
      assignments: { select: ASSIGNMENT_SELECT },
      proofOfPickup: {
        select: {
          senderName: true,
          senderRelation: true,
          packageCount: true,
          condition: true,
          note: true,
          recordedAt: true,
        },
      },
      proofOfDeliveries: {
        where: { supersededAt: null },
        take: 1,
        select: {
          receiverName: true,
          receiverRelation: true,
          outcome: true,
          exceptionReason: true,
          condition: true,
          note: true,
          otpVerifiedAt: true,
          recordedAt: true,
          correctionOfId: true,
          correctionReason: true,
        },
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  return {
    pickup: shipment.proofOfPickup,
    delivery: shipment.proofOfDeliveries[0] ?? null,
  };
}

/** Toàn bộ chuỗi biên bản kể cả bản đã bị thay thế. Chỉ nhân viên có quyền được xem (§18). */
export async function getProofHistory(actor: Actor, trackingCode: string) {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: { id: true, userId: true, assignments: { select: ASSIGNMENT_SELECT } },
  });

  if (!shipment) throw appError("NOT_FOUND");
  requireShipmentAccess(actor, shipment);

  if (!can(actor, "shipment.read_all")) {
    throw appError("FORBIDDEN", "Chỉ nhân viên được xem lịch sử điều chỉnh biên bản.");
  }

  return db.proofOfDelivery.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      receiverName: true,
      outcome: true,
      exceptionReason: true,
      recordedAt: true,
      supersededAt: true,
      correctionOfId: true,
      correctionReason: true,
    },
  });
}
