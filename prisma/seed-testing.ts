/**
 * Dữ liệu để thử tay trên máy phát triển.
 *
 * ⚠️ CHỈ DÙNG Ở DEVELOPMENT. Script này tạo chuyến hàng, xe và phân công giả để người phát
 * triển bấm thử giao diện. Nó từ chối chạy khi `NODE_ENV=production`.
 *
 * Khác với `prisma/seed.ts` (nội dung website thật, chạy được ở production) và
 * `prisma/seed-accounts.ts` (tài khoản đăng nhập).
 *
 * Điểm mấu chốt: khung giờ phân công được tính THEO THỜI ĐIỂM CHẠY, không phải ngày cố định.
 * Chuyến có khung giờ đã hết hạn sẽ không hiện thông tin tài xế cho khách (§16.1), và đó
 * chính là thứ làm người thử tưởng hệ thống hỏng.
 *
 * Chạy lại được nhiều lần: mọi thứ script tạo đều mang tiền tố `TEST-` hoặc mã bắt đầu bằng
 * `VTTEST`, và được xoá sạch trước khi tạo lại.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { normalizePhone } from "../src/lib/normalize";

if (process.env.NODE_ENV === "production") {
  console.error("Từ chối chạy: đây là dữ liệu thử, không được tạo trên production.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Tiền tố để nhận diện và dọn dẹp. */
const PLATE_PREFIX = "TEST";
const CODE_PREFIX = "VTTEST";

const hours = (n: number) => n * 60 * 60 * 1000;

/** Toạ độ quanh TP.HCM, dùng làm điểm lấy và giao. */
const SAIGON = { lat: 10.7769, lng: 106.7009 };

async function cleanup() {
  const shipments = await db.shipment.findMany({
    where: { trackingCode: { startsWith: CODE_PREFIX } },
    select: { id: true },
  });
  const ids = shipments.map((s) => s.id);

  if (ids.length > 0) {
    // LocationPing, ShipmentStop, ShipmentAssignment đều cascade theo Shipment.
    await db.shipment.deleteMany({ where: { id: { in: ids } } });
  }

  // ServiceRequest KHÔNG cascade theo Shipment (quan hệ là SetNull), phải xoá riêng.
  await db.serviceRequest.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });

  await db.vehicle.deleteMany({
    where: { plateNumberNormalized: { startsWith: PLATE_PREFIX } },
  });

  console.log(`  · Đã dọn ${ids.length} chuyến thử và xe thử cũ`);
}

async function main() {
  console.log("Tạo dữ liệu thử tay\n");

  await cleanup();

  // --- Người dùng cần có sẵn từ seed-accounts ---------------------------------

  /*
   * Chuyến thử gắn vào cặp tài khoản đặt tên theo vai trò (`khach@`, `taixe@`) để kịch bản
   * nhiều máy chạy được ngay, không phải cấu hình gì thêm.
   */
  const driver1 = await db.driverProfile.findFirst({
    where: { user: { email: "taixe@local.test" } },
    select: { id: true, employeeCode: true },
  });
  const driver2 = await db.driverProfile.findFirst({
    where: { user: { email: "taixe2@local.test" } },
    select: { id: true, employeeCode: true },
  });
  const customer = await db.user.findUnique({
    where: { email: "khach@local.test" },
    select: { id: true, phone: true },
  });

  if (!driver1 || !driver2 || !customer) {
    console.error(
      "\nThiếu tài khoản mẫu. Chạy `pnpm db:seed:accounts` trước rồi thử lại."
    );
    process.exit(1);
  }

  const vehicleType = await db.vehicleType.findFirst({ select: { id: true } });
  if (!vehicleType) {
    console.error("\nChưa có nhóm phương tiện. Chạy `pnpm db:seed` trước.");
    process.exit(1);
  }

  // --- Xe ---------------------------------------------------------------------

  const plates = [
    { plate: "TEST-51C-11111", brand: "Hyundai", model: "H150" },
    { plate: "TEST-51C-22222", brand: "Isuzu", model: "QKR" },
    { plate: "TEST-51C-33333", brand: "Thaco", model: "Towner" },
  ];

  const vehicles = [];
  for (const p of plates) {
    vehicles.push(
      await db.vehicle.create({
        data: {
          vehicleTypeId: vehicleType.id,
          plateNumber: p.plate,
          plateNumberNormalized: p.plate.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
          brand: p.brand,
          model: p.model,
          status: "ACTIVE",
        },
        select: { id: true, plateNumber: true },
      })
    );
  }
  console.log(`  · ${vehicles.length} xe thử`);

  // --- Chuyến hàng ------------------------------------------------------------

  const now = new Date();

  const scenarios: Scenario[] = [
    {
      code: `${CODE_PREFIX}GPS01`,
      status: "IN_TRANSIT",
      driverId: driver1.id,
      vehicleId: vehicles[0].id,
      fromHours: -2,
      toHours: +6,
      locationSharing: true,
      label: "GPS — đang chạy, khách xem được vị trí",
    },
    {
      /*
       * Dùng tài xế 2 chứ không phải tài xế 1: khung giờ này chồng với GPS01, và ràng buộc
       * exclusion ở tầng database sẽ từ chối. Đó là hành vi đúng — một tài xế không nhận
       * được hai chuyến cùng giờ.
       */
      code: `${CODE_PREFIX}GPS02`,
      status: "AT_PICKUP",
      driverId: driver2.id,
      vehicleId: vehicles[1].id,
      fromHours: -1,
      toHours: +5,
      locationSharing: false,
      label: "GPS tắt — khách KHÔNG xem được vị trí",
    },
    {
      code: `${CODE_PREFIX}LATE1`,
      status: "IN_TRANSIT",
      driverId: driver1.id,
      vehicleId: vehicles[2].id,
      fromHours: -30,
      toHours: -22,
      locationSharing: true,
      label: "Chuyến chạy trễ — tài xế VẪN cập nhật được",
    },
    {
      code: `${CODE_PREFIX}DONE1`,
      status: "COMPLETED",
      driverId: driver2.id,
      vehicleId: vehicles[0].id,
      fromHours: -72,
      toHours: -64,
      locationSharing: false,
      label: "Đã khép lại — tài xế KHÔNG cập nhật được nữa",
    },
  ];

  for (const s of scenarios) {
    try {
      await createScenario(s, customer.id, vehicleType.id, now);
    } catch (error) {
      /*
       * Nguyên nhân gần như chắc chắn: ràng buộc exclusion chống trùng lịch. Dữ liệu cũ
       * trong database có thể đã chiếm khung giờ này cho cùng xe hoặc cùng tài xế.
       * Báo rõ thay vì đổ stack trace của Prisma.
       */
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("shipment_assignments") && message.includes("overlap")) {
        console.log(
          `  ⚠ ${s.code.padEnd(14)} BỎ QUA — trùng lịch xe/tài xế với dữ liệu đã có.\n` +
            `                   Chạy \`pnpm db:reset\` rồi seed lại nếu muốn môi trường sạch.`
        );
        continue;
      }
      throw error;
    }
  }

  console.log("\nXong. Mật khẩu mọi tài khoản: giá trị SEED_DEMO_PASSWORD trong .env");
}

interface Scenario {
  code: string;
  status: "DRIVER_ASSIGNED" | "IN_TRANSIT" | "AT_PICKUP" | "COMPLETED";
  driverId: string;
  vehicleId: string;
  /** Khung giờ tính lệch so với thời điểm chạy script, không phải ngày cố định. */
  fromHours: number;
  toHours: number;
  locationSharing: boolean;
  label: string;
}

/**
 * Số điện thoại dùng cho tra cứu công khai — trùng với số của `khach@local.test`.
 * 4 số cuối là `0012`.
 */
const CONTACT_PHONE = "0900000012";

async function createScenario(
  s: Scenario,
  customerId: string,
  vehicleTypeId: string,
  now: Date
): Promise<void> {
  /*
   * Tra cứu công khai đối chiếu 4 số cuối với `ServiceRequest.contactPhoneNormalized`, chứ
   * không phải số điện thoại trên hồ sơ người dùng. Chuyến không có yêu cầu dịch vụ đi kèm
   * sẽ LUÔN trả 404 ở `/tra-cuu` — trông y hệt lỗi, nên phải tạo kèm.
   */
  const request = await db.serviceRequest.create({
    data: {
      code: `${s.code}-REQ`,
      kind: "FREIGHT",
      userId: customerId,
      contactName: "Khách hàng thử nghiệm",
      contactPhone: CONTACT_PHONE,
      // Dùng chính hàm của ứng dụng, không tự chuẩn hoá tay — sai định dạng ở đây thì
      // tra cứu công khai sẽ luôn 404 mà không rõ vì sao.
      contactPhoneNormalized: normalizePhone(CONTACT_PHONE)!,
      status: "CONVERTED_TO_SHIPMENT",
      submittedAt: new Date(now.getTime() + hours(s.fromHours - 24)),
    },
    select: { id: true },
  });

  const shipment = await db.shipment.create({
      data: {
        trackingCode: s.code,
        userId: customerId,
        serviceRequestId: request.id,
        vehicleTypeId,
        status: s.status,
        locationSharingEnabled: s.locationSharing,
        scheduledPickupAt: new Date(now.getTime() + hours(s.fromHours)),
        estimatedDeliveryAt: new Date(now.getTime() + hours(s.toHours)),
        totalAmount: 3_500_000,
        instructions: `[DỮ LIỆU THỬ] ${s.label}`,
        stops: {
          create: [
            {
              kind: "PICKUP",
              sequence: 0,
              contactName: "Khách hàng thử nghiệm",
              contactPhone: CONTACT_PHONE,
              line: "12 Nguyễn Huệ",
              ward: "Bến Nghé",
              district: "Quận 1",
              province: "TP. Hồ Chí Minh",
              latitude: SAIGON.lat,
              longitude: SAIGON.lng,
            },
            {
              kind: "DELIVERY",
              sequence: 1,
              contactName: "Trần Thị Bình",
              contactPhone: "0900000010",
              line: "45 Phạm Văn Đồng",
              ward: "Linh Đông",
              district: "TP. Thủ Đức",
              province: "TP. Hồ Chí Minh",
              latitude: SAIGON.lat + 0.08,
              longitude: SAIGON.lng + 0.05,
            },
          ],
        },
        assignments: {
          create: {
            vehicleId: s.vehicleId,
            primaryDriverId: s.driverId,
            effectiveFrom: new Date(now.getTime() + hours(s.fromHours)),
            effectiveTo: new Date(now.getTime() + hours(s.toHours)),
            isActive: true,
          },
        },
        statusEvents: {
          create: {
            toStatus: s.status,
            note: "Dữ liệu thử tạo sẵn",
          },
        },
      },
      select: { trackingCode: true },
    });

  console.log(`  · ${shipment.trackingCode.padEnd(14)} ${s.status.padEnd(16)} ${s.label}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
