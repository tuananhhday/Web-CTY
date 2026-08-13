import "server-only";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * VirusScanProvider (§16.3 bước 6, §30.4).
 *
 * Adapter `noop` KHÔNG quét gì cả. Nó tồn tại để luồng upload chạy được ở development mà
 * không cần dịch vụ quét, và để chỗ nối sẵn sàng khi doanh nghiệp chọn nhà cung cấp.
 *
 * `isProductionReady = false` không phải để trang trí: `docs/deployment.md` và checklist
 * Pha 9 phải kiểm tra cờ này trước khi cho phép nhận file từ người dùng ngoài.
 */

export type ScanVerdict =
  | { clean: true }
  | { clean: false; reason: string };

export interface VirusScanProvider {
  readonly name: string;
  readonly isProductionReady: boolean;
  scan(input: { objectKey: string; sizeBytes: number }): Promise<ScanVerdict>;
}

const noopProvider: VirusScanProvider = {
  name: "noop",
  isProductionReady: false,

  async scan({ objectKey }) {
    logger.debug({ objectKey }, "Bỏ qua quét mã độc (adapter noop)");
    return { clean: true };
  },
};

let cached: VirusScanProvider | null = null;

export function virusScanProvider(): VirusScanProvider {
  if (cached) return cached;

  const provider = serverEnv().VIRUS_SCAN_PROVIDER;

  if (provider === "http") {
    throw new Error(
      "VIRUS_SCAN_PROVIDER=http nhưng adapter chưa được triển khai. " +
        "Đặt VIRUS_SCAN_PROVIDER=noop cho development."
    );
  }

  cached = noopProvider;
  return cached;
}
