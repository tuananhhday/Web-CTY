/**
 * GET /api/health/live — liveness probe (§25).
 *
 * Trả lời đúng một câu hỏi: tiến trình Node còn nhận request được không?
 *
 * KHÔNG chạm database, KHÔNG gọi dịch vụ ngoài, KHÔNG đọc phiên. Có chủ đích: bộ điều phối
 * (Kubernetes, Docker healthcheck, load balancer) dùng liveness để quyết định KHỞI ĐỘNG LẠI
 * tiến trình. Nếu probe này phụ thuộc database thì một sự cố database sẽ khiến toàn bộ ứng
 * dụng bị restart hàng loạt trong khi bản thân nó vẫn hoàn toàn khoẻ mạnh — biến sự cố tạm
 * thời thành sập hệ thống. Phụ thuộc bên ngoài thuộc về `/api/health/ready`.
 *
 * Không có thông tin nào cần bảo vệ nên endpoint mở, nhưng vẫn không tiết lộ phiên bản,
 * commit hay tên host — những thứ đó chỉ giúp người dò quét.
 */

export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Probe phải luôn hỏi thật, không được ăn cache của proxy nào.
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
