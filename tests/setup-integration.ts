import { config } from "dotenv";

/**
 * Nạp biến môi trường cho integration test.
 *
 * Vitest không tự đọc .env như Next.js. Test tích hợp cần DATABASE_URL thật để kiểm
 * chứng ràng buộc ở tầng database — thứ mà unit test không thể kiểm được.
 */
config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Integration test cần DATABASE_URL. Chạy `pnpm db:up` và tạo file .env từ .env.example."
  );
}

// Chặn chạy nhầm trên database production.
if (/prod|production/i.test(process.env.DATABASE_URL)) {
  throw new Error(
    "DATABASE_URL trông giống database production. Integration test sẽ ghi và xoá dữ liệu — từ chối chạy."
  );
}
