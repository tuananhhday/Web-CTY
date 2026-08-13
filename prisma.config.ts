import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Cấu hình Prisma CLI (Prisma 7).
 *
 * `dotenv/config` nạp DATABASE_URL từ file .env — Prisma 7 không tự đọc .env nữa.
 * Chuỗi kết nối chỉ khai báo ở đây, không đặt trong schema.prisma.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Database tạm để Prisma dựng lại lịch sử migration khi so sánh (migrate diff/dev).
    // Chỉ dùng ở development; Prisma tự tạo và xoá schema bên trong.
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
