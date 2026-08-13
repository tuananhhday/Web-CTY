import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { serverEnv, isProduction } from "@/lib/env";

/**
 * Prisma client dùng chung (§4).
 *
 * Prisma 7 yêu cầu driver adapter thay vì truyền connection string trực tiếp.
 *
 * Development: Next.js hot-reload nạp lại module liên tục; nếu khởi tạo client mới
 * mỗi lần sẽ vét cạn connection pool của PostgreSQL. Vì vậy giữ instance trên globalThis.
 *
 * KHÔNG import file này từ Client Component. Truy cập dữ liệu phải đi qua repository
 * trong src/modules/*, không rải lời gọi Prisma trong component (§4).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: serverEnv().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = db;
}

export type { Prisma } from "@/generated/prisma";
