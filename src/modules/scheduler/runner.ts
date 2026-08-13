import "server-only";
import { logger } from "@/lib/logger";
import { cleanupAbandonedMedia } from "@/modules/media/cleanup";
import { purgeExpiredLocations } from "@/modules/locations/service";
import { runOutboxOnce } from "@/modules/notifications/worker";

import {
  SCHEDULES,
  initialJitterMs,
  shouldRun,
  type JobName,
  type JobSchedule,
  type JobState,
} from "./schedule";

/**
 * Bộ chạy job định kỳ trong tiến trình (§25).
 *
 * Ba việc dưới đây trước Pha 9 phải gọi tay. Module này cho chúng tự chạy.
 *
 * PHẠM VI ÁP DỤNG — đọc trước khi bật:
 *
 * Đây là bộ lập lịch trong bộ nhớ, sống cùng tiến trình Node. Nó phù hợp khi triển khai
 * MỘT tiến trình duy nhất: một VPS, một container. Nó KHÔNG phù hợp khi:
 *
 *   - Chạy nhiều instance sau cân bằng tải → mỗi instance chạy job riêng, công việc bị
 *     nhân lên. Worker outbox có claim nên không gửi trùng, nhưng vẫn phí kết nối database.
 *   - Chạy trên nền serverless → tiến trình bị đóng băng giữa các request, timer không nổ.
 *
 * Trong hai trường hợp đó, để `SCHEDULER_ENABLED=false` và gọi
 * `POST /api/internal/scheduler/run` từ một bộ lập lịch bên ngoài đảm bảo chạy đúng một
 * nơi tại một thời điểm.
 */

type JobHandler = () => Promise<unknown>;

const HANDLERS: Record<JobName, JobHandler> = {
  outbox: () => runOutboxOnce(),
  "purge-locations": () => purgeExpiredLocations(),
  "cleanup-media": () => cleanupAbandonedMedia(),
};

/**
 * Trạng thái đặt trên `globalThis` chứ không phải biến module.
 *
 * Hot-reload của Next.js nạp lại module liên tục khi phát triển. Giữ trạng thái ở phạm vi
 * module thì mỗi lần nạp lại sẽ sinh một bộ timer mới trong khi bộ cũ vẫn chạy, và sau vài
 * lần sửa file sẽ có hàng chục worker outbox chạy song song. Cùng lý do với Prisma client
 * trong `src/lib/db.ts`.
 */
const globalForScheduler = globalThis as unknown as {
  __schedulerTimers?: Map<JobName, NodeJS.Timeout>;
  __schedulerStates?: Map<JobName, JobState>;
  __schedulerShutdownHooked?: boolean;
};

function timers(): Map<JobName, NodeJS.Timeout> {
  globalForScheduler.__schedulerTimers ??= new Map();
  return globalForScheduler.__schedulerTimers;
}

function states(): Map<JobName, JobState> {
  globalForScheduler.__schedulerStates ??= new Map();
  return globalForScheduler.__schedulerStates;
}

function stateOf(name: JobName): JobState {
  const existing = states().get(name);
  if (existing) return existing;

  const fresh: JobState = { lastRunAt: null, running: false };
  states().set(name, fresh);
  return fresh;
}

/**
 * Chạy một job đúng một lượt.
 *
 * Không bao giờ ném ra ngoài. Một job hỏng phải không được làm chết vòng lặp lập lịch —
 * nếu để lỗi thoát ra, `setInterval` vẫn chạy tiếp nhưng nếu là promise rejection không bắt
 * thì Node có thể kết thúc tiến trình, kéo theo cả ứng dụng web.
 */
export async function runJobOnce(name: JobName): Promise<void> {
  const state = stateOf(name);

  if (state.running) {
    logger.debug({ job: name }, "Bỏ lượt: job trước chưa xong");
    return;
  }

  state.running = true;
  const startedAt = Date.now();

  try {
    const result = await HANDLERS[name]();
    logger.info({ job: name, durationMs: Date.now() - startedAt, result }, "Job xong");
  } catch (error) {
    logger.error(
      { job: name, durationMs: Date.now() - startedAt, err: error },
      "Job lỗi, sẽ thử lại ở lượt kế tiếp"
    );
  } finally {
    state.running = false;
    state.lastRunAt = new Date();
  }
}

/** Chạy toàn bộ job đến hạn. Dùng cho endpoint cron bên ngoài. */
export async function runDueJobs(now: Date = new Date()): Promise<JobName[]> {
  const ran: JobName[] = [];

  for (const schedule of SCHEDULES) {
    if (!shouldRun(schedule, stateOf(schedule.name), now)) continue;
    await runJobOnce(schedule.name);
    ran.push(schedule.name);
  }

  return ran;
}

function scheduleNext(schedule: JobSchedule): void {
  const timer = setInterval(() => {
    void runJobOnce(schedule.name);
  }, schedule.intervalSeconds * 1000);

  /*
   * `unref` để timer không giữ tiến trình sống. Không có nó, một lệnh dừng bình thường sẽ
   * treo cho tới khi timer tiếp theo nổ — với job 6 tiếng thì đó là 6 tiếng.
   */
  timer.unref?.();
  timers().set(schedule.name, timer);
}

/**
 * Đăng ký dừng gọn khi nhận tín hiệu tắt.
 *
 * Nằm ở đây chứ không ở `src/instrumentation.ts`: file instrumentation cũng được bundle cho
 * runtime Edge, và trình đóng gói soi tĩnh sẽ cảnh báo `process.once` không dùng được ở đó —
 * kể cả khi có chặn theo `NEXT_RUNTIME` lúc chạy. Module này gắn `server-only` và chỉ được
 * import động nên không lọt vào bundle Edge.
 */
function hookShutdown(): void {
  if (globalForScheduler.__schedulerShutdownHooked) return;
  globalForScheduler.__schedulerShutdownHooked = true;

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      logger.info({ signal }, "Đang dừng bộ lập lịch");
      stopScheduler();
    });
  }
}

/** Khởi động bộ lập lịch. Gọi nhiều lần không sao — lần sau bị bỏ qua. */
export function startScheduler(): void {
  if (timers().size > 0) {
    logger.debug("Bộ lập lịch đã chạy, bỏ qua lệnh khởi động lặp");
    return;
  }

  hookShutdown();

  for (const schedule of SCHEDULES) {
    /*
     * Lần chạy đầu bị trễ ngẫu nhiên, không chạy ngay lúc khởi động. Nhiều instance khởi
     * động cùng lúc sau một lần triển khai sẽ không cùng đập vào database ở giây đầu tiên.
     */
    const jitter = initialJitterMs(schedule);
    const kickoff = setTimeout(() => {
      void runJobOnce(schedule.name);
      scheduleNext(schedule);
    }, jitter);
    kickoff.unref?.();

    // Giữ tạm timer khởi động để `stopScheduler` huỷ được nếu dừng trước khi nó nổ.
    timers().set(schedule.name, kickoff);

    logger.info(
      {
        job: schedule.name,
        intervalSeconds: schedule.intervalSeconds,
        firstRunInMs: jitter,
      },
      schedule.description
    );
  }
}

/** Dừng toàn bộ timer. Dùng khi tắt máy chủ và trong test. */
export function stopScheduler(): void {
  for (const timer of timers().values()) {
    clearInterval(timer);
    clearTimeout(timer);
  }
  timers().clear();
}
