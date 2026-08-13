import "server-only";
import { db, type Prisma } from "@/lib/db";
import type { ListRequestsQuery } from "@/modules/service-requests/schema";

/**
 * Truy cập dữ liệu yêu cầu dịch vụ.
 *
 * NGUYÊN TẮC BẢO MẬT (§30.2): các hàm dành cho khách hàng LUÔN nhận `userId` và đưa vào
 * mệnh đề `where` — lọc ngay trong truy vấn, không lấy hết rồi mới so sánh. Nhờ vậy quên
 * kiểm tra ở tầng trên cũng không rò dữ liệu người khác.
 */

/** Trường an toàn để hiển thị trong danh sách. Không kèm ghi chú nội bộ. */
const LIST_SELECT = {
  id: true,
  code: true,
  kind: true,
  status: true,
  contactName: true,
  createdAt: true,
  submittedAt: true,
  updatedAt: true,
  service: { select: { name: true, slug: true } },
  stops: {
    select: { kind: true, province: true, district: true },
    orderBy: { sequence: "asc" },
  },
  _count: { select: { cargoItems: true, quotes: true } },
} satisfies Prisma.ServiceRequestSelect;

const DETAIL_INCLUDE = {
  service: { select: { name: true, slug: true } },
  requestedVehicleType: { select: { name: true, slug: true } },
  stops: { orderBy: { sequence: "asc" } },
  cargoItems: true,
  movingDetail: { include: { inventoryItems: { orderBy: { category: "asc" } } } },
  attachments: {
    where: { status: "READY" },
    select: { id: true, objectKey: true, kind: true, caption: true, uploadedAt: true },
  },
  statusEvents: { orderBy: { occurredAt: "asc" } },
} satisfies Prisma.ServiceRequestInclude;

export type ServiceRequestDetail = Prisma.ServiceRequestGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

// -----------------------------------------------------------------------------
// Đọc — phía khách hàng
// -----------------------------------------------------------------------------

export async function listRequestsForUser(userId: string, query: ListRequestsQuery) {
  const where: Prisma.ServiceRequestWhereInput = {
    // Điều kiện chủ sở hữu nằm NGAY trong truy vấn.
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };

  const [items, total] = await Promise.all([
    db.serviceRequest.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.serviceRequest.count({ where }),
  ]);

  return { items, total };
}

export async function findRequestForUser(code: string, userId: string) {
  return db.serviceRequest.findFirst({
    where: { code, userId },
    include: DETAIL_INCLUDE,
  });
}

/**
 * Tra cứu bằng token dành cho khách chưa đăng nhập (§11).
 * Token lưu dạng hash; hàm này nhận hash đã tính sẵn, không nhận token thô.
 */
export async function findRequestByGuestToken(code: string, tokenHash: string) {
  return db.serviceRequest.findFirst({
    where: {
      code,
      guestAccessTokenHash: tokenHash,
      guestTokenExpiresAt: { gt: new Date() },
    },
    include: DETAIL_INCLUDE,
  });
}

// -----------------------------------------------------------------------------
// Đọc — phía nhân viên
// -----------------------------------------------------------------------------

export async function listAllRequests(query: ListRequestsQuery) {
  const where: Prisma.ServiceRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: "insensitive" } },
            { contactName: { contains: query.search, mode: "insensitive" } },
            { contactPhoneNormalized: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.serviceRequest.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.serviceRequest.count({ where }),
  ]);

  return { items, total };
}

/** Chỉ dùng cho nhân viên có quyền `request.read_all` — không lọc theo chủ sở hữu. */
export async function findRequestByCode(code: string) {
  return db.serviceRequest.findUnique({
    where: { code },
    include: DETAIL_INCLUDE,
  });
}

/**
 * Nạp dữ liệu tối thiểu để kiểm tra quyền trước khi đọc bản ghi đầy đủ.
 * Tránh kéo cả yêu cầu về rồi mới phát hiện không có quyền.
 */
export async function findRequestOwnership(code: string) {
  return db.serviceRequest.findUnique({
    where: { code },
    select: { id: true, code: true, userId: true, status: true },
  });
}

/** Đếm theo trạng thái cho widget tổng quan. */
export async function countRequestsByStatus() {
  const rows = await db.serviceRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
