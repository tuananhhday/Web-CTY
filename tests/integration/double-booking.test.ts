import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { isExclusionViolation } from "@/modules/fleet/conflicts";

/**
 * Kiểm chứng chống double-booking Ở TẦNG DATABASE (§14.3, §24.9).
 *
 * Unit test chỉ chứng minh logic `findConflicts` đúng. Test này chứng minh thứ quan
 * trọng hơn: **kể cả khi tầng ứng dụng có lỗi hoặc bị bỏ qua hoàn toàn**, PostgreSQL vẫn
 * từ chối ghi hai phân công trùng lịch. Đó là lớp bảo vệ cuối cùng.
 *
 * Test ghi thẳng qua Prisma, không đi qua service — cố ý bỏ qua lớp kiểm tra ứng dụng.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

/** Tiền tố riêng để dọn dữ liệu test mà không đụng dữ liệu khác. */
const PREFIX = "ITEST-DBLBOOK";

let vehicleTypeId: string;
let vehicleId: string;
let otherVehicleId: string;
let driverAId: string;
let driverBId: string;
const shipmentIds: string[] = [];

function at(hour: number): Date {
  return new Date(`2026-12-01T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

async function cleanup() {
  await db.shipmentAssignment.deleteMany({
    where: { shipment: { trackingCode: { startsWith: PREFIX } } },
  });
  await db.shipment.deleteMany({ where: { trackingCode: { startsWith: PREFIX } } });
  await db.availabilityBlock.deleteMany({ where: { reason: { startsWith: PREFIX } } });
  await db.vehicle.deleteMany({ where: { plateNumberNormalized: { startsWith: PREFIX } } });
  await db.driverProfile.deleteMany({ where: { employeeCode: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: "itest-dblbook" } } });
  await db.vehicleType.deleteMany({ where: { slug: { startsWith: "itest-dblbook" } } });
}

async function createDriver(suffix: string): Promise<string> {
  const user = await db.user.create({
    data: {
      email: `itest-dblbook-${suffix}@local.test`,
      name: `Tài xế test ${suffix}`,
      emailVerified: true,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const driver = await db.driverProfile.create({
    data: {
      userId: user.id,
      employeeCode: `${PREFIX}-${suffix}`,
      fullName: `Tài xế test ${suffix}`,
      workPhone: `090000${suffix}`,
      workPhoneNormalized: `+8490000${suffix}0`,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return driver.id;
}

beforeAll(async () => {
  await cleanup();

  const type = await db.vehicleType.create({
    data: {
      slug: "itest-dblbook-type",
      name: "Xe test tích hợp",
      category: "MEDIUM_TRUCK",
      status: "DRAFT",
    },
    select: { id: true },
  });
  vehicleTypeId = type.id;

  const vehicle = await db.vehicle.create({
    data: {
      vehicleTypeId,
      plateNumber: `${PREFIX}-01`,
      plateNumberNormalized: `${PREFIX}01`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  vehicleId = vehicle.id;

  const other = await db.vehicle.create({
    data: {
      vehicleTypeId,
      plateNumber: `${PREFIX}-02`,
      plateNumberNormalized: `${PREFIX}02`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  otherVehicleId = other.id;

  driverAId = await createDriver("11");
  driverBId = await createDriver("22");

  // Bốn chuyến rỗng để gắn phân công.
  for (let i = 0; i < 4; i++) {
    const shipment = await db.shipment.create({
      data: { trackingCode: `${PREFIX}${i}`, status: "SCHEDULED", version: 0 },
      select: { id: true },
    });
    shipmentIds.push(shipment.id);
  }
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

beforeEach(async () => {
  await db.shipmentAssignment.deleteMany({
    where: { shipmentId: { in: shipmentIds } },
  });
});

async function assign(input: {
  shipmentIndex: number;
  vehicleId?: string | null;
  primaryDriverId?: string | null;
  secondaryDriverId?: string | null;
  from: number;
  to: number;
  overrideConflict?: boolean;
  isActive?: boolean;
}) {
  return db.shipmentAssignment.create({
    data: {
      shipmentId: shipmentIds[input.shipmentIndex],
      vehicleId: input.vehicleId ?? null,
      primaryDriverId: input.primaryDriverId ?? null,
      secondaryDriverId: input.secondaryDriverId ?? null,
      effectiveFrom: at(input.from),
      effectiveTo: at(input.to),
      isActive: input.isActive ?? true,
      overrideConflict: input.overrideConflict ?? false,
    },
  });
}

describe("exclusion constraint chặn trùng lịch XE", () => {
  it("từ chối phân công thứ hai khi thời gian giao nhau", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });

    await expect(
      assign({ shipmentIndex: 1, vehicleId, from: 10, to: 14 })
    ).rejects.toThrow();
  });

  it("lỗi ném ra nhận diện được bằng isExclusionViolation", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });

    let caught: unknown;
    try {
      await assign({ shipmentIndex: 1, vehicleId, from: 10, to: 14 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(isExclusionViolation(caught)).toBe(true);
  });

  it("CHO PHÉP hai chuyến liền kề nhau", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });

    // Xe xong lúc 12:00 nhận chuyến mới bắt đầu đúng 12:00 — không giao nhau.
    await expect(assign({ shipmentIndex: 1, vehicleId, from: 12, to: 16 })).resolves.toBeDefined();
  });

  it("CHO PHÉP hai chuyến tách rời", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 10 });
    await expect(assign({ shipmentIndex: 1, vehicleId, from: 14, to: 18 })).resolves.toBeDefined();
  });

  it("xe khác nhau thì không xung đột", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });
    await expect(
      assign({ shipmentIndex: 1, vehicleId: otherVehicleId, from: 8, to: 12 })
    ).resolves.toBeDefined();
  });

  it("phân công đã gỡ không còn chiếm chỗ", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12, isActive: false });
    await expect(assign({ shipmentIndex: 1, vehicleId, from: 8, to: 12 })).resolves.toBeDefined();
  });
});

describe("exclusion constraint chặn trùng lịch TÀI XẾ", () => {
  it("từ chối khi tài xế chính trùng giờ", async () => {
    await assign({ shipmentIndex: 0, primaryDriverId: driverAId, from: 8, to: 12 });

    await expect(
      assign({ shipmentIndex: 1, primaryDriverId: driverAId, from: 10, to: 14 })
    ).rejects.toThrow();
  });

  it("tài xế khác thì không xung đột", async () => {
    await assign({ shipmentIndex: 0, primaryDriverId: driverAId, from: 8, to: 12 });
    await expect(
      assign({ shipmentIndex: 1, primaryDriverId: driverBId, from: 8, to: 12 })
    ).resolves.toBeDefined();
  });

  it("cùng tài xế, hai chuyến nối tiếp nhau thì được", async () => {
    await assign({ shipmentIndex: 0, primaryDriverId: driverAId, from: 8, to: 12 });
    await expect(
      assign({ shipmentIndex: 1, primaryDriverId: driverAId, from: 12, to: 16 })
    ).resolves.toBeDefined();
  });
});

describe("override có kiểm soát (§14.3)", () => {
  it("bản ghi đánh dấu overrideConflict được phép trùng lịch", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });

    // Constraint có mệnh đề WHERE loại trừ bản ghi override — dispatcher có thẩm quyền
    // vẫn ghi đè được khi thực sự cần, và AuditLog ghi lại việc đó.
    await expect(
      assign({ shipmentIndex: 1, vehicleId, from: 10, to: 14, overrideConflict: true })
    ).resolves.toBeDefined();
  });

  it("nhưng bản ghi KHÔNG override vẫn bị chặn dù đã có bản override tồn tại", async () => {
    await assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 });
    await assign({ shipmentIndex: 1, vehicleId, from: 9, to: 13, overrideConflict: true });

    await expect(
      assign({ shipmentIndex: 2, vehicleId, from: 10, to: 14 })
    ).rejects.toThrow();
  });
});

describe("chống race condition", () => {
  it("hai lệnh ghi song song chỉ một cái thành công", async () => {
    // Mô phỏng hai dispatcher bấm gán cùng lúc: cả hai đều qua kiểm tra ở tầng ứng dụng
    // vì lúc kiểm tra chưa có bản ghi nào, nhưng database chỉ chấp nhận một.
    const results = await Promise.allSettled([
      assign({ shipmentIndex: 0, vehicleId, from: 8, to: 12 }),
      assign({ shipmentIndex: 1, vehicleId, from: 9, to: 11 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});

describe("check constraint khác vẫn hoạt động", () => {
  it("từ chối khoảng thời gian ngược", async () => {
    await expect(assign({ shipmentIndex: 0, vehicleId, from: 14, to: 8 })).rejects.toThrow();
  });

  it("từ chối khoảng thời gian độ dài bằng 0", async () => {
    await expect(assign({ shipmentIndex: 0, vehicleId, from: 10, to: 10 })).rejects.toThrow();
  });
});
