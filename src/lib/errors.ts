/**
 * Lỗi ứng dụng có mã ổn định.
 *
 * `code` là hợp đồng với client — không đổi khi refactor.
 * `message` là văn bản tiếng Việt an toàn để hiển thị cho người dùng cuối:
 * không chứa tên bảng, câu SQL, đường dẫn file hay stack trace (§25, §30).
 */

export type ErrorCode =
  // 400
  | "VALIDATION_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "IDEMPOTENCY_CONFLICT"
  // 401 / 403
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "MFA_REQUIRED"
  | "REAUTH_REQUIRED"
  // 404
  | "NOT_FOUND"
  // 409
  | "CONFLICT"
  | "RESOURCE_LOCKED"
  | "DOUBLE_BOOKING"
  | "STALE_VERSION"
  // 413 / 415
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  // 429
  | "RATE_LIMITED"
  // 500 / 503
  | "INTERNAL_ERROR"
  | "PROVIDER_UNAVAILABLE";

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_STATE_TRANSITION: 400,
  IDEMPOTENCY_CONFLICT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  MFA_REQUIRED: 403,
  REAUTH_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RESOURCE_LOCKED: 409,
  DOUBLE_BOOKING: 409,
  STALE_VERSION: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROVIDER_UNAVAILABLE: 503,
};

export interface FieldIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldIssue[];
  /** Chi tiết kỹ thuật chỉ dùng để ghi log — KHÔNG bao giờ gửi ra response. */
  readonly internal?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fields?: FieldIssue[]; internal?: unknown; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.fields = options?.fields;
    this.internal = options?.internal;
  }
}

/** Thông báo mặc định an toàn cho từng mã lỗi. */
const defaultMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Dữ liệu gửi lên không hợp lệ.",
  INVALID_STATE_TRANSITION: "Không thể chuyển sang trạng thái này.",
  IDEMPOTENCY_CONFLICT: "Yêu cầu này đã được xử lý với dữ liệu khác.",
  UNAUTHENTICATED: "Bạn cần đăng nhập để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  MFA_REQUIRED: "Thao tác này yêu cầu xác thực hai lớp.",
  REAUTH_REQUIRED: "Vui lòng xác thực lại để tiếp tục.",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  CONFLICT: "Dữ liệu đã tồn tại hoặc đang xung đột.",
  RESOURCE_LOCKED: "Dữ liệu đang được xử lý, vui lòng thử lại sau.",
  DOUBLE_BOOKING: "Xe hoặc tài xế đã có lịch trùng trong khoảng thời gian này.",
  STALE_VERSION: "Dữ liệu đã được người khác cập nhật. Vui lòng tải lại.",
  PAYLOAD_TOO_LARGE: "Dung lượng vượt quá giới hạn cho phép.",
  UNSUPPORTED_MEDIA_TYPE: "Định dạng tệp không được hỗ trợ.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  INTERNAL_ERROR: "Hệ thống gặp sự cố. Vui lòng thử lại sau.",
  PROVIDER_UNAVAILABLE: "Dịch vụ liên quan tạm thời không khả dụng.",
};

export function appError(
  code: ErrorCode,
  message?: string,
  options?: { fields?: FieldIssue[]; internal?: unknown; cause?: unknown }
): AppError {
  return new AppError(code, message ?? defaultMessages[code], options);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldIssue[];
    requestId: string;
  };
}

/**
 * Chuyển lỗi bất kỳ thành response body an toàn.
 * Lỗi không phải AppError luôn bị quy về INTERNAL_ERROR để không rò chi tiết nội bộ.
 */
export function toErrorResponse(error: unknown, requestId: string): {
  status: number;
  body: ErrorResponseBody;
} {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: defaultMessages.INTERNAL_ERROR,
        requestId,
      },
    },
  };
}
