import { customAlphabet } from "nanoid";

/**
 * Sinh mã công khai (§24.9).
 *
 * Yêu cầu: mã tracking/public phải ngẫu nhiên, không tuần tự, không để đoán được
 * số lượng bản ghi trong hệ thống. Vì vậy không dùng ID tăng dần hay timestamp.
 *
 * Bảng chữ cái đã loại bỏ ký tự dễ nhầm khi đọc/gõ lại qua điện thoại:
 * 0/O, 1/I/L, U/V. Người dùng thường phải đọc mã vận đơn qua hotline.
 */
const UNAMBIGUOUS_ALPHABET = "23456789ACDEFGHJKMNPQRSTWXYZ";

const nanoid10 = customAlphabet(UNAMBIGUOUS_ALPHABET, 10);
const nanoid8 = customAlphabet(UNAMBIGUOUS_ALPHABET, 8);
const nanoid6 = customAlphabet(UNAMBIGUOUS_ALPHABET, 6);

/**
 * Mã vận đơn cho khách tra cứu. 10 ký tự × 28 giá trị ≈ 2.9e14 tổ hợp,
 * đủ chống dò tuần tự khi kết hợp rate limit (§16.1).
 */
export function generateTrackingCode(): string {
  return `VT${nanoid10()}`;
}

/** Mã yêu cầu dịch vụ hiển thị cho khách. */
export function generateRequestCode(): string {
  return `YC${nanoid8()}`;
}

/** Mã báo giá công khai — không tuần tự theo yêu cầu §13.3. */
export function generateQuoteCode(): string {
  return `BG${nanoid8()}`;
}

/** Mã ticket hỗ trợ. */
export function generateTicketCode(): string {
  return `HT${nanoid8()}`;
}

/** Mã sự cố. */
export function generateIncidentCode(): string {
  return `SC${nanoid8()}`;
}

/**
 * Số hoá đơn nội bộ. KHÔNG phải hoá đơn điện tử hợp pháp (§20) — chỉ là mã chứng từ
 * của hệ thống. Khi tích hợp nhà cung cấp hoá đơn điện tử phải dùng số do họ cấp.
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `HD${year}-${String(sequence).padStart(5, "0")}`;
}

/** Mã OTP số dùng cho bằng chứng giao hàng. Luôn lưu dạng hash (§18). */
export function generateNumericOtp(length = 6): string {
  const digits = "0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

/** Token ngẫu nhiên độ dài cao cho secure lookup / verification. Lưu dạng hash. */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Khoá đối tượng trong object storage — server sinh, không dùng tên file người dùng (§16.3). */
export function generateObjectKey(prefix: string, extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${prefix}/${yyyy}/${mm}/${nanoid10()}${nanoid6()}.${safeExtension}`;
}

/** requestId để lần vết log xuyên suốt một request (§25, §32.3). */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
