/**
 * Đánh giá tình trạng sẵn sàng phục vụ (§25).
 *
 * Module thuần: nhận danh sách phép kiểm tra dưới dạng hàm, không tự biết database hay
 * dịch vụ nào. Nhờ vậy kiểm thử được đầy đủ các nhánh — chậm, hỏng, timeout — mà không cần
 * dựng hạ tầng thật.
 */

/** Kết quả một phép kiểm tra đơn lẻ. */
export interface CheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  durationMs: number;
}

export interface ReadinessCheck {
  name: string;
  /**
   * `true` = phụ thuộc bắt buộc; hỏng thì cả hệ thống không sẵn sàng.
   * `false` = phụ thuộc phụ trợ; hỏng thì suy giảm nhưng vẫn phục vụ được.
   */
  required: boolean;
  run: (signal: AbortSignal) => Promise<void>;
}

export interface ReadinessReport {
  status: "ok" | "degraded" | "down";
  checks: CheckResult[];
  durationMs: number;
}

/**
 * Ngưỡng thời gian cho một phép kiểm tra.
 *
 * Probe treo còn tệ hơn probe báo hỏng: bộ điều phối sẽ chờ hết timeout của nó rồi mới kết
 * luận, làm chậm việc rút node hỏng ra khỏi cân bằng tải. 3 giây đủ rộng cho một truy vấn
 * `SELECT 1` kể cả khi pool đang bận, và vẫn ngắn hơn timeout mặc định của hầu hết bộ điều
 * phối.
 */
export const CHECK_TIMEOUT_MS = 3_000;

/**
 * Ngưỡng coi là chậm bất thường.
 *
 * Vượt ngưỡng này thì phụ thuộc vẫn trả lời nhưng đã có dấu hiệu quá tải. Báo `degraded`
 * để cảnh báo sớm, chưa rút khỏi cân bằng tải — một database chậm vẫn tốt hơn không có
 * node nào phục vụ.
 */
export const SLOW_THRESHOLD_MS = 1_000;

async function runOne(check: ReadinessCheck): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    await check.run(controller.signal);
    const durationMs = Date.now() - startedAt;
    return {
      name: check.name,
      status: durationMs > SLOW_THRESHOLD_MS ? "degraded" : "ok",
      durationMs,
    };
  } catch {
    /*
     * Nuốt lỗi có chủ đích. Nội dung lỗi của Prisma chứa host, cổng, tên database, đôi khi
     * cả tên người dùng — không được lọt ra endpoint công khai. Chi tiết đã đi vào log ở
     * lớp gọi.
     */
    return { name: check.name, status: "down", durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chạy toàn bộ phép kiểm tra song song và tổng hợp.
 *
 * Song song chứ không tuần tự: probe phải trả lời nhanh, và các phụ thuộc độc lập nhau.
 */
export async function evaluateReadiness(
  checks: readonly ReadinessCheck[]
): Promise<ReadinessReport> {
  const startedAt = Date.now();
  const results = await Promise.all(checks.map(runOne));

  return {
    status: summarize(checks, results),
    checks: results,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Gộp kết quả thành một trạng thái.
 *
 * Quy tắc, theo thứ tự ưu tiên:
 *   1. Bất kỳ phụ thuộc BẮT BUỘC nào `down` → `down`. Node bị rút khỏi cân bằng tải.
 *   2. Còn lại, có bất kỳ dấu hiệu bất thường nào → `degraded`. Vẫn nhận request.
 *   3. Không thì `ok`.
 *
 * Phụ thuộc không bắt buộc `down` chỉ làm suy giảm. Ví dụ: nhà cung cấp email chết thì
 * thông báo dồn lại trong outbox và gửi bù sau, khách vẫn tra cứu và đặt hàng bình thường —
 * rút cả hệ thống khỏi cân bằng tải trong tình huống đó là tự gây sự cố lớn hơn.
 */
function summarize(
  checks: readonly ReadinessCheck[],
  results: readonly CheckResult[]
): "ok" | "degraded" | "down" {
  const requiredNames = new Set(checks.filter((c) => c.required).map((c) => c.name));

  if (results.some((r) => r.status === "down" && requiredNames.has(r.name))) {
    return "down";
  }
  if (results.some((r) => r.status !== "ok")) {
    return "degraded";
  }
  return "ok";
}

/** Mã HTTP tương ứng: chỉ `down` mới khiến bộ điều phối rút node ra. */
export function statusToHttpCode(status: ReadinessReport["status"]): number {
  return status === "down" ? 503 : 200;
}
