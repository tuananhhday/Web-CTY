import "server-only";
import pino from "pino";
import { serverEnv, isProduction } from "@/lib/env";

/**
 * Structured logger (§32.3).
 *
 * Bắt buộc: mọi log đều redact secret/PII. Danh sách `redact` bên dưới là lớp bảo vệ
 * cuối cùng — vẫn phải tránh chủ động đưa dữ liệu nhạy cảm vào log ngay từ đầu (§30.3).
 */

const REDACT_PATHS = [
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "confirmPassword",
  "*.confirmPassword",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "sessionToken",
  "*.sessionToken",
  "otp",
  "*.otp",
  "otpHash",
  "*.otpHash",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "signedUrl",
  "*.signedUrl",
  "presignedUrl",
  "*.presignedUrl",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
];

export const logger = pino({
  level: serverEnv().LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[ĐÃ ẨN]" },
  base: { env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Production ghi JSON một dòng để hệ thống thu thập log parse được.
  // Development dùng pino-pretty cho dễ đọc.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});

/** Logger gắn sẵn requestId để lần vết một request xuyên suốt các tầng (§25). */
export function requestLogger(requestId: string) {
  return logger.child({ requestId });
}

export type Logger = typeof logger;
