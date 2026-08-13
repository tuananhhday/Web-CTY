import "server-only";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * SmsProvider (§4, §21).
 *
 * Adapter `console` in nội dung ra terminal để chạy được luồng OTP ở development khi chưa
 * có nhà mạng. KHÔNG dùng ở production: tin nhắn không đến tay người nhận, mà OTP không
 * tới nơi nghĩa là tài xế không đóng được chuyến.
 */

export interface SmsMessage {
  to: string;
  text: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly isProductionReady: boolean;
  send(message: SmsMessage): Promise<void>;
}

const consoleProvider: SmsProvider = {
  name: "console",
  isProductionReady: false,

  async send(message) {
    // Log có redact số điện thoại; nội dung đầy đủ chỉ in ra stdout của máy dev.
    logger.info({ to: message.to }, "SMS (adapter console — không thực sự gửi đi)");

    console.log(
      [
        "",
        "──────────────────────────────────────────────",
        `  SMS → ${message.to}`,
        `  ${message.text}`,
        "──────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  },
};

let cached: SmsProvider | null = null;

export function smsProvider(): SmsProvider {
  if (cached) return cached;

  if (serverEnv().SMS_PROVIDER === "http") {
    throw new Error(
      "SMS_PROVIDER=http nhưng adapter chưa được triển khai. " +
        "Đặt SMS_PROVIDER=console cho development."
    );
  }

  cached = consoleProvider;
  return cached;
}
