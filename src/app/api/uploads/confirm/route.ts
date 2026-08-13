import { withErrorHandling, parseJsonBody, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { getActor } from "@/modules/auth/session";
import { confirmUploadSchema } from "@/modules/media/schema";
import { confirmUpload } from "@/modules/media/service";

/**
 * POST /api/uploads/confirm — bước 5 của luồng upload (§16.3).
 *
 * Server kiểm tra tệp có thật, đúng kích thước, đúng định dạng theo magic bytes, khớp
 * checksum và sạch mã độc. Chỉ khi qua hết mới chuyển sang READY.
 */
export const POST = withErrorHandling(async (request, context) => {
  const actor = await getActor();
  const input = await parseJsonBody(request, confirmUploadSchema);

  const result = await confirmUpload(actor, input, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
  });

  return jsonOk(result);
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
