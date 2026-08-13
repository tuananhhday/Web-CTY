import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  evaluateReadiness,
  statusToHttpCode,
  type ReadinessCheck,
} from "@/modules/health/readiness";

/**
 * GET /api/health/ready — readiness probe (§25).
 *
 * Khác `/api/health/live` ở chỗ endpoint này CÓ chạm phụ thuộc ngoài. Bộ điều phối dùng nó
 * để quyết định có gửi lưu lượng vào node này không — không phải để restart tiến trình.
 *
 * Chỉ trả về tên phép kiểm tra, trạng thái và thời gian. KHÔNG trả chuỗi lỗi, tên host,
 * phiên bản database hay đường dẫn nội bộ: endpoint này thường bị để mở cho load balancer
 * và là thứ đầu tiên người dò quét gọi tới. Chi tiết lỗi đi vào log máy chủ.
 */

export const dynamic = "force-dynamic";

const checks: ReadinessCheck[] = [
  {
    name: "database",
    required: true,
    run: async () => {
      /*
       * `SELECT 1` chứ không phải đếm bản ghi ở bảng nào: probe phải rẻ và không phụ thuộc
       * vào việc bảng đó có dữ liệu hay không. Nó xác nhận đúng thứ cần xác nhận — pool
       * còn kết nối và PostgreSQL còn trả lời.
       */
      await db.$queryRaw`SELECT 1`;
    },
  },
];

export async function GET(): Promise<Response> {
  const report = await evaluateReadiness(checks);

  if (report.status !== "ok") {
    logger.warn({ report }, "Readiness probe không đạt");
  }

  return new Response(JSON.stringify(report), {
    status: statusToHttpCode(report.status),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
