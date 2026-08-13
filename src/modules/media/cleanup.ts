import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { storageProvider } from "@/lib/providers/storage";

/**
 * Dọn tệp tải lên bỏ dở (§16.3).
 *
 * Luồng upload tạo bản ghi `ShipmentMedia` ở trạng thái `QUARANTINED` NGAY từ bước xin phép,
 * trước khi client tải nội dung lên. Có chủ đích: file đã nằm trong storage mà client không
 * gọi `confirmUpload` — mất sóng giữa đường, đóng app, hết pin — vẫn còn bản ghi để lần ra,
 * thay vì thành file mồ côi nằm mãi.
 *
 * Nhưng "còn dấu vết" chỉ có ích nếu có ai đó thực sự đi dọn. Đó là việc của module này.
 */

/**
 * Thời gian chờ trước khi coi một intent là bỏ dở.
 *
 * URL upload chỉ sống vài phút, nên về lý thuyết chờ 15 phút là đủ. Chọn 24 giờ để có biên
 * an toàn rộng: tài xế ở vùng sóng yếu có thể tải một video 100 MB rất lâu, và xoá nhầm một
 * tệp bằng chứng giao hàng đang tải dở thì không lấy lại được. Rác nằm thêm một ngày rẻ hơn
 * nhiều so với mất bằng chứng.
 */
export const ABANDONED_UPLOAD_AGE_HOURS = 24;

/**
 * Thời gian giữ bản ghi đã bị từ chối.
 *
 * `REJECTED` là dấu vết điều tra: tệp sai định dạng, sai checksum, hoặc quét ra mã độc.
 * Nội dung đã bị xoá khỏi storage ngay lúc từ chối, chỉ còn metadata. Giữ 90 ngày để soát
 * lại khi cần rồi mới dọn.
 *
 * Mốc tính tuổi là `uploadedAt` chứ không phải thời điểm từ chối — bảng không có cột
 * `updatedAt`. Sai lệch không đáng kể vì việc từ chối xảy ra ngay trong lần gọi
 * `confirmUpload`, tức chỉ vài giây sau khi tạo bản ghi.
 */
export const REJECTED_RETENTION_DAYS = 90;

export interface MediaCleanupResult {
  /** Số intent bỏ dở đã dọn. */
  abandoned: number;
  /** Số object thực sự xoá được khỏi storage. */
  objectsRemoved: number;
  /** Số bản ghi REJECTED quá hạn đã xoá. */
  rejectedPurged: number;
  /** Số object storage xoá không thành công — cần người xem lại. */
  storageFailures: number;
}

/**
 * Số bản ghi xử lý mỗi lượt.
 *
 * Có giới hạn để một lượt chạy luôn kết thúc trong thời gian dự đoán được, kể cả lần đầu
 * chạy trên hệ thống đã tích tụ rác lâu ngày. Còn dư thì lượt sau dọn tiếp.
 */
const BATCH_SIZE = 200;

export async function cleanupAbandonedMedia(
  now: Date = new Date()
): Promise<MediaCleanupResult> {
  const result: MediaCleanupResult = {
    abandoned: 0,
    objectsRemoved: 0,
    rejectedPurged: 0,
    storageFailures: 0,
  };

  const abandonedCutoff = new Date(
    now.getTime() - ABANDONED_UPLOAD_AGE_HOURS * 60 * 60 * 1000
  );

  const stale = await db.shipmentMedia.findMany({
    where: { status: "QUARANTINED", uploadedAt: { lt: abandonedCutoff } },
    select: { id: true, objectKey: true },
    take: BATCH_SIZE,
  });

  const storage = storageProvider();

  for (const media of stale) {
    /*
     * Xoá khỏi storage TRƯỚC, database SAU.
     *
     * Thứ tự này quan trọng. Nếu xoá bản ghi trước rồi storage lỗi, file thành mồ côi vĩnh
     * viễn — không còn gì trỏ tới nó nữa. Làm ngược lại thì trường hợp xấu nhất là bản ghi
     * còn nằm đó và lượt sau thử lại; `remove` chạy nhiều lần không sao.
     */
    try {
      await storage.remove(media.objectKey);
      result.objectsRemoved += 1;
    } catch (error) {
      result.storageFailures += 1;
      logger.warn(
        { mediaId: media.id, err: error },
        "Không xoá được object của intent bỏ dở, giữ bản ghi để thử lại lượt sau"
      );
      continue;
    }

    await db.shipmentMedia.delete({ where: { id: media.id } });
    result.abandoned += 1;
  }

  const rejectedCutoff = new Date(
    now.getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  /*
   * Bản ghi REJECTED không cần đụng tới storage: nội dung đã bị xoá ngay tại thời điểm từ
   * chối trong `media/service.ts`. Ở đây chỉ còn metadata nên xoá hàng loạt được.
   */
  const purged = await db.shipmentMedia.deleteMany({
    where: { status: "REJECTED", uploadedAt: { lt: rejectedCutoff } },
  });
  result.rejectedPurged = purged.count;

  if (result.abandoned > 0 || result.rejectedPurged > 0 || result.storageFailures > 0) {
    logger.info(result, "Đã dọn media");
  }

  return result;
}
