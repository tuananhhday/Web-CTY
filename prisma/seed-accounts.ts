/**
 * Seed tài khoản development (§33).
 *
 * Tách khỏi prisma/seed.ts vì file này cần Better Auth để hash mật khẩu đúng cách,
 * kéo theo toàn bộ cấu hình ứng dụng.
 *
 * BẢO MẬT:
 *   - Không chạy khi NODE_ENV=production.
 *   - Mật khẩu đọc từ biến môi trường, không hardcode.
 *   - Chạy lặp không tạo trùng.
 *   - In hướng dẫn tài khoản ra terminal, không ghi vào file trong repo.
 */
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { normalizeEmail, normalizePhone } from "../src/lib/normalize";
import type { StoredRole } from "../src/modules/auth/permissions";

if (process.env.NODE_ENV === "production") {
  console.error(
    "Từ chối chạy: seed tài khoản development không được phép ở production.\n" +
      "Tài khoản quản trị đầu tiên phải được tạo qua quy trình có kiểm soát."
  );
  process.exit(1);
}

const password = process.env.SEED_DEMO_PASSWORD;
if (!password || password.length < 10) {
  console.error(
    "Thiếu SEED_DEMO_PASSWORD hoặc mật khẩu ngắn hơn 10 ký tự.\n" +
      "Đặt biến này trong .env trước khi seed tài khoản."
  );
  process.exit(1);
}

interface SeedAccount {
  email: string;
  name: string;
  phone: string;
  roles: StoredRole[];
  /** Tạo kèm DriverProfile cho vai trò tài xế. */
  driver?: { employeeCode: string; licenseClass: string };
}

const accounts: SeedAccount[] = [
  {
    email: "superadmin@local.test",
    name: "Quản trị hệ thống",
    phone: "0900000001",
    roles: ["SUPER_ADMIN"],
  },
  {
    email: "admin@local.test",
    name: "Quản trị viên",
    phone: "0900000002",
    roles: ["ADMIN"],
  },
  {
    email: "dieuphoi@local.test",
    name: "Nhân viên điều phối",
    phone: "0900000003",
    roles: ["DISPATCHER"],
  },
  {
    email: "bientap@local.test",
    name: "Nhân viên nội dung",
    phone: "0900000004",
    roles: ["EDITOR"],
  },
  {
    email: "ketoan@local.test",
    name: "Nhân viên kế toán",
    phone: "0900000005",
    roles: ["ACCOUNTANT"],
  },
  {
    email: "taixe1@local.test",
    name: "Trần Văn Bình",
    phone: "0900000006",
    roles: ["DRIVER"],
    driver: { employeeCode: "TX-001", licenseClass: "C" },
  },
  {
    email: "taixe2@local.test",
    name: "Lê Văn Cường",
    phone: "0900000007",
    roles: ["DRIVER"],
    driver: { employeeCode: "TX-002", licenseClass: "FC" },
  },
  {
    email: "khachhang1@local.test",
    name: "Nguyễn Văn An",
    phone: "0900000008",
    roles: ["CUSTOMER"],
  },
  {
    email: "khachhang2@local.test",
    name: "Phạm Thị Dung",
    phone: "0900000009",
    roles: ["CUSTOMER"],
  },

  /*
   * Ba tài khoản dưới đây dành riêng cho kịch bản thử trên NHIỀU MÁY: một máy đóng vai
   * doanh nghiệp, một máy đóng vai khách hàng, và một thiết bị đóng vai tài xế.
   *
   * Đặt tên theo vai trò thay vì theo tên người để không phải tra bảng khi đang thử.
   * Xem `docs/testing-guide.md`.
   */
  {
    /*
     * DISPATCHER + ACCOUNTANT chứ KHÔNG phải ADMIN.
     *
     * ADMIN thuộc nhóm quyền cao nên `payment.record` đòi xác thực lại bằng MFA (§30.2),
     * mà MFA chưa được triển khai — tài khoản ADMIN sẽ không ghi nhận được thanh toán.
     * Hai vai trò này phủ toàn bộ vận hành thật và vẫn thu tiền được.
     *
     * Không có: `quote.approve` (duyệt báo giá vượt ngưỡng), `cms.*`, `user.manage`,
     * `audit.read`. Cần những thứ đó thì dùng `superadmin@local.test`.
     */
    email: "doanhnghiep@local.test",
    name: "Quản lý điều hành",
    phone: "0900000011",
    roles: ["DISPATCHER", "ACCOUNTANT"],
  },
  {
    email: "khach@local.test",
    name: "Khách hàng thử nghiệm",
    phone: "0900000012",
    roles: ["CUSTOMER"],
  },
  {
    /*
     * Bắt buộc phải có, dù đề bài chỉ nhắc tới doanh nghiệp và khách hàng: vị trí GPS do
     * THIẾT BỊ TÀI XẾ gửi lên. Không có ai đăng nhập bằng tài khoản này thì màn hình khách
     * hàng sẽ không bao giờ hiện vị trí nào.
     */
    email: "taixe@local.test",
    name: "Tài xế thử nghiệm",
    phone: "0900000013",
    roles: ["DRIVER"],
    driver: { employeeCode: "TX-TEST", licenseClass: "C" },
  },
];

async function seedAccount(account: SeedAccount): Promise<"created" | "existing"> {
  const email = normalizeEmail(account.email);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  let userId: string;
  let outcome: "created" | "existing";

  if (existing) {
    userId = existing.id;
    outcome = "existing";
  } else {
    // Dùng API của Better Auth để mật khẩu được hash đúng cấu hình thư viện (§9).
    const result = await auth.api.signUpEmail({
      body: { email, password: password!, name: account.name },
    });
    userId = result.user.id;
    outcome = "created";
  }

  const phoneNormalized = normalizePhone(account.phone);

  // Tài khoản development bỏ qua bước xác minh email để đăng nhập được ngay.
  await db.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      status: "ACTIVE",
      phone: account.phone,
      phoneNormalized,
    },
  });

  for (const role of account.roles) {
    await db.userRoleAssignment.upsert({
      where: { userId_role: { userId, role } },
      update: { revokedAt: null },
      create: { userId, role },
    });
  }

  if (account.driver) {
    await db.driverProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        employeeCode: account.driver.employeeCode,
        fullName: account.name,
        workPhone: account.phone,
        workPhoneNormalized: phoneNormalized ?? account.phone,
        licenseClass: account.driver.licenseClass,
        status: "ACTIVE",
      },
    });
  }

  return outcome;
}

async function main() {
  // Hai tài khoản trùng email sẽ gộp thành một user mang nhiều vai trò — sai ý đồ
  // và làm test phân quyền cho kết quả nhầm lẫn. Dừng sớm thay vì tạo dữ liệu sai.
  const seen = new Set<string>();
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    if (seen.has(email)) {
      throw new Error(
        `Email trùng trong danh sách seed: ${email}. Mỗi vai trò phải có tài khoản riêng.`
      );
    }
    seen.add(email);
  }

  console.log("\nSeed tài khoản development...\n");

  let created = 0;
  let existing = 0;

  for (const account of accounts) {
    const outcome = await seedAccount(account);
    if (outcome === "created") created++;
    else existing++;
    console.log(`  ${outcome === "created" ? "tạo mới" : "đã có "}  ${account.email.padEnd(26)} ${account.roles.join(", ")}`);
  }

  console.log(`\n${created} tài khoản mới, ${existing} tài khoản đã tồn tại.\n`);
  console.log("──────────────────────────────────────────────────────────────");
  console.log("  TÀI KHOẢN DEVELOPMENT");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("  Mật khẩu chung: giá trị của SEED_DEMO_PASSWORD trong .env");
  console.log("");
  console.log("  Các tài khoản này CHỈ tồn tại ở máy local.");
  console.log("  Không dùng mật khẩu này ở bất kỳ môi trường nào khác.");
  console.log("  Email đã được đánh dấu đã xác minh để đăng nhập được ngay.");
  console.log("──────────────────────────────────────────────────────────────\n");
}

main()
  .catch((error) => {
    console.error("Seed tài khoản thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
