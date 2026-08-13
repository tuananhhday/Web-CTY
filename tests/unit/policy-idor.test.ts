import { describe, it, expect } from "vitest";
import { createActor, GUEST, type Actor } from "@/modules/auth/actor";
import {
  can,
  requireAuth,
  requirePermission,
  requireFreshAuth,
  canReadOwned,
  requireReadOwned,
  canWriteOwned,
  isAssignedDriver,
  canAccessShipment,
  requireShipmentUpdateAccess,
  type AssignmentWindow,
} from "@/modules/auth/policy";
import type { StoredRole } from "@/modules/auth/permissions";
import { AppError } from "@/lib/errors";

const NOW = new Date("2026-09-01T10:00:00Z");

function actorWith(roles: StoredRole[], overrides: Partial<Parameters<typeof createActor>[0]> = {}) {
  return createActor({
    userId: "user-a",
    email: "a@local.test",
    name: "Người dùng A",
    roles,
    sessionId: "session-1",
    authenticatedAt: NOW,
    ...overrides,
  });
}

const customerA = actorWith(["CUSTOMER"]);
const customerB = actorWith(["CUSTOMER"], { userId: "user-b", email: "b@local.test" });
const driverA = actorWith(["DRIVER"], { userId: "user-d1", driverProfileId: "driver-1" });
const driverB = actorWith(["DRIVER"], { userId: "user-d2", driverProfileId: "driver-2" });
const dispatcher = actorWith(["DISPATCHER"], { userId: "user-disp" });
const editor = actorWith(["EDITOR"], { userId: "user-ed" });
const accountant = actorWith(["ACCOUNTANT"], { userId: "user-acc" });

function expectAppError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Mong đợi ném AppError ${code} nhưng không có lỗi nào`);
}

// -----------------------------------------------------------------------------
// Deny by default
// -----------------------------------------------------------------------------

describe("deny by default", () => {
  it("khách chưa đăng nhập không có quyền nào", () => {
    expect(GUEST.permissions.size).toBe(0);
    expect(can(GUEST, "shipment.read_all")).toBe(false);
    expect(can(GUEST, "cms.read")).toBe(false);
  });

  it("requireAuth chặn khách chưa đăng nhập", () => {
    expectAppError(() => requireAuth(GUEST), "UNAUTHENTICATED");
  });

  it("requirePermission trả UNAUTHENTICATED trước khi xét quyền", () => {
    expectAppError(() => requirePermission(GUEST, "cms.read"), "UNAUTHENTICATED");
  });
});

// -----------------------------------------------------------------------------
// IDOR: khách hàng A không chạm được dữ liệu khách hàng B
// -----------------------------------------------------------------------------

describe("IDOR — CUSTOMER A và CUSTOMER B", () => {
  it("A đọc được dữ liệu của chính A", () => {
    expect(canReadOwned(customerA, "user-a", "request.read_all")).toBe(true);
  });

  it("A KHÔNG đọc được dữ liệu của B", () => {
    expect(canReadOwned(customerA, "user-b", "request.read_all")).toBe(false);
  });

  it("B KHÔNG đọc được dữ liệu của A", () => {
    expect(canReadOwned(customerB, "user-a", "request.read_all")).toBe(false);
  });

  it("A KHÔNG sửa được dữ liệu của B", () => {
    expect(canWriteOwned(customerA, "user-b", "request.manage")).toBe(false);
  });

  it("truy cập chéo trả NOT_FOUND, không phải FORBIDDEN — không lộ sự tồn tại bản ghi", () => {
    expectAppError(() => requireReadOwned(customerA, "user-b", "request.read_all"), "NOT_FOUND");
  });

  it("bản ghi không có chủ chỉ nhân viên có quyền *_all mới đọc được", () => {
    expect(canReadOwned(customerA, null, "request.read_all")).toBe(false);
    expect(canReadOwned(dispatcher, null, "request.read_all")).toBe(true);
  });

  it("nhân viên có request.read_all đọc được dữ liệu của mọi khách", () => {
    expect(canReadOwned(dispatcher, "user-a", "request.read_all")).toBe(true);
    expect(canReadOwned(dispatcher, "user-b", "request.read_all")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// IDOR: tài xế
// -----------------------------------------------------------------------------

describe("IDOR — DRIVER A và DRIVER B", () => {
  const activeAssignmentForDriver1: AssignmentWindow = {
    primaryDriverId: "driver-1",
    secondaryDriverId: null,
    isActive: true,
    effectiveFrom: new Date("2026-09-01T08:00:00Z"),
    effectiveTo: new Date("2026-09-01T18:00:00Z"),
  };

  const shipmentOfCustomerA = {
    userId: "user-a",
    assignments: [activeAssignmentForDriver1],
  };

  it("tài xế được phân công truy cập được chuyến", () => {
    expect(canAccessShipment(driverA, shipmentOfCustomerA)).toBe(true);
  });

  it("tài xế KHÁC không truy cập được chuyến đó", () => {
    expect(canAccessShipment(driverB, shipmentOfCustomerA)).toBe(false);
  });

  it("tài xế phụ cũng truy cập được", () => {
    const withSecondary = {
      userId: "user-a",
      assignments: [{ ...activeAssignmentForDriver1, primaryDriverId: null, secondaryDriverId: "driver-2" }],
    };
    expect(canAccessShipment(driverB, withSecondary)).toBe(true);
  });

  it("tài khoản DRIVER chưa có hồ sơ tài xế không truy cập được gì", () => {
    const driverWithoutProfile = actorWith(["DRIVER"], { userId: "user-d3" });
    expect(canAccessShipment(driverWithoutProfile, shipmentOfCustomerA)).toBe(false);
  });

  it("khách hàng sở hữu đơn vẫn xem được chuyến của mình", () => {
    expect(canAccessShipment(customerA, shipmentOfCustomerA)).toBe(true);
  });

  it("khách hàng khác KHÔNG xem được", () => {
    expect(canAccessShipment(customerB, shipmentOfCustomerA)).toBe(false);
  });
});

describe("assignment hết hiệu lực", () => {
  const expiredAssignment: AssignmentWindow = {
    primaryDriverId: "driver-1",
    secondaryDriverId: null,
    isActive: true,
    effectiveFrom: new Date("2026-08-01T08:00:00Z"),
    effectiveTo: new Date("2026-08-01T18:00:00Z"),
  };

  const releasedAssignment: AssignmentWindow = {
    primaryDriverId: "driver-1",
    secondaryDriverId: null,
    isActive: false,
    effectiveFrom: new Date("2026-09-01T08:00:00Z"),
    effectiveTo: new Date("2026-09-01T18:00:00Z"),
  };

  it("tài xế cũ KHÔNG cập nhật được chuyến sau khi assignment hết hạn", () => {
    expect(
      isAssignedDriver(driverA, [expiredAssignment], { requireCurrentlyActive: true, now: NOW })
    ).toBe(false);
  });

  it("tài xế bị gỡ khỏi chuyến KHÔNG cập nhật được nữa", () => {
    expect(
      isAssignedDriver(driverA, [releasedAssignment], { requireCurrentlyActive: true, now: NOW })
    ).toBe(false);
  });

  it("nhưng vẫn xem lại được chuyến từng làm khi không yêu cầu đang hoạt động", () => {
    expect(isAssignedDriver(driverA, [expiredAssignment])).toBe(true);
  });

  /*
   * Quyền CẬP NHẬT chuyến không phụ thuộc khung giờ.
   *
   * Lỗi thật đã gặp: chuyến còn `IN_TRANSIT` nhưng khung giờ phân công hết 7 tiếng trước,
   * tài xế bị chặn khỏi việc báo xe hỏng. Khung giờ là công cụ lập lịch chống trùng
   * (§14.3), không phải ranh giới phân quyền — chuyến chạy trễ là chuyện thường ngày.
   *
   * Thu hồi quyền là hành động rõ ràng: gỡ phân công, hoặc chuyến đi tới trạng thái kết thúc.
   */
  it("tài xế VẪN cập nhật được khi chuyến chạy trễ quá khung giờ dự kiến", () => {
    expect(() =>
      requireShipmentUpdateAccess(driverA, {
        assignments: [expiredAssignment],
        status: "IN_TRANSIT",
      })
    ).not.toThrow();
  });

  it("tài xế bị GỠ khỏi chuyến thì không cập nhật được nữa", () => {
    expectAppError(
      () =>
        requireShipmentUpdateAccess(driverA, {
          assignments: [releasedAssignment],
          status: "IN_TRANSIT",
        }),
      "FORBIDDEN"
    );
  });

  it.each(["COMPLETED", "CANCELLED", "FAILED"])(
    "chuyến đã %s thì tài xế không cập nhật được nữa",
    (status) => {
      expectAppError(
        () => requireShipmentUpdateAccess(driverA, { assignments: [expiredAssignment], status }),
        "RESOURCE_LOCKED"
      );
    }
  );

  it("tài xế của chuyến khác vẫn bị chặn", () => {
    expectAppError(
      () =>
        requireShipmentUpdateAccess(driverB, {
          assignments: [expiredAssignment],
          status: "IN_TRANSIT",
        }),
      "FORBIDDEN"
    );
  });

  it("cho phép tài xế có assignment còn hiệu lực", () => {
    const active: AssignmentWindow = {
      primaryDriverId: "driver-1",
      secondaryDriverId: null,
      isActive: true,
      effectiveFrom: new Date("2026-09-01T08:00:00Z"),
      effectiveTo: new Date("2026-09-01T18:00:00Z"),
    };
    expect(() =>
      requireShipmentUpdateAccess(driverA, { assignments: [active], status: "IN_TRANSIT" })
    ).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
// Leo thang quyền theo vai trò
// -----------------------------------------------------------------------------

describe("chống leo thang quyền giữa các vai trò nhân viên", () => {
  it("EDITOR không vào được điều phối", () => {
    expect(can(editor, "shipment.dispatch")).toBe(false);
    expectAppError(() => requirePermission(editor, "shipment.dispatch"), "FORBIDDEN");
  });

  it("ACCOUNTANT không sửa được trạng thái shipment", () => {
    expect(can(accountant, "shipment.update")).toBe(false);
    expectAppError(() => requirePermission(accountant, "shipment.update"), "FORBIDDEN");
  });

  it("DISPATCHER không cấp được quyền tài khoản", () => {
    expectAppError(() => requirePermission(dispatcher, "user.manage"), "FORBIDDEN");
  });

  it("DRIVER không đọc được bảng giá", () => {
    expectAppError(() => requirePermission(driverA, "pricing.read"), "FORBIDDEN");
  });

  it("CUSTOMER không chạm được bất kỳ endpoint quản trị nào", () => {
    const adminPermissions = ["user.manage", "audit.read", "settings.manage", "cms.write"] as const;
    for (const permission of adminPermissions) {
      expectAppError(() => requirePermission(customerA, permission), "FORBIDDEN");
    }
  });
});

// -----------------------------------------------------------------------------
// Re-auth và MFA cho thao tác nhạy cảm
// -----------------------------------------------------------------------------

describe("requireFreshAuth", () => {
  const admin = actorWith(["ADMIN"], { userId: "user-admin", mfaVerified: true });

  it("cho qua khi phiên vừa xác thực và đã bật MFA", () => {
    const justNow = new Date(NOW.getTime() + 60_000);
    expect(() => requireFreshAuth(admin, "user.manage", justNow)).not.toThrow();
  });

  it("yêu cầu xác thực lại khi phiên đã quá 15 phút", () => {
    const later = new Date(NOW.getTime() + 20 * 60_000);
    expectAppError(() => requireFreshAuth(admin, "user.manage", later), "REAUTH_REQUIRED");
  });

  it("yêu cầu MFA với tài khoản quyền cao chưa bật MFA", () => {
    const adminNoMfa = actorWith(["ADMIN"], { userId: "user-admin2", mfaVerified: false });
    const justNow = new Date(NOW.getTime() + 60_000);
    expectAppError(() => requireFreshAuth(adminNoMfa, "user.manage", justNow), "MFA_REQUIRED");
  });

  it("thao tác thường không bị ràng buộc re-auth", () => {
    const muchLater = new Date(NOW.getTime() + 5 * 60 * 60_000);
    expect(() => requireFreshAuth(dispatcher, "shipment.dispatch", muchLater)).not.toThrow();
  });

  it("vẫn chặn khi thiếu quyền, bất kể phiên mới hay cũ", () => {
    expectAppError(() => requireFreshAuth(editor, "user.manage", NOW), "FORBIDDEN");
  });
});

// -----------------------------------------------------------------------------
// Guest
// -----------------------------------------------------------------------------

describe("khách chưa đăng nhập", () => {
  const anyActor: Actor = GUEST;

  it("không đọc được tài nguyên có chủ", () => {
    expect(canReadOwned(anyActor, "user-a", "request.read_all")).toBe(false);
  });

  it("không truy cập được chuyến hàng nào", () => {
    expect(
      canAccessShipment(anyActor, { userId: "user-a", assignments: [] })
    ).toBe(false);
  });

  it("không được coi là tài xế được phân công", () => {
    expect(
      isAssignedDriver(anyActor, [
        {
          primaryDriverId: "driver-1",
          secondaryDriverId: null,
          isActive: true,
          effectiveFrom: new Date("2026-09-01T08:00:00Z"),
          effectiveTo: new Date("2026-09-01T18:00:00Z"),
        },
      ])
    ).toBe(false);
  });
});
