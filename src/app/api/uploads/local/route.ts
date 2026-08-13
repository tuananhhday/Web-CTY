import { withErrorHandling, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";
import { verifyLocalUploadSignature, writeLocalObject } from "@/lib/providers/storage";
import { MAX_SIZE_BYTES } from "@/modules/media/file-types";

/**
 * PUT /api/uploads/local — điểm nhận file của adapter storage `local` (§16.3 bước 4).
 *
 * Đây là phần THAY THẾ cho presigned URL của S3/R2 khi chạy development. Nó chỉ tin chữ ký
 * HMAC do chính server phát ra ở bước intent: không có chữ ký hợp lệ và còn hạn thì không
 * ghi được gì, kể cả khi người gọi đã đăng nhập.
 *
 * Route này KHÔNG tồn tại khi dùng storage thật — client sẽ PUT thẳng lên bucket.
 */

/** Trần tuyệt đối cho một request, độc lập với khai báo ở bước intent. */
const HARD_LIMIT_BYTES = Math.max(...Object.values(MAX_SIZE_BYTES));

export const PUT = withErrorHandling(async (request, context) => {
  if (serverEnv().STORAGE_PROVIDER !== "local") {
    throw appError("NOT_FOUND");
  }

  const url = new URL(request.url);
  const objectKey = url.searchParams.get("key");
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature");

  if (!objectKey || !signature || !Number.isFinite(expires)) {
    throw appError("VALIDATION_ERROR", "Thiếu tham số ký cho phiên tải lên.");
  }

  if (!verifyLocalUploadSignature(objectKey, expires, signature)) {
    // Không phân biệt chữ ký sai với chữ ký hết hạn.
    throw appError("FORBIDDEN", "Phiên tải lên không hợp lệ hoặc đã hết hạn.");
  }

  const body = await request.arrayBuffer();

  if (body.byteLength === 0) {
    throw appError("VALIDATION_ERROR", "Nội dung tải lên rỗng.");
  }

  if (body.byteLength > HARD_LIMIT_BYTES) {
    throw appError("PAYLOAD_TOO_LARGE", "Tệp vượt quá dung lượng cho phép.");
  }

  await writeLocalObject(objectKey, new Uint8Array(body));

  context.logger.info({ objectKey, sizeBytes: body.byteLength }, "Đã nhận tệp (storage local)");

  return jsonOk({ ok: true });
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND");
});
