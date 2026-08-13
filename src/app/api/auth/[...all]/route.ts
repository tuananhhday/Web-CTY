import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Điểm cuối xác thực (§25: /api/auth/*).
 * Better Auth tự xử lý đăng ký, đăng nhập, đăng xuất, xác minh email, đặt lại mật khẩu.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
