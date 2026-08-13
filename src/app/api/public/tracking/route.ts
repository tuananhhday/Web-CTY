import { withErrorHandling, parseJsonBody, enforceRateLimit, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { trackingLookupSchema } from "@/modules/tracking/schema";
import { lookupPublic } from "@/modules/tracking/service";

/**
 * POST /api/public/tracking — tra cứu vận đơn không cần đăng nhập (§16.1, §25).
 *
 * Dùng POST chứ không phải GET dù chỉ là đọc: mã vận đơn và số điện thoại là dữ liệu cá
 * nhân, không được nằm trong query string vì URL bị ghi vào log truy cập, lịch sử trình
 * duyệt và header Referer (§31).
 *
 * Mọi thất bại trả về cùng một response 404 — sai mã, sai số xác minh, đơn chưa công bố
 * đều không phân biệt được từ bên ngoài (§16.1).
 */
export const POST = withErrorHandling(async (request, context) => {
  // Giới hạn theo IP: 10 lượt / 5 phút. Dò tuần tự bảng mã sẽ đụng trần rất nhanh.
  await enforceRateLimit("public-tracking", context.ipAddress, RATE_LIMITS.publicTracking);

  const input = await parseJsonBody(request, trackingLookupSchema);
  const view = await lookupPublic(input);

  if (!view) {
    throw appError(
      "NOT_FOUND",
      "Không tìm thấy vận đơn khớp với mã và số điện thoại đã nhập. Vui lòng kiểm tra lại."
    );
  }

  return jsonOk(view);
});

export const GET = withErrorHandling(async () => {
  throw appError(
    "NOT_FOUND",
    "Endpoint này chỉ nhận phương thức POST để không đưa dữ liệu cá nhân vào URL."
  );
});
