import { z } from "zod";

/**
 * Validate biến môi trường một lần khi tiến trình khởi động (fail fast).
 *
 * Nguyên tắc:
 *   - `serverEnv` CHỈ được import từ mã chạy trên server. Import nhầm vào Client Component
 *     sẽ ném lỗi ngay thay vì âm thầm rò secret ra bundle trình duyệt.
 *   - `clientEnv` chỉ chứa biến NEXT_PUBLIC_*, an toàn để dùng ở client.
 *   - Không đặt giá trị mặc định cho secret. Thiếu là dừng, không đoán.
 */

const booleanString = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const positiveIntString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().positive());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL là bắt buộc")
    .refine(
      (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
      "DATABASE_URL phải là chuỗi kết nối PostgreSQL"
    ),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET phải dài tối thiểu 32 ký tự"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL phải là URL hợp lệ"),
  REQUIRE_STAFF_MFA: booleanString.default(false),

  // Tài khoản seed — chỉ tồn tại ở development.
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_DEMO_PASSWORD: z.string().min(8).optional(),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_BUCKET: z.string().default("vantai-media"),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_ENDPOINT: z.string().default(""),
  STORAGE_ACCESS_KEY_ID: z.string().default(""),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(""),
  STORAGE_SIGNED_URL_TTL: positiveIntString(300),

  MAP_PROVIDER: z.enum(["none", "google"]).default("none"),
  GEOCODING_PROVIDER: z.enum(["none", "google"]).default("none"),
  GEOCODING_API_KEY: z.string().default(""),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: positiveIntString(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  MAIL_FROM: z.string().default("Nen tang van tai <no-reply@example.test>"),

  SMS_PROVIDER: z.enum(["console", "http"]).default("console"),
  SMS_API_KEY: z.string().default(""),
  SMS_SENDER_ID: z.string().default(""),
  ZALO_PROVIDER: z.enum(["none", "oa"]).default("none"),
  ZALO_OA_ID: z.string().default(""),
  ZALO_ACCESS_TOKEN: z.string().default(""),

  RATE_LIMIT_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().default(""),

  VIRUS_SCAN_PROVIDER: z.enum(["noop", "http"]).default("noop"),
  VIRUS_SCAN_ENDPOINT: z.string().default(""),
  VIRUS_SCAN_API_KEY: z.string().default(""),

  CAPTCHA_PROVIDER: z.enum(["none", "turnstile", "recaptcha"]).default("none"),
  CAPTCHA_SECRET_KEY: z.string().default(""),

  ERROR_MONITORING_DSN: z.string().default(""),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  LOCATION_RETENTION_DAYS: positiveIntString(30),
  LOCATION_VISIBILITY_MINUTES: positiveIntString(60),
  AUDIT_RETENTION_DAYS: positiveIntString(365),

  /**
   * Bật bộ lập lịch chạy trong tiến trình ứng dụng (§25).
   *
   * Mặc định TẮT, và mặc định này là có chủ đích. Khi chạy nhiều instance sau cân bằng tải,
   * mỗi instance sẽ có bộ lập lịch riêng và cùng chạy một job — bật nhầm là nhân bản công
   * việc lên theo số instance.
   *
   * Bật `true` khi triển khai một tiến trình duy nhất (VPS, một container). Để `false` khi
   * chạy nhiều instance hoặc trên nền serverless, rồi gọi
   * `POST /api/internal/scheduler/run` từ cron bên ngoài.
   *
   * Xem `docs/operations-runbook.md`.
   */
  SCHEDULER_ENABLED: booleanString.default(false),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL phải là URL hợp lệ"),
  NEXT_PUBLIC_MAP_API_KEY: z.string().default(""),
  NEXT_PUBLIC_CAPTCHA_SITE_KEY: z.string().default(""),
});

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function parseOrExit<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
  label: string
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Cấu hình môi trường (${label}) không hợp lệ:\n${formatIssues(result.error)}\n` +
        `Kiểm tra lại file .env — tham khảo .env.example.`
    );
  }
  return result.data;
}

/**
 * Biến môi trường phía client. Next.js thay thế `process.env.NEXT_PUBLIC_*` lúc build
 * nên phải truy cập từng biến theo tên tường minh, không dùng destructuring động.
 */
export const clientEnv = parseOrExit(
  clientSchema,
  {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_MAP_API_KEY: process.env.NEXT_PUBLIC_MAP_API_KEY,
    NEXT_PUBLIC_CAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY,
  },
  "client"
);

type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Biến môi trường phía server. Gọi hàm thay vì export hằng để việc validate xảy ra
 * lúc dùng thật, tránh làm hỏng quá trình build khi Next.js gom module.
 *
 * @throws nếu bị gọi từ trình duyệt, hoặc khi cấu hình thiếu/sai.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() bị gọi từ phía client. Chỉ import module này trong mã chạy trên server."
    );
  }
  cachedServerEnv ??= parseOrExit(serverSchema, process.env, "server");
  return cachedServerEnv;
}

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
export const isTest = process.env.NODE_ENV === "test";
