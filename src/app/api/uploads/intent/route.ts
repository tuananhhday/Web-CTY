import { withErrorHandling, parseJsonBody, enforceRateLimit, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getActor } from "@/modules/auth/session";
import { requireAuth } from "@/modules/auth/policy";
import { uploadIntentSchema } from "@/modules/media/schema";
import { createUploadIntent } from "@/modules/media/service";

/**
 * POST /api/uploads/intent — bước 1 của luồng upload (§16.3, §25).
 *
 * Trả về mã tệp và đích tải lên ngắn hạn. Quyền, số lượng, MIME và dung lượng đều kiểm tra
 * ở service trước khi cấp.
 */
export const POST = withErrorHandling(async (request, context) => {
  const actor = await getActor();
  const user = requireAuth(actor);

  // Giới hạn theo NGƯỜI DÙNG chứ không theo IP: tài xế ngoài đường dùng chung IP nhà mạng,
  // giới hạn theo IP sẽ chặn nhầm cả đội xe.
  await enforceRateLimit("upload-intent", user.userId, RATE_LIMITS.uploadIntent);

  const input = await parseJsonBody(request, uploadIntentSchema);

  const result = await createUploadIntent(actor, input);

  context.logger.info({ mediaId: result.mediaId }, "Cấp upload intent");

  return jsonOk(result, { status: 201 });
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
