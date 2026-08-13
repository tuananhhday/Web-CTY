import "server-only";
import { db, type Prisma } from "@/lib/db";
import type { ListQuotesQuery } from "@/modules/quotes/schema";

/**
 * Truy cập dữ liệu báo giá.
 *
 * Hàm dành cho khách hàng luôn nhận `userId` và đưa vào `where` — lọc ngay trong truy vấn
 * chứ không lấy hết rồi so sánh sau (§30.2).
 */

const LIST_SELECT = {
  id: true,
  code: true,
  status: true,
  sentAt: true,
  viewedAt: true,
  acceptedAt: true,
  expiresAt: true,
  createdAt: true,
  serviceRequest: {
    select: { code: true, kind: true, contactName: true, userId: true },
  },
  currentRevision: {
    select: { revisionNumber: true, totalAmount: true, currency: true },
  },
  _count: { select: { revisions: true } },
} satisfies Prisma.QuoteSelect;

const DETAIL_INCLUDE = {
  serviceRequest: {
    select: {
      code: true,
      kind: true,
      contactName: true,
      contactPhoneNormalized: true,
      contactEmail: true,
      userId: true,
      status: true,
    },
  },
  preparedBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  revisions: {
    orderBy: { revisionNumber: "desc" },
    include: { lineItems: { orderBy: { sequence: "asc" } } },
  },
  activities: { orderBy: { occurredAt: "desc" } },
} satisfies Prisma.QuoteInclude;

export type QuoteDetail = Prisma.QuoteGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// -----------------------------------------------------------------------------
// Khách hàng
// -----------------------------------------------------------------------------

/**
 * Báo giá của một khách. Loại bỏ trạng thái khách không được thấy (§13.3) — bản nháp và
 * bản chờ duyệt là việc nội bộ.
 */
export async function listQuotesForUser(userId: string, query: ListQuotesQuery) {
  const where: Prisma.QuoteWhereInput = {
    serviceRequest: { userId },
    status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] },
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    db.quote.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.quote.count({ where }),
  ]);

  return { items, total };
}

export async function findQuoteForUser(code: string, userId: string) {
  return db.quote.findFirst({
    where: {
      code,
      serviceRequest: { userId },
      status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] },
    },
    include: DETAIL_INCLUDE,
  });
}

// -----------------------------------------------------------------------------
// Nhân viên
// -----------------------------------------------------------------------------

export async function listAllQuotes(query: ListQuotesQuery) {
  const where: Prisma.QuoteWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: "insensitive" } },
            { serviceRequest: { code: { contains: query.search, mode: "insensitive" } } },
            {
              serviceRequest: {
                contactName: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.quote.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.quote.count({ where }),
  ]);

  return { items, total };
}

export async function findQuoteByCode(code: string) {
  return db.quote.findUnique({ where: { code }, include: DETAIL_INCLUDE });
}

/** Dữ liệu tối thiểu để kiểm tra quyền trước khi nạp bản ghi đầy đủ. */
export async function findQuoteOwnership(code: string) {
  return db.quote.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      status: true,
      currentRevisionId: true,
      acceptedRevisionId: true,
      expiresAt: true,
      serviceRequest: { select: { id: true, code: true, userId: true, status: true } },
      currentRevision: {
        select: {
          id: true,
          revisionNumber: true,
          subtotal: true,
          discountAmount: true,
          totalAmount: true,
        },
      },
    },
  });
}

/** Số hiệu revision kế tiếp. Bắt đầu từ 1. */
export async function nextRevisionNumber(quoteId: string): Promise<number> {
  const latest = await db.quoteRevision.findFirst({
    where: { quoteId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return (latest?.revisionNumber ?? 0) + 1;
}

export async function countQuotesByStatus() {
  const rows = await db.quote.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

/** Tin nhắn thương lượng. Khách chỉ thấy tin CUSTOMER_VISIBLE (§19). */
export async function listQuoteMessages(quoteId: string, includeInternal: boolean) {
  return db.quoteMessage.findMany({
    where: {
      quoteId,
      ...(includeInternal ? {} : { visibility: "CUSTOMER_VISIBLE" }),
    },
    orderBy: { createdAt: "asc" },
  });
}
