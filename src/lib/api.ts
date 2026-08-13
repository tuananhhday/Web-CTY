import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { appError, toErrorResponse, type FieldIssue } from "@/lib/errors";
import { generateRequestId } from "@/lib/ids";
import { requestLogger } from "@/lib/logger";
import { rateLimit, getClientIp, type RateLimitRule } from "@/lib/rate-limit";

/**
 * Tiện ích cho route handler (§25).
 *
 * Chuẩn hoá ba thứ ở mọi endpoint:
 *   - Mỗi request có `requestId` riêng, xuất hiện cả trong log lẫn response lỗi để đối chiếu.
 *   - Lỗi trả về theo một khuôn dạng duy nhất, không bao giờ lộ stack trace (§25, §30).
 *   - Thân request luôn được validate bằng Zod trước khi chạm tới nghiệp vụ.
 */

export interface RequestContext {
  requestId: string;
  ipAddress: string;
  userAgent: string | null;
  logger: ReturnType<typeof requestLogger>;
}

export function createRequestContext(request: Request): RequestContext {
  const requestId = generateRequestId();
  return {
    requestId,
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    logger: requestLogger(requestId),
  };
}

/** Chuyển lỗi Zod thành danh sách lỗi theo từng trường để giao diện highlight đúng ô. */
function toFieldIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Đọc và validate JSON body.
 * @throws VALIDATION_ERROR khi body không phải JSON hợp lệ hoặc không khớp schema.
 */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw appError("VALIDATION_ERROR", "Nội dung gửi lên không phải JSON hợp lệ.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw appError("VALIDATION_ERROR", "Dữ liệu gửi lên chưa hợp lệ.", {
      fields: toFieldIssues(result.error),
    });
  }

  return result.data;
}

/** Validate query string theo allowlist (§25). */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);

  if (!result.success) {
    throw appError("VALIDATION_ERROR", "Tham số truy vấn không hợp lệ.", {
      fields: toFieldIssues(result.error),
    });
  }

  return result.data;
}

/**
 * Áp giới hạn tần suất.
 * @throws RATE_LIMITED kèm số giây cần chờ.
 */
export async function enforceRateLimit(
  action: string,
  identifier: string,
  rule: RateLimitRule
): Promise<void> {
  const result = await rateLimit(`${action}:${identifier}`, rule);

  if (!result.allowed) {
    throw appError(
      "RATE_LIMITED",
      `Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(result.retryAfterSeconds / 60)} phút.`
    );
  }
}

export function jsonOk<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: init?.headers });
}

/**
 * Bọc handler để mọi lỗi đều thành response an toàn.
 *
 * Lỗi không phải AppError bị quy về INTERNAL_ERROR và ghi log đầy đủ ở server —
 * client chỉ nhận thông báo chung kèm requestId để báo cho bộ phận hỗ trợ (§25, §32.2).
 */
export function withErrorHandling(
  handler: (request: Request, context: RequestContext) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const context = createRequestContext(request);

    try {
      return await handler(request, context);
    } catch (error) {
      const { status, body } = toErrorResponse(error, context.requestId);

      if (status >= 500) {
        context.logger.error({ err: error, url: request.url }, "Lỗi không xử lý được");
      } else {
        context.logger.warn(
          { code: body.error.code, url: request.url },
          "Request bị từ chối"
        );
      }

      return NextResponse.json(body, { status });
    }
  };
}
