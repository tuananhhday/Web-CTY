"use client";

import { createAuthClient } from "better-auth/react";
import { clientEnv } from "@/lib/env";

/**
 * Client xác thực dùng ở Client Component.
 *
 * Client này KHÔNG giữ token: phiên nằm trong cookie HttpOnly do server đặt, JavaScript
 * không đọc được. Không lưu bất cứ thứ gì liên quan đến phiên vào localStorage (§14, §30.1).
 */
export const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_SITE_URL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
