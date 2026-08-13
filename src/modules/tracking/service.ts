import "server-only";
import { db } from "@/lib/db";
import { appError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Actor } from "@/modules/auth/actor";
import { isAuthenticated } from "@/modules/auth/actor";
import { requireShipmentAccess } from "@/modules/auth/policy";
import { toPublicView, matchesPhoneSuffix, type PublicTrackingView } from "@/modules/tracking/masking";
import type { TrackingLookupInput } from "@/modules/tracking/schema";

/**
 * Tra cứu đơn hàng (§16.1).
 *
 * Hai mức tách bạch bằng hai hàm khác nhau, không phải bằng một cờ boolean: tra cứu công
 * khai chỉ chọn đúng những cột được phép hiện ngay trong truy vấn, nên dữ liệu nhạy cảm
 * không bao giờ rời khỏi database. Cờ boolean dễ bị truyền sai; hai hàm thì không.
 */

/** Đơn ở trạng thái này chưa được công bố ra ngoài. */
const NOT_PUBLIC_YET = ["CREATED"];

/**
 * Tra cứu công khai bằng mã vận đơn + 4 số cuối điện thoại.
 *
 * Trả về `null` cho MỌI trường hợp thất bại — sai mã, sai số điện thoại, đơn chưa công bố
 * đều cho cùng một kết quả. Phân biệt được các trường hợp này nghĩa là kẻ dò mã biết mã
 * nào có thật, chỉ còn thiếu số điện thoại (§16.1, §30.2).
 */
export async function lookupPublic(input: TrackingLookupInput): Promise<PublicTrackingView | null> {
  const shipment = await db.shipment.findUnique({
    where: { trackingCode: input.trackingCode },
    select: {
      trackingCode: true,
      status: true,
      estimatedDeliveryAt: true,
      updatedAt: true,
      stops: {
        select: { kind: true, province: true },
        orderBy: { sequence: "asc" },
      },
      statusEvents: {
        select: { toStatus: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      },
      // Chỉ để đối chiếu 4 số cuối, không bao giờ trả ra ngoài.
      serviceRequest: { select: { contactPhoneNormalized: true } },
    },
  });

  if (!shipment) return null;
  if (NOT_PUBLIC_YET.includes(shipment.status)) return null;

  const phone = shipment.serviceRequest?.contactPhoneNormalized ?? null;
  if (!matchesPhoneSuffix(phone, input.phoneSuffix)) {
    logger.info({ trackingCode: input.trackingCode }, "Tra cứu công khai sai số xác minh");
    return null;
  }

  return toPublicView(shipment);
}

// -----------------------------------------------------------------------------
// Tra cứu đầy đủ cho khách đã đăng nhập
// -----------------------------------------------------------------------------

const CUSTOMER_DETAIL_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  userId: true,
  scheduledPickupAt: true,
  actualPickupAt: true,
  estimatedDeliveryAt: true,
  deliveredAt: true,
  completedAt: true,
  totalAmount: true,
  currency: true,
  locationSharingEnabled: true,
  instructions: true,
  createdAt: true,
  updatedAt: true,
  vehicleType: { select: { name: true } },
  stops: {
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      kind: true,
      sequence: true,
      line: true,
      ward: true,
      district: true,
      province: true,
      contactName: true,
      contactPhone: true,
      accessNote: true,
    },
  },
  statusEvents: {
    orderBy: { occurredAt: "desc" },
    select: { id: true, fromStatus: true, toStatus: true, occurredAt: true, note: true },
  },
  quote: { select: { code: true } },
  serviceRequest: { select: { code: true } },
  assignments: {
    where: { isActive: true },
    select: {
      id: true,
      isActive: true,
      effectiveFrom: true,
      effectiveTo: true,
      primaryDriverId: true,
      secondaryDriverId: true,
      vehicle: { select: { plateNumber: true, vehicleType: { select: { name: true } } } },
      primaryDriver: { select: { fullName: true, workPhoneNormalized: true } },
    },
  },
} as const;

/**
 * Thông tin tài xế chỉ hiện trong CỬA SỔ THỜI GIAN chuyến hoạt động (§16.1).
 *
 * Ngoài khoảng đó, khách không cần biết ai đang lái xe của họ — và tài xế không nên bị
 * gọi điện vào lúc đã bàn giao xong.
 */
function driverVisibleNow(
  assignment: { effectiveFrom: Date; effectiveTo: Date } | undefined,
  now: Date
): boolean {
  if (!assignment) return false;
  return assignment.effectiveFrom <= now && now < assignment.effectiveTo;
}

export async function listMyShipments(actor: Actor) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  return db.shipment.findMany({
    where: { userId: actor.userId },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      scheduledPickupAt: true,
      estimatedDeliveryAt: true,
      deliveredAt: true,
      createdAt: true,
      totalAmount: true,
      vehicleType: { select: { name: true } },
      stops: {
        select: { kind: true, district: true, province: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/**
 * Chi tiết một đơn của chính khách hàng.
 *
 * Truy vấn lọc theo `userId` ngay trong `where` chứ không lọc sau khi lấy về (§30.2), và
 * vẫn gọi `requireShipmentAccess` để nhân viên hỗ trợ có quyền đọc cũng dùng được hàm này.
 */
export async function getMyShipment(actor: Actor, trackingCode: string, now: Date = new Date()) {
  if (!isAuthenticated(actor)) throw appError("UNAUTHENTICATED");

  const shipment = await db.shipment.findUnique({
    where: { trackingCode },
    select: CUSTOMER_DETAIL_SELECT,
  });

  if (!shipment) throw appError("NOT_FOUND");

  requireShipmentAccess(actor, {
    userId: shipment.userId,
    assignments: shipment.assignments.map((a) => ({
      primaryDriverId: a.primaryDriverId,
      secondaryDriverId: a.secondaryDriverId,
      isActive: a.isActive,
      effectiveFrom: a.effectiveFrom,
      effectiveTo: a.effectiveTo,
    })),
  });

  const assignment = shipment.assignments[0];
  const showDriver = driverVisibleNow(assignment, now);

  return {
    ...shipment,
    // Gỡ hẳn khỏi object trả về thay vì để giao diện tự nhớ ẩn đi.
    assignments: undefined,
    vehicle: assignment?.vehicle ?? null,
    driver: showDriver
      ? {
          fullName: assignment.primaryDriver?.fullName ?? null,
          phone: assignment.primaryDriver?.workPhoneNormalized ?? null,
        }
      : null,
    driverHiddenReason: assignment && !showDriver ? ("outside_window" as const) : null,
  };
}
