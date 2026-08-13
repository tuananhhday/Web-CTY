/**
 * Nhận dạng loại file bằng magic bytes (§16.3, §30.4).
 *
 * Module thuần, không chạm database hay mạng.
 *
 * NGUYÊN TẮC: không bao giờ tin `Content-Type` hay đuôi file do client gửi. Cả hai đều do
 * kẻ tấn công đặt tùy ý. Chỉ vài byte đầu của nội dung thật mới đáng tin.
 *
 * Danh sách là ALLOWLIST. Định dạng không nằm trong đây bị từ chối, kể cả khi vô hại —
 * thà từ chối nhầm một file lạ còn hơn nhận nhầm một file thực thi được.
 */

export type MediaKind = "IMAGE" | "VIDEO" | "DOCUMENT";

export interface FileTypeSignature {
  mimeType: string;
  kind: MediaKind;
  extension: string;
  /** Byte mở đầu. `null` nghĩa là byte đó bỏ qua khi so khớp. */
  magic: (number | null)[];
  /** Vị trí bắt đầu của chuỗi magic. Định dạng ISO-BMFF đặt chữ ký ở offset 4. */
  offset?: number;
  /** Kiểm tra bổ sung khi magic chung cho nhiều định dạng (WebP, MP4). */
  verify?: (bytes: Uint8Array) => boolean;
}

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

function bytesAt(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.slice(offset, offset + length));
}

/**
 * Định dạng được phép tải lên.
 *
 * KHÔNG có SVG: SVG là XML, chứa được `<script>` và sự kiện inline, nên một ảnh SVG mở
 * trong trình duyệt là một trang HTML thực thi được (§16.3).
 * KHÔNG có HTML, JS, PDF có JavaScript, hay bất kỳ định dạng lưu trữ nào.
 */
export const ALLOWED_FILE_TYPES: FileTypeSignature[] = [
  {
    mimeType: "image/jpeg",
    kind: "IMAGE",
    extension: "jpg",
    magic: [0xff, 0xd8, 0xff],
  },
  {
    mimeType: "image/png",
    kind: "IMAGE",
    extension: "png",
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    mimeType: "image/webp",
    kind: "IMAGE",
    extension: "webp",
    // "RIFF" ở offset 0, "WEBP" ở offset 8; 4 byte giữa là độ dài file.
    magic: ascii("RIFF"),
    verify: (bytes) => bytesAt(bytes, 8, 4) === "WEBP",
  },
  {
    mimeType: "image/heic",
    kind: "IMAGE",
    extension: "heic",
    // iPhone chụp mặc định ra HEIC — từ chối thì tài xế không tải ảnh lên được.
    magic: ascii("ftyp"),
    offset: 4,
    verify: (bytes) => ["heic", "heix", "hevc", "mif1"].includes(bytesAt(bytes, 8, 4)),
  },
  {
    mimeType: "video/mp4",
    kind: "VIDEO",
    extension: "mp4",
    magic: ascii("ftyp"),
    offset: 4,
    verify: (bytes) => ["isom", "iso2", "mp41", "mp42", "avc1"].includes(bytesAt(bytes, 8, 4)),
  },
  {
    mimeType: "video/quicktime",
    kind: "VIDEO",
    extension: "mov",
    magic: ascii("ftyp"),
    offset: 4,
    verify: (bytes) => bytesAt(bytes, 8, 4) === "qt  ",
  },
  {
    mimeType: "application/pdf",
    kind: "DOCUMENT",
    extension: "pdf",
    magic: ascii("%PDF-"),
  },
];

/** Số byte cần đọc để nhận dạng được mọi định dạng trong allowlist. */
export const MAGIC_BYTES_LENGTH = 16;

function matchesSignature(bytes: Uint8Array, signature: FileTypeSignature): boolean {
  const offset = signature.offset ?? 0;

  if (bytes.length < offset + signature.magic.length) return false;

  for (let i = 0; i < signature.magic.length; i += 1) {
    const expected = signature.magic[i];
    if (expected === null) continue;
    if (bytes[offset + i] !== expected) return false;
  }

  return signature.verify ? signature.verify(bytes) : true;
}

/**
 * Nhận dạng file từ nội dung thật.
 *
 * @returns chữ ký khớp, hoặc `null` nếu định dạng không nằm trong allowlist.
 */
export function detectFileType(bytes: Uint8Array): FileTypeSignature | null {
  return ALLOWED_FILE_TYPES.find((signature) => matchesSignature(bytes, signature)) ?? null;
}

/** MIME được phép khai báo khi xin upload intent. */
export const ALLOWED_MIME_TYPES = ALLOWED_FILE_TYPES.map((type) => type.mimeType);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

export function kindOfMimeType(mimeType: string): MediaKind | null {
  return ALLOWED_FILE_TYPES.find((type) => type.mimeType === mimeType)?.kind ?? null;
}

/**
 * Giới hạn dung lượng theo loại (§16.3).
 *
 * Video giới hạn rộng hơn ảnh nhưng vẫn có trần: một clip 4K vài phút từ điện thoại dễ
 * vượt 500MB, mà chuyến hàng không cần clip dài như vậy.
 */
export const MAX_SIZE_BYTES: Record<MediaKind, number> = {
  IMAGE: 15 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
};

export function maxSizeFor(mimeType: string): number | null {
  const kind = kindOfMimeType(mimeType);
  return kind ? MAX_SIZE_BYTES[kind] : null;
}

/**
 * `Content-Disposition` khi trả file về trình duyệt (§16.3).
 *
 * Ảnh và video xem trực tiếp được nên dùng `inline`. Mọi thứ khác — kể cả PDF — ép tải
 * xuống: PDF mở inline chạy được JavaScript trong một số trình duyệt, và nội dung do người
 * dùng tải lên không nên chạy trong cùng origin với ứng dụng.
 */
export function contentDispositionFor(mimeType: string, filename: string): string {
  const kind = kindOfMimeType(mimeType);
  const disposition = kind === "IMAGE" || kind === "VIDEO" ? "inline" : "attachment";

  // Tên file chỉ để gợi ý khi lưu; lọc ký tự có thể phá cấu trúc header.
  const safeName = filename.replace(/[^\w.\-]/g, "_").slice(0, 100);

  return `${disposition}; filename="${safeName}"`;
}
