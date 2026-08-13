import { withErrorHandling, parseJsonBody, enforceRateLimit, jsonOk } from "@/lib/api";
import { appError } from "@/lib/errors";
import { RATE_LIMITS, isHoneypotTriggered } from "@/lib/rate-limit";
import { getActor } from "@/modules/auth/session";
import { contactInquirySchema } from "@/modules/support/schema";
import { createContactInquiry } from "@/modules/support/service";

/**
 * POST /api/public/contact — tiếp nhận form liên hệ (§23, §25).
 *
 * Không cần đăng nhập. Ba lớp chống spam: rate limit theo IP, bẫy bot, và độ dài nội dung
 * tối thiểu ở schema.
 */
export const POST = withErrorHandling(async (request, context) => {
  await enforceRateLimit("submit-contact", context.ipAddress, RATE_LIMITS.submitContact);

  const input = await parseJsonBody(request, contactInquirySchema);

  // Bot điền vào trường ẩn. Trả về như thành công để không tiết lộ cơ chế phát hiện,
  // nhưng không tạo bản ghi nào.
  if (isHoneypotTriggered(input.website)) {
    context.logger.warn({ ip: context.ipAddress }, "Chặn liên hệ do honeypot");
    return jsonOk({ ok: true }, { status: 201 });
  }

  const actor = await getActor();

  await createContactInquiry(actor, input, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
  });

  return jsonOk({ ok: true }, { status: 201 });
});

export const GET = withErrorHandling(async () => {
  throw appError("NOT_FOUND", "Endpoint này chỉ nhận phương thức POST.");
});
