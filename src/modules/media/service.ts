import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storageProvider, type UploadTarget } from "@/lib/providers/storage";
import { virusScanProvider } from "@/lib/providers/virus-scan";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requireShipmentUpdateAccess, requireShipmentAccess, can } from "@/modules/auth/policy";
import { recordAudit } from "@/modules/audit/service";
import {
  detectFileType,
  kindOfMimeType,
  maxSizeFor,
  MAGIC_BYTES_LENGTH,
} from "@/modules/media/file-types";
import {
  MAX_MEDIA_PER_STAGE,
  type ConfirmUploadInput,
  type UpdateMediaInput,
  type UploadIntentInput,
} from "@/modules/media/schema";

/**
 * Media theo giai đoạn — luồng upload 8 bước của §16.3.
 *
 *   1. Client xin upload intent                     → `createUploadIntent`
 *   2. Server kiểm tra quyền, số lượng, MIME, dung lượng
 *   3. Server sinh object key và trả URL ngắn hạn
 *   4. Client tải thẳng lên storage
 *   5. Client gọi confirm                            → `confirmUpload`
 *   6. Server kiểm tra tồn tại, kích thước, magic bytes, checksum, quét mã độc
 *   7. Chỉ media READY mới được hiển thị
 *   8. Tải/xem qua URL ký ngắn hạn                   → `getMediaForDownload`
 *
 * Bản ghi được tạo ở bước 1 với trạng thái `QUARANTINED`, không phải sau khi upload xong.
 * Nhờ vậy file tải lên nhưng client không gọi confirm vẫn có dấu vết để dọn, thay vì thành
 * file mồ côi nằm mãi trong storage.
 */

type Context = { ipAddress?: string | null; userAgent?: string | null; requestId?: string };

/**
 * Object key do SERVER sinh, không dùng tên file người dùng (§16.3 bước 3).
 *
 * Tên file người dùng có thể chứa `../`, ký tự điều khiển, hoặc trùng nhau giữa các chuyến.
 * UUID thì không. Thư mục theo chuyến và giai đoạn để dọn dẹp và soát lại dễ hơn.
 */
function buildObjectKey(input: {
  shipmentId: string;
  stage: string;
  extension: string;
}): string {
  return `shipments/${input.shipmentId}/${input.stage.toLowerCase()}/${randomUUID()}.${input.extension}`;
}

// -----------------------------------------------------------------------------
// Bước 1–3: upload intent
// -----------------------------------------------------------------------------

export interface UploadIntentResult {
  mediaId: string;
  upload: UploadTarget;
}

/**
 * Không ghi AuditLog ở bước này: intent chỉ là xin phép, phần lớn kết thúc bằng một lần
 * confirm ngay sau đó và `media.uploaded` đã ghi đủ. Intent bị bỏ dở vẫn còn bản ghi
 * `QUARANTINED` trong database để dọn, nên không mất dấu vết.
 */
export async function createUploadIntent(
  actor: Actor,
  input: UploadIntentInput
): Promise<UploadIntentResult> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode: input.trackingCode },
    select: {
      id: true,
      status: true,
      assignments: {
        select: {
          primaryDriverId: true,
          secondaryDriverId: true,
          isActive: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  // Bước 2: chỉ tài xế đang được phân công hoặc nhân viên có quyền mới tải lên được.
  const user = requireShipmentUpdateAccess(actor, shipment);

  const existing = await db.shipmentMedia.count({
    where: {
      shipmentId: shipment.id,
      stage: input.stage,
      status: { not: "REJECTED" },
    },
  });

  if (existing >= MAX_MEDIA_PER_STAGE) {
    throw appError(
      "VALIDATION_ERROR",
      `Mỗi giai đoạn tối đa ${MAX_MEDIA_PER_STAGE} tệp. Hãy xoá bớt trước khi tải thêm.`
    );
  }

  const kind = kindOfMimeType(input.mimeType);
  const maxBytes = maxSizeFor(input.mimeType);
  if (!kind || maxBytes === null) {
    throw appError("UNSUPPORTED_MEDIA_TYPE", "Định dạng tệp không được hỗ trợ.");
  }
  if (input.sizeBytes > maxBytes) {
    throw appError("PAYLOAD_TOO_LARGE", "Tệp vượt quá dung lượng cho phép.");
  }

  const extension = input.mimeType.split("/")[1] ?? "bin";
  const objectKey = buildObjectKey({
    shipmentId: shipment.id,
    stage: input.stage,
    extension,
  });

  const media = await db.shipmentMedia.create({
    data: {
      shipmentId: shipment.id,
      stage: input.stage,
      kind,
      objectKey,
      // MIME client khai báo, ghi tạm để đối chiếu; bước confirm ghi đè bằng MIME thật.
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      caption: input.caption ?? null,
      visibility: input.visibility,
      status: "QUARANTINED",
      uploadedById: user.userId,
      capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
    },
    select: { id: true },
  });

  const upload = await storageProvider().createUploadTarget({
    objectKey,
    mimeType: input.mimeType,
    maxBytes,
  });

  logger.info({ mediaId: media.id, stage: input.stage }, "Đã cấp upload intent");

  return { mediaId: media.id, upload };
}

// -----------------------------------------------------------------------------
// Bước 5–7: xác nhận và xác minh
// -----------------------------------------------------------------------------

/** Đánh dấu REJECTED kèm lý do thay vì xoá — giữ dấu vết vì sao tệp bị loại (§16.2). */
async function reject(mediaId: string, objectKey: string, reason: string) {
  await db.shipmentMedia.update({
    where: { id: mediaId },
    data: { status: "REJECTED", rejectReason: reason },
  });

  // Nội dung không đạt thì không giữ lại trong storage.
  await storageProvider().remove(objectKey);

  logger.warn({ mediaId, reason }, "Từ chối tệp tải lên");

  throw appError("VALIDATION_ERROR", reason);
}

export async function confirmUpload(
  actor: Actor,
  input: ConfirmUploadInput,
  context: Context
): Promise<{ status: "READY" }> {
  const media = await db.shipmentMedia.findUnique({
    where: { id: input.mediaId },
    select: {
      id: true,
      objectKey: true,
      sizeBytes: true,
      stage: true,
      status: true,
      uploadedById: true,
      shipment: {
        select: {
          id: true,
          status: true,
          assignments: {
            select: {
              primaryDriverId: true,
              secondaryDriverId: true,
              isActive: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          },
        },
      },
    },
  });

  if (!media) throw appError("NOT_FOUND");

  requireShipmentUpdateAccess(actor, media.shipment);

  if (media.status !== "QUARANTINED") {
    throw appError("CONFLICT", "Tệp này đã được xử lý rồi.");
  }

  await db.shipmentMedia.update({
    where: { id: media.id },
    data: { status: "PROCESSING" },
  });

  const storage = storageProvider();

  // Bước 6a: tệp có thật sự nằm trong storage không.
  const info = await storage.head(media.objectKey);
  if (!info) {
    await reject(media.id, media.objectKey, "Không tìm thấy tệp đã tải lên.");
  }

  // Bước 6b: kích thước thật phải khớp khai báo. Lệch nghĩa là client gửi khác lời khai.
  if (info!.sizeBytes !== media.sizeBytes) {
    await reject(
      media.id,
      media.objectKey,
      "Dung lượng tệp không khớp với thông tin đã khai báo."
    );
  }

  // Bước 6c: nhận dạng bằng magic bytes. Đây là chỗ chặn SVG, HTML và file thực thi đội lốt
  // ảnh — Content-Type client gửi hoàn toàn không được dùng để quyết định (§16.3).
  const head = await storage.readHead(media.objectKey, MAGIC_BYTES_LENGTH);
  const detected = detectFileType(head);

  if (!detected) {
    await reject(
      media.id,
      media.objectKey,
      "Nội dung tệp không phải định dạng ảnh, video hay tài liệu được hỗ trợ."
    );
  }

  // Bước 6d: checksum client khai báo, nếu có.
  if (input.checksum && input.checksum.toLowerCase() !== info!.checksum) {
    await reject(media.id, media.objectKey, "Checksum không khớp, tệp có thể bị lỗi khi tải lên.");
  }

  // Bước 6e: quét mã độc.
  const verdict = await virusScanProvider().scan({
    objectKey: media.objectKey,
    sizeBytes: info!.sizeBytes,
  });

  if (!verdict.clean) {
    await reject(media.id, media.objectKey, `Tệp bị từ chối: ${verdict.reason}`);
  }

  // Bước 7: chỉ tới đây tệp mới hiển thị được.
  await db.shipmentMedia.update({
    where: { id: media.id },
    data: {
      status: "READY",
      // Ghi MIME ĐÃ XÁC MINH, không phải cái client khai.
      mimeType: detected!.mimeType,
      kind: detected!.kind,
      checksum: info!.checksum,
    },
  });

  await recordAudit(actor, {
    action: "media.uploaded",
    resourceType: "ShipmentMedia",
    resourceId: media.id,
    after: {
      shipmentId: media.shipment.id,
      stage: media.stage,
      mimeType: detected!.mimeType,
      sizeBytes: info!.sizeBytes,
    },
    context,
  });

  logger.info({ mediaId: media.id, mimeType: detected!.mimeType }, "Tệp đã sẵn sàng");

  return { status: "READY" };
}

// -----------------------------------------------------------------------------
// Bước 8: đọc
// -----------------------------------------------------------------------------

/**
 * Danh sách media của một chuyến, lọc theo quyền của người xem.
 *
 * Khách hàng chỉ thấy tệp `READY` và `CUSTOMER`; nhân viên và tài xế thấy cả `INTERNAL`.
 * Lọc ngay trong truy vấn chứ không lọc sau khi lấy về (§30.2).
 */
export async function listShipmentMedia(actor: Actor, trackingCode: string) {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      userId: true,
      assignments: {
        select: {
          primaryDriverId: true,
          secondaryDriverId: true,
          isActive: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      },
    },
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, shipment);

  const seesInternal = can(actor, "shipment.read_all") || can(actor, "shipment.update");

  return db.shipmentMedia.findMany({
    where: {
      shipmentId: shipment.id,
      status: "READY",
      ...(seesInternal ? {} : { visibility: "CUSTOMER" }),
    },
    select: {
      id: true,
      stage: true,
      kind: true,
      mimeType: true,
      sizeBytes: true,
      caption: true,
      visibility: true,
      capturedAt: true,
      uploadedAt: true,
    },
    orderBy: [{ stage: "asc" }, { uploadedAt: "asc" }],
  });
}

/**
 * Nội dung một tệp, sau khi kiểm tra quyền.
 *
 * Trả nội dung qua proxy đã xác thực thay vì lộ URL storage: URL ký sẵn bị chia sẻ lại là
 * ai cũng xem được cho tới khi hết hạn, còn proxy thì kiểm tra quyền ở từng lần gọi (§16.3).
 */
export async function getMediaForDownload(actor: Actor, mediaId: string) {
  const media = await db.shipmentMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      objectKey: true,
      mimeType: true,
      kind: true,
      status: true,
      visibility: true,
      shipment: {
        select: {
          userId: true,
          assignments: {
            select: {
              primaryDriverId: true,
              secondaryDriverId: true,
              isActive: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          },
        },
      },
    },
  });

  if (!media) throw appError("NOT_FOUND");
  if (media.status !== "READY") throw appError("NOT_FOUND");

  requireShipmentAccess(actor, media.shipment);

  // Tệp nội bộ: khách hàng là chủ đơn cũng không được xem.
  const seesInternal = can(actor, "shipment.read_all") || can(actor, "shipment.update");
  if (media.visibility === "INTERNAL" && !seesInternal) {
    throw appError("NOT_FOUND");
  }

  const content = await storageProvider().read(media.objectKey);

  return { content, mimeType: media.mimeType, kind: media.kind, id: media.id };
}

// -----------------------------------------------------------------------------
// Sửa và xoá
// -----------------------------------------------------------------------------

export async function updateMedia(
  actor: Actor,
  input: UpdateMediaInput,
  context: Context
): Promise<void> {
  const media = await db.shipmentMedia.findUnique({
    where: { id: input.mediaId },
    select: {
      id: true,
      caption: true,
      visibility: true,
      shipment: {
        select: {
          status: true,
          assignments: {
            select: {
              primaryDriverId: true,
              secondaryDriverId: true,
              isActive: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          },
        },
      },
    },
  });

  if (!media) throw appError("NOT_FOUND");

  requireShipmentUpdateAccess(actor, media.shipment);

  await db.shipmentMedia.update({
    where: { id: media.id },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption || null } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
  });

  await recordAudit(actor, {
    action: "media.updated",
    resourceType: "ShipmentMedia",
    resourceId: media.id,
    before: { caption: media.caption, visibility: media.visibility },
    after: { caption: input.caption ?? media.caption, visibility: input.visibility ?? media.visibility },
    context,
  });
}

/**
 * Xoá tệp.
 *
 * Chỉ người tải lên hoặc nhân viên có quyền điều phối được xoá — tài xế khác trên cùng
 * chuyến không xoá được bằng chứng do người kia chụp.
 */
export async function deleteMedia(
  actor: Actor,
  mediaId: string,
  context: Context
): Promise<void> {
  const media = await db.shipmentMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      objectKey: true,
      stage: true,
      uploadedById: true,
      shipment: {
        select: {
          status: true,
          assignments: {
            select: {
              primaryDriverId: true,
              secondaryDriverId: true,
              isActive: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          },
        },
      },
    },
  });

  if (!media) throw appError("NOT_FOUND");

  requireShipmentUpdateAccess(actor, media.shipment);

  const isOwner = isAuthenticated(actor) && media.uploadedById === actor.userId;
  if (!isOwner && !can(actor, "shipment.dispatch")) {
    throw appError("FORBIDDEN", "Chỉ người đã tải lên hoặc điều phối mới xoá được tệp này.");
  }

  await db.shipmentMedia.delete({ where: { id: media.id } });
  await storageProvider().remove(media.objectKey);

  await recordAudit(actor, {
    action: "media.deleted",
    resourceType: "ShipmentMedia",
    resourceId: media.id,
    before: { stage: media.stage, objectKey: media.objectKey },
    context,
  });

  logger.info({ mediaId }, "Đã xoá tệp");
}
