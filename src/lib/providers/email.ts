import "server-only";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * EmailProvider (§4).
 *
 * Adapter `console` in nội dung ra terminal, dùng cho development khi chưa có SMTP.
 * KHÔNG dùng adapter này ở production — email sẽ không đến tay người nhận.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  readonly name: string;
  readonly isProductionReady: boolean;
  send(message: EmailMessage): Promise<void>;
}

const consoleProvider: EmailProvider = {
  name: "console",
  isProductionReady: false,
  async send(message) {
    // Ghi nội dung để lập trình viên lấy được link xác minh khi test ở local.
    logger.info(
      { to: message.to, subject: message.subject },
      "Email (adapter console — không thực sự gửi đi)"
    );
    console.log(
      [
        "",
        "──────────────────────────────────────────────",
        `  EMAIL → ${message.to}`,
        `  Tiêu đề: ${message.subject}`,
        "──────────────────────────────────────────────",
        message.text,
        "──────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  },
};

const smtpProvider: EmailProvider = {
  name: "smtp",
  isProductionReady: true,
  async send() {
    // Chưa triển khai: cần nodemailer và thông tin SMTP thật.
    // Ném lỗi rõ ràng thay vì im lặng nuốt email (§32.2: không nuốt lỗi).
    throw new Error(
      "EMAIL_PROVIDER=smtp nhưng adapter SMTP chưa được triển khai. " +
        "Đặt EMAIL_PROVIDER=console cho development, hoặc triển khai adapter trước khi lên production."
    );
  },
};

let cached: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  cached = serverEnv().EMAIL_PROVIDER === "smtp" ? smtpProvider : consoleProvider;
  return cached;
}
