import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { serverEnv, isProduction } from "@/lib/env";
import { getEmailProvider } from "@/lib/providers/email";
import { normalizeEmail } from "@/lib/normalize";

/**
 * Cấu hình Better Auth (§9).
 *
 * Các yêu cầu bảo mật được đáp ứng ở đây:
 *   - Cookie session HttpOnly, Secure ở production, SameSite=lax.
 *   - Mật khẩu hash bằng cấu hình mặc định của thư viện (scrypt), lưu ở Account.password.
 *   - Token xác minh/đặt lại mật khẩu do thư viện sinh, có hạn, dùng một lần.
 *   - Không tiết lộ email có tồn tại hay không khi yêu cầu đặt lại mật khẩu.
 *   - Rate limit chống dò mật khẩu.
 */

const env = serverEnv();

export const auth = betterAuth({
  appName: "Nền tảng vận tải",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // Buộc xác minh email trước khi đăng nhập được (§9).
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,

    sendResetPassword: async ({ user, url }) => {
      await getEmailProvider().send({
        to: user.email,
        subject: "Đặt lại mật khẩu",
        text: [
          `Xin chào ${user.name},`,
          "",
          "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.",
          "Mở liên kết dưới đây để đặt mật khẩu mới. Liên kết chỉ dùng được một lần và sẽ hết hạn sau 1 giờ.",
          "",
          url,
          "",
          "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.",
        ].join("\n"),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await getEmailProvider().send({
        to: user.email,
        subject: "Xác minh địa chỉ email",
        text: [
          `Xin chào ${user.name},`,
          "",
          "Mở liên kết dưới đây để xác minh địa chỉ email và kích hoạt tài khoản:",
          "",
          url,
          "",
          "Nếu bạn không tạo tài khoản này, hãy bỏ qua email.",
        ].join("\n"),
      });
    },
  },

  user: {
    // Chuẩn hoá email về chữ thường trước khi lưu — cột users.email đóng vai trò
    // unique index trên email normalized (§24.9).
    fields: {},
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      phoneNormalized: { type: "string", required: false, input: false },
      status: { type: "string", required: false, input: false, defaultValue: "PENDING_VERIFICATION" },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    // Gia hạn phiên khi người dùng còn hoạt động, tránh bị đăng xuất giữa chừng.
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  advanced: {
    // Cookie mang token phiên: chặn JavaScript đọc, chỉ gửi qua HTTPS ở production,
    // SameSite=lax để chống CSRF mà vẫn cho phép điều hướng từ link email.
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    },
    useSecureCookies: isProduction,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      // Đăng nhập và quên mật khẩu bị giới hạn chặt hơn để chống dò (§9, §30.1).
      "/sign-in/email": { window: 300, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
    },
  },

  // nextCookies phải đứng cuối danh sách plugin để set cookie đúng trong server action.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

/** Chuẩn hoá email trước khi đưa vào Better Auth, để unique index hoạt động đúng. */
export function prepareEmail(email: string): string {
  return normalizeEmail(email);
}
