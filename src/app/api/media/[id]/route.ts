import { createRequestContext } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";
import { getActor } from "@/modules/auth/session";
import { contentDispositionFor } from "@/modules/media/file-types";
import { getMediaForDownload } from "@/modules/media/service";

/**
 * GET /api/media/[id] — proxy đã xác thực để xem tệp (§16.3 bước 8).
 *
 * Dùng proxy thay vì trả URL storage ký sẵn: URL ký sẵn bị chia sẻ lại là ai cũng xem được
 * cho tới khi hết hạn, còn proxy kiểm tra quyền ở TỪNG lần gọi. Chuyến hàng có ảnh hàng hóa
 * và địa chỉ nhà khách nên đây là đánh đổi đáng giá, chấp nhận tốn băng thông máy chủ.
 *
 * Không dùng `withErrorHandling` vì handler này trả về nội dung nhị phân chứ không phải JSON.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const context = createRequestContext(request);

  try {
    const { id } = await params;
    const actor = await getActor();
    const media = await getMediaForDownload(actor, id);

    return new Response(new Uint8Array(media.content), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(media.content.byteLength),
        "Content-Disposition": contentDispositionFor(media.mimeType, media.id),
        // Chặn trình duyệt tự đoán lại kiểu nội dung: đoán sai là chạy nhầm HTML (§30.4).
        "X-Content-Type-Options": "nosniff",
        // Nội dung riêng tư, tuyệt đối không để CDN hay proxy trung gian giữ lại (§32.1).
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error, context.requestId);

    if (status >= 500) {
      context.logger.error({ err: error }, "Lỗi khi trả tệp media");
    }

    return Response.json(body, { status });
  }
}
