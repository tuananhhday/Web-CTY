import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Bất biến của biên bản giao hàng Ở TẦNG DATABASE (§18, §24.9).
 *
 * Unit test chứng minh service làm đúng. Test này chứng minh thứ quan trọng hơn: **kể cả
 * khi tầng ứng dụng có lỗi hoặc bị bỏ qua**, PostgreSQL vẫn từ chối hai biên bản cùng hiệu
 * lực cho một chuyến. Ghi thẳng qua Prisma, cố ý không đi qua service.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

const PREFIX = "ITEST-POD";

let shipmentId: string;
let otherShipmentId: string;

async function cleanup() {
  await db.proofOfDelivery.deleteMany({ where: { shipment: { trackingCode: { startsWith: PREFIX } } } });
  await db.shipment.deleteMany({ where: { trackingCode: { startsWith: PREFIX } } });
}

beforeAll(async () => {
  // Chặn chạy nhầm trên database giống production.
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error("Integration test chỉ chạy trên database local.");
  }

  await cleanup();

  const first = await db.shipment.create({
    data: { trackingCode: `${PREFIX}-1`, status: "DELIVERED_PENDING_CONFIRMATION" },
    select: { id: true },
  });
  const second = await db.shipment.create({
    data: { trackingCode: `${PREFIX}-2`, status: "DELIVERED_PENDING_CONFIRMATION" },
    select: { id: true },
  });

  shipmentId = first.id;
  otherShipmentId = second.id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

beforeEach(async () => {
  await db.proofOfDelivery.deleteMany({
    where: { shipmentId: { in: [shipmentId, otherShipmentId] } },
  });
});

function pod(overrides: Record<string, unknown> = {}) {
  return {
    shipmentId,
    receiverName: "Người nhận",
    outcome: "DELIVERED_FULL" as const,
    finalizedAt: new Date(),
    ...overrides,
  };
}

describe("một chuyến chỉ có một biên bản đang hiệu lực", () => {
  it("tạo biên bản đầu tiên thành công", async () => {
    const created = await db.proofOfDelivery.create({ data: pod(), select: { id: true } });
    expect(created.id).toBeTruthy();
  });

  it("DATABASE từ chối biên bản thứ hai khi bản cũ chưa bị thay thế", async () => {
    await db.proofOfDelivery.create({ data: pod() });

    // Cố ý ghi thẳng, bỏ qua mọi kiểm tra ở tầng service.
    await expect(
      db.proofOfDelivery.create({ data: pod({ receiverName: "Người khác" }) })
    ).rejects.toThrow();
  });

  it("cho phép bản mới sau khi bản cũ được đánh dấu supersededAt", async () => {
    const original = await db.proofOfDelivery.create({ data: pod(), select: { id: true } });

    await db.proofOfDelivery.update({
      where: { id: original.id },
      data: { supersededAt: new Date() },
    });

    const correction = await db.proofOfDelivery.create({
      data: pod({
        receiverName: "Tên đã sửa",
        correctionOfId: original.id,
        correctionReason: "Ghi sai chính tả tên người nhận",
      }),
      select: { id: true, correctionOfId: true },
    });

    expect(correction.correctionOfId).toBe(original.id);

    // Bản gốc vẫn còn nguyên, không bị xoá hay ghi đè.
    const kept = await db.proofOfDelivery.findUnique({
      where: { id: original.id },
      select: { receiverName: true, supersededAt: true },
    });
    expect(kept?.receiverName).toBe("Người nhận");
    expect(kept?.supersededAt).not.toBeNull();
  });

  it("nhiều bản đã bị thay thế cùng tồn tại được", async () => {
    const first = await db.proofOfDelivery.create({
      data: pod({ supersededAt: new Date() }),
      select: { id: true },
    });
    const second = await db.proofOfDelivery.create({
      data: pod({ supersededAt: new Date(), correctionOfId: first.id }),
      select: { id: true },
    });
    await db.proofOfDelivery.create({ data: pod({ correctionOfId: second.id }) });

    const all = await db.proofOfDelivery.findMany({ where: { shipmentId } });
    expect(all).toHaveLength(3);
    expect(all.filter((row) => row.supersededAt === null)).toHaveLength(1);
  });

  it("hai chuyến khác nhau đều có biên bản riêng", async () => {
    await db.proofOfDelivery.create({ data: pod() });
    await db.proofOfDelivery.create({ data: pod({ shipmentId: otherShipmentId }) });

    expect(await db.proofOfDelivery.count({ where: { supersededAt: null } })).toBeGreaterThanOrEqual(
      2
    );
  });

  it("biên bản không tự trỏ về chính nó", async () => {
    const created = await db.proofOfDelivery.create({ data: pod(), select: { id: true } });

    await expect(
      db.proofOfDelivery.update({
        where: { id: created.id },
        data: { correctionOfId: created.id },
      })
    ).rejects.toThrow();
  });

  it("một bản chỉ được sửa bởi đúng một bản kế tiếp", async () => {
    const original = await db.proofOfDelivery.create({
      data: pod({ supersededAt: new Date() }),
      select: { id: true },
    });

    await db.proofOfDelivery.create({
      data: pod({ supersededAt: new Date(), correctionOfId: original.id }),
    });

    // correctionOfId là unique: không thể có hai bản cùng khai sửa một bản gốc.
    await expect(
      db.proofOfDelivery.create({ data: pod({ correctionOfId: original.id }) })
    ).rejects.toThrow();
  });
});
