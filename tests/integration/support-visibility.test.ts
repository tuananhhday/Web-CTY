import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Ghi chú nội bộ KHÔNG được rời khỏi database khi người đọc là khách (§19).
 *
 * Unit test chứng minh state machine đúng. Test này chứng minh thứ quan trọng hơn: điều kiện
 * lọc nằm trong TRUY VẤN, nên dù giao diện có lỗi thì dữ liệu cũng không có ở đó để rò rỉ.
 *
 * Test ghi thẳng qua Prisma rồi đọc bằng đúng hai dạng truy vấn mà service dùng.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

const PREFIX = "ITEST-SUPPORT";
const SECRET = "GHI CHU NOI BO KHONG DUOC LO RA NGOAI";

let userId: string;
let ticketId: string;
let ticketCode: string;

async function cleanup() {
  await db.ticketMessage.deleteMany({ where: { ticket: { code: { startsWith: PREFIX } } } });
  await db.supportTicket.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX.toLowerCase() } } });
}

beforeAll(async () => {
  await cleanup();

  const user = await db.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}-khach@local.test`,
      name: "Khách kiểm thử",
      emailVerified: true,
    },
    select: { id: true },
  });
  userId = user.id;

  ticketCode = `${PREFIX}-001`;
  const ticket = await db.supportTicket.create({
    data: {
      code: ticketCode,
      userId,
      type: "COMPLAINT",
      priority: "HIGH",
      status: "WAITING_FOR_STAFF",
      subject: "Hàng bị móp khi giao",
      messages: {
        create: [
          {
            authorId: userId,
            visibility: "CUSTOMER_VISIBLE",
            body: "Thùng hàng bị móp một góc.",
          },
          {
            visibility: "INTERNAL",
            body: SECRET,
          },
          {
            visibility: "CUSTOMER_VISIBLE",
            body: "Chúng tôi đang kiểm tra và sẽ phản hồi trong hôm nay.",
          },
        ],
      },
    },
    select: { id: true },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

/** Đúng truy vấn mà `getTicket` dùng cho từng vai. */
function readAs(party: "STAFF" | "CUSTOMER") {
  return db.supportTicket.findUnique({
    where: { code: ticketCode },
    select: {
      messages: {
        where: party === "STAFF" ? {} : { visibility: "CUSTOMER_VISIBLE" },
        orderBy: { createdAt: "asc" },
        select: { body: true, visibility: true },
      },
    },
  });
}

describe("ranh giới nội bộ / khách hàng", () => {
  it("nhân viên đọc được cả ba tin nhắn", async () => {
    const result = await readAs("STAFF");
    expect(result?.messages).toHaveLength(3);
  });

  it("khách chỉ đọc được hai tin nhắn công khai", async () => {
    const result = await readAs("CUSTOMER");
    expect(result?.messages).toHaveLength(2);
  });

  it("nội dung ghi chú nội bộ KHÔNG có trong dữ liệu trả về cho khách", async () => {
    const result = await readAs("CUSTOMER");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("INTERNAL");
  });

  it("ghi chú nội bộ vẫn nằm trong database — bị lọc khi đọc, không bị xoá", async () => {
    const internal = await db.ticketMessage.count({
      where: { ticketId, visibility: "INTERNAL" },
    });
    expect(internal).toBe(1);
  });

  it("thêm ghi chú nội bộ mới cũng không lọt sang phía khách", async () => {
    await db.ticketMessage.create({
      data: { ticketId, visibility: "INTERNAL", body: "Khách này đã khiếu nại 3 lần" },
    });

    const result = await readAs("CUSTOMER");
    expect(JSON.stringify(result)).not.toContain("khiếu nại 3 lần");
    expect(result?.messages).toHaveLength(2);
  });

  it("mặc định của cột visibility là CUSTOMER_VISIBLE, không phải INTERNAL", async () => {
    // Mặc định sai chiều nghĩa là quên khai báo sẽ khiến tin nhắn của khách biến mất khỏi
    // chính màn hình của họ — im lặng và khó phát hiện.
    const created = await db.ticketMessage.create({
      data: { ticketId, body: "Tin nhắn không khai báo visibility" },
      select: { visibility: true },
    });

    expect(created.visibility).toBe("CUSTOMER_VISIBLE");
  });
});
