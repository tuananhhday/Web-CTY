import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { serverEnv } from "@/lib/env";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * StorageProvider (§4, §16.3).
 *
 * Adapter `local` lưu file ra đĩa và tự ký URL bằng HMAC — đủ để chạy và kiểm thử toàn bộ
 * luồng upload 8 bước mà không cần tài khoản S3/R2. KHÔNG dùng ở production: file nằm trên
 * đĩa của một instance, không nhân bản, không CDN, không lifecycle policy.
 *
 * Adapter `s3` chưa triển khai. Chọn `STORAGE_PROVIDER=s3` sẽ báo lỗi rõ ràng ngay lúc khởi
 * tạo thay vì âm thầm ghi vào đĩa và làm người vận hành tưởng đã dùng object storage thật.
 */

export interface UploadTarget {
  /** URL client PUT nội dung file lên. */
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectInfo {
  sizeBytes: number;
  /** SHA-256 của toàn bộ nội dung, dùng đối chiếu với checksum client khai báo. */
  checksum: string;
}

export interface StorageProvider {
  readonly name: string;
  readonly isProductionReady: boolean;

  /** Tạo đích upload ngắn hạn cho một object key đã định trước. */
  createUploadTarget(input: {
    objectKey: string;
    mimeType: string;
    maxBytes: number;
  }): Promise<UploadTarget>;

  /** Thông tin object sau khi client báo đã upload xong. `null` nếu chưa tồn tại. */
  head(objectKey: string): Promise<ObjectInfo | null>;

  /** Đọc vài byte đầu để nhận dạng định dạng thật (§16.3 bước 6). */
  readHead(objectKey: string, length: number): Promise<Uint8Array>;

  /** Đọc toàn bộ nội dung. Chỉ dùng cho proxy tải file, không dùng cho video lớn. */
  read(objectKey: string): Promise<Uint8Array>;

  remove(objectKey: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// Adapter local
// -----------------------------------------------------------------------------

const LOCAL_ROOT = resolve(process.cwd(), "storage");

/**
 * Chuyển object key thành đường dẫn đĩa, chặn path traversal.
 *
 * Object key do server sinh nên về nguyên tắc luôn an toàn, nhưng hàm này là nơi cuối cùng
 * trước khi chạm hệ thống tệp — kiểm tra ở đây thì một lỗi ở tầng trên cũng không thành lỗ
 * hổng ghi file tùy ý (§30.4).
 */
function toLocalPath(objectKey: string): string {
  const target = resolve(LOCAL_ROOT, objectKey);

  if (target !== LOCAL_ROOT && !target.startsWith(LOCAL_ROOT + sep)) {
    throw appError("VALIDATION_ERROR", "Object key không hợp lệ.");
  }

  return target;
}

/** Chữ ký cho URL upload cục bộ. Dùng lại BETTER_AUTH_SECRET để không thêm biến môi trường. */
function signLocalUpload(objectKey: string, expiresAtMs: number): string {
  return createHmac("sha256", serverEnv().BETTER_AUTH_SECRET)
    .update(`${objectKey}:${expiresAtMs}`)
    .digest("hex");
}

export function verifyLocalUploadSignature(
  objectKey: string,
  expiresAtMs: number,
  signature: string
): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

  const expected = signLocalUpload(objectKey, expiresAtMs);

  // So sánh theo thời gian hằng định: so sánh chuỗi thông thường dừng ở byte khác nhau đầu
  // tiên, để lộ thông tin qua thời gian phản hồi.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Ghi file từ luồng upload cục bộ. Chỉ route upload nội bộ gọi hàm này. */
export async function writeLocalObject(objectKey: string, data: Uint8Array): Promise<void> {
  const path = toLocalPath(objectKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

const localProvider: StorageProvider = {
  name: "local",
  isProductionReady: false,

  async createUploadTarget({ objectKey }) {
    const ttlSeconds = serverEnv().STORAGE_SIGNED_URL_TTL;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const signature = signLocalUpload(objectKey, expiresAt.getTime());

    const params = new URLSearchParams({
      key: objectKey,
      expires: String(expiresAt.getTime()),
      signature,
    });

    return {
      url: `/api/uploads/local?${params.toString()}`,
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      expiresAt,
    };
  },

  async head(objectKey) {
    const path = toLocalPath(objectKey);

    try {
      const stats = await stat(path);
      const content = await readFile(path);
      return {
        sizeBytes: stats.size,
        checksum: createHash("sha256").update(content).digest("hex"),
      };
    } catch {
      return null;
    }
  },

  async readHead(objectKey, length) {
    const content = await readFile(toLocalPath(objectKey));
    return new Uint8Array(content.subarray(0, length));
  },

  async read(objectKey) {
    return new Uint8Array(await readFile(toLocalPath(objectKey)));
  },

  async remove(objectKey) {
    try {
      await unlink(toLocalPath(objectKey));
    } catch {
      // Xoá file không tồn tại không phải lỗi: dọn dẹp phải chạy lại được nhiều lần.
    }
  },
};

let cached: StorageProvider | null = null;

export function storageProvider(): StorageProvider {
  if (cached) return cached;

  const provider = serverEnv().STORAGE_PROVIDER;

  if (provider === "s3") {
    throw new Error(
      "STORAGE_PROVIDER=s3 nhưng adapter S3 chưa được triển khai. " +
        "Đặt STORAGE_PROVIDER=local cho development."
    );
  }

  if (process.env.NODE_ENV === "production") {
    logger.warn(
      "Đang dùng storage adapter `local` ở production. File chỉ nằm trên đĩa của một instance."
    );
  }

  cached = localProvider;
  return cached;
}
