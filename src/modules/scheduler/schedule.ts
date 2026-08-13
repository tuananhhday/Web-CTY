/**
 * Định nghĩa lịch chạy và logic quyết định "đến giờ chưa" (§25).
 *
 * Module thuần, không import database và không tự chạy gì. Toàn bộ phần khó — trôi lịch,
 * chạy chồng, thời điểm chạy lần đầu — kiểm thử được bằng đồng hồ giả.
 */

/** Tên các job định kỳ. Union type để không gõ nhầm chuỗi ở nơi khác. */
export type JobName = "outbox" | "purge-locations" | "cleanup-media";

export interface JobSchedule {
  name: JobName;
  /** Khoảng cách giữa hai lần chạy, tính bằng giây. */
  intervalSeconds: number;
  /** Mô tả ngắn, dùng cho log và tài liệu vận hành. */
  description: string;
}

/**
 * Lịch của ba job định kỳ.
 *
 * Chu kỳ chọn theo mức độ cấp thiết của từng việc, không phải theo một con số chung:
 *
 * - `outbox` mỗi 60 giây. Đây là đường đi của email và SMS thông báo cho khách; chậm hơn
 *   một phút là khách hỏi "sao chưa thấy thông báo". Worker tự xử lý backoff cho bản ghi
 *   lỗi nên chạy dày không gây bão thử lại.
 *
 * - `purge-locations` mỗi 6 giờ. Nghĩa vụ về quyền riêng tư (§31), tính theo ngày lưu trữ
 *   chứ không theo giờ, nên chạy dày hơn cũng không sớm hơn được phút nào. Sáu giờ là đủ
 *   để một lần lỡ nhịp vẫn không kéo dài quá lâu.
 *
 * - `cleanup-media` mỗi 6 giờ. Dọn rác, không ai chờ. Ngưỡng bỏ dở là 24 giờ nên chạy dày
 *   hơn cũng vô ích.
 */
export const SCHEDULES: readonly JobSchedule[] = [
  {
    name: "outbox",
    intervalSeconds: 60,
    description: "Gửi thông báo đang chờ trong outbox",
  },
  {
    name: "purge-locations",
    intervalSeconds: 6 * 60 * 60,
    description: "Xoá điểm vị trí quá hạn lưu trữ",
  },
  {
    name: "cleanup-media",
    intervalSeconds: 6 * 60 * 60,
    description: "Dọn tệp tải lên bỏ dở và bản ghi bị từ chối quá hạn",
  },
] as const;

/** Trạng thái một job giữa các lần chạy. */
export interface JobState {
  /** `null` = chưa chạy lần nào từ khi tiến trình khởi động. */
  lastRunAt: Date | null;
  /** Job có đang chạy dở không. */
  running: boolean;
}

/**
 * Quyết định có chạy job hay không.
 *
 * Hai điều kiện, và điều kiện thứ hai mới là điều đáng nói:
 *
 *   1. Đã qua đủ `intervalSeconds` kể từ lần chạy trước.
 *   2. Lần chạy trước ĐÃ KẾT THÚC.
 *
 * Bỏ qua điều kiện 2 là lỗi kinh điển của bộ lập lịch tự viết. Khi database chậm và một
 * lượt outbox mất 90 giây, timer 60 giây sẽ kích lượt thứ hai chồng lên lượt đang chạy.
 * Hai worker cùng lấy một bản ghi ra gửi, và khách nhận thông báo hai lần. Worker đã có
 * cơ chế claim bằng `updateMany` nên hậu quả không nghiêm trọng, nhưng chạy chồng vẫn phí
 * kết nối database — chặn ở đây rẻ hơn nhiều.
 *
 * Bỏ lượt chứ KHÔNG xếp hàng dồn: nếu tiến trình bị treo mười phút, ta muốn chạy đúng một
 * lượt khi tỉnh lại, không phải mười lượt liên tiếp.
 */
export function shouldRun(
  schedule: JobSchedule,
  state: JobState,
  now: Date
): boolean {
  if (state.running) return false;
  if (state.lastRunAt === null) return true;

  const elapsedMs = now.getTime() - state.lastRunAt.getTime();
  return elapsedMs >= schedule.intervalSeconds * 1000;
}

/**
 * Độ trễ ngẫu nhiên trước lần chạy đầu tiên của mỗi job, tính bằng mili giây.
 *
 * Khi chạy nhiều instance sau cân bằng tải, tất cả khởi động gần như cùng lúc và sẽ đồng
 * loạt gọi database ở giây thứ nhất. Rải ngẫu nhiên trong một chu kỳ để tránh dồn cục.
 *
 * Nhận `random` từ ngoài thay vì gọi `Math.random()` bên trong, để test kiểm được cả hai
 * đầu biên.
 */
export function initialJitterMs(
  schedule: JobSchedule,
  random: () => number = Math.random
): number {
  // Trần 30 giây: job 6 tiếng không cần rải tới hàng giờ mới chạy lần đầu.
  const spreadMs = Math.min(schedule.intervalSeconds * 1000, 30_000);
  return Math.floor(random() * spreadMs);
}
