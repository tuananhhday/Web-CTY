/**
 * Chuẩn hoá dữ liệu trước khi lưu, phục vụ unique index (§24.9).
 *
 * Mỗi entity lưu song song hai cột: giá trị hiển thị theo đúng cách người dùng nhập,
 * và giá trị chuẩn hoá dùng cho unique index + tra cứu. Không ghi đè bản gốc.
 */

/** Email: lowercase và cắt khoảng trắng. Không đụng tới phần local (có thể phân biệt hoa thường theo RFC). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Số điện thoại Việt Nam về dạng E.164: +84xxxxxxxxx.
 * Chấp nhận đầu vào: 0912345678, 84912345678, +84 912 345 678, 0912.345.678
 *
 * @returns chuỗi E.164, hoặc null nếu không nhận dạng được số Việt Nam hợp lệ.
 */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[\s.()-]/g, "");

  let national: string;
  if (digits.startsWith("+84")) {
    national = digits.slice(3);
  } else if (digits.startsWith("84") && digits.length >= 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    return null;
  }

  // Sau khi bỏ mã quốc gia/số 0 đầu: di động 9 chữ số, cố định 9 chữ số.
  if (!/^\d{9}$/.test(national)) {
    return null;
  }

  return `+84${national}`;
}

/** Hiển thị số điện thoại dạng quen thuộc trong nước: 0912 345 678 */
export function formatPhoneForDisplay(e164: string): string {
  const national = e164.startsWith("+84") ? `0${e164.slice(3)}` : e164;
  return national.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}

/** Che số điện thoại khi hiển thị ở ngữ cảnh không cần đầy đủ (§31): 0912 *** 678 */
export function maskPhone(e164: string): string {
  const national = e164.startsWith("+84") ? `0${e164.slice(3)}` : e164;
  if (national.length < 7) return "***";
  return `${national.slice(0, 4)} *** ${national.slice(-3)}`;
}

/**
 * Biển số xe: bỏ khoảng trắng, dấu chấm, gạch ngang và viết hoa.
 * "51C-123.45" và "51c 12345" cùng cho ra "51C12345", tránh trùng lặp bản ghi xe.
 */
export function normalizePlateNumber(plate: string): string {
  return plate.replace(/[\s.\-_]/g, "").toUpperCase();
}

const VIETNAMESE_MAP: Record<string, string> = {
  à: "a", á: "a", ạ: "a", ả: "a", ã: "a",
  â: "a", ầ: "a", ấ: "a", ậ: "a", ẩ: "a", ẫ: "a",
  ă: "a", ằ: "a", ắ: "a", ặ: "a", ẳ: "a", ẵ: "a",
  è: "e", é: "e", ẹ: "e", ẻ: "e", ẽ: "e",
  ê: "e", ề: "e", ế: "e", ệ: "e", ể: "e", ễ: "e",
  ì: "i", í: "i", ị: "i", ỉ: "i", ĩ: "i",
  ò: "o", ó: "o", ọ: "o", ỏ: "o", õ: "o",
  ô: "o", ồ: "o", ố: "o", ộ: "o", ổ: "o", ỗ: "o",
  ơ: "o", ờ: "o", ớ: "o", ợ: "o", ở: "o", ỡ: "o",
  ù: "u", ú: "u", ụ: "u", ủ: "u", ũ: "u",
  ư: "u", ừ: "u", ứ: "u", ự: "u", ử: "u", ữ: "u",
  ỳ: "y", ý: "y", ỵ: "y", ỷ: "y", ỹ: "y",
  đ: "d",
};

/** Bỏ dấu tiếng Việt, phục vụ sinh slug và tìm kiếm không dấu. */
export function removeVietnameseTones(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => VIETNAMESE_MAP[char] ?? char)
    .join("");
}

/** Slug tiếng Việt không dấu (§7). */
export function slugify(input: string): string {
  return removeVietnameseTones(input)
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
