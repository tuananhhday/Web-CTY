/**
 * Lọc dữ liệu nhạy cảm trước khi ghi AuditLog (§30.3).
 *
 * Module thuần: không import database, logger hay cấu hình môi trường. Nhờ vậy kiểm thử
 * được độc lập và dùng lại được ở bất kỳ tầng nào.
 *
 * Danh sách dưới đây là lớp chặn CUỐI CÙNG. Vẫn phải tránh chủ động truyền dữ liệu nhạy
 * cảm vào audit ngay từ đầu.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "confirmpassword",
  "newpassword",
  "currentpassword",
  "token",
  "tokenhash",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "otp",
  "otphash",
  "secret",
  "secretenc",
  "apikey",
  "authorization",
  "cookie",
  "signedurl",
  "presignedurl",
  "signaturekey",
  "licensenumber",
  "documentnumber",
]);

export const REDACTED = "[ĐÃ ẨN]";

const MAX_DEPTH = 6;

export function redactSensitive(input: unknown, depth = 0): JsonValue {
  if (depth > MAX_DEPTH) return "[QUÁ SÂU]";
  if (input === null || input === undefined) return null;

  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return input;
  }

  if (input instanceof Date) return input.toISOString();

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item, depth + 1));
  }

  if (typeof input === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED
        : redactSensitive(value, depth + 1);
    }
    return result;
  }

  // Hàm, symbol, bigint... không đưa vào log.
  return null;
}
