import { describe, it, expect } from "vitest";
import {
  SHIPMENT_STATUSES,
  canTransition,
  assertTransition,
  isTerminal,
  isActiveOnRoad,
  hasReachedPickup,
  isPaused,
  allowedTransitions,
  shipmentActorOf,
  nextDriverStep,
  customerMilestoneOf,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  SHIPMENT_FAILURE_REASONS,
  REASON_CODE_REQUIRED_STATUSES,
  checkStatusPreconditions,
  type ShipmentStatus,
} from "@/modules/shipments/state-machine";
import { createActor, GUEST } from "@/modules/auth/actor";
import { AppError } from "@/lib/errors";

const TERMINAL: ShipmentStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

function actor(roles: Parameters<typeof createActor>[0]["roles"]) {
  return createActor({
    userId: "u1",
    email: "a@local.test",
    name: "Người dùng",
    roles,
    sessionId: "s1",
    authenticatedAt: new Date(),
  });
}

describe("cấu trúc state machine đơn hàng", () => {
  it("có đủ 19 trạng thái theo §15", () => {
    expect(SHIPMENT_STATUSES).toHaveLength(19);
  });

  it("mọi trạng thái đều có nhãn tiếng Việt và tông màu", () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(SHIPMENT_STATUS_LABELS[status], `thiếu nhãn cho ${status}`).toBeTruthy();
      expect(SHIPMENT_STATUS_TONE[status], `thiếu tông màu cho ${status}`).toBeTruthy();
    }
  });

  it("mọi đích đến trong bảng chuyển đều hợp lệ", () => {
    for (const status of SHIPMENT_STATUSES) {
      for (const transition of allowedTransitions(status)) {
        expect(SHIPMENT_STATUSES).toContain(transition.to);
      }
    }
  });

  it("không trạng thái nào chuyển về chính nó", () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(allowedTransitions(status).map((t) => t.to)).not.toContain(status);
    }
  });

  it("mọi trạng thái không kết thúc đều tới được trạng thái kết thúc", () => {
    for (const status of SHIPMENT_STATUSES) {
      if (isTerminal(status)) continue;

      const visited = new Set<ShipmentStatus>();
      const queue: ShipmentStatus[] = [status];
      let reaches = false;

      while (queue.length > 0) {
        const current = queue.shift() as ShipmentStatus;
        if (visited.has(current)) continue;
        visited.add(current);
        if (isTerminal(current)) {
          reaches = true;
          break;
        }
        queue.push(...allowedTransitions(current).map((t) => t.to));
      }

      expect(reaches, `${status} không tới được trạng thái kết thúc`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------------
// Bốn ràng buộc cứng của §15
// -----------------------------------------------------------------------------

describe("§15 — không IN_TRANSIT trước khi tới điểm lấy hàng", () => {
  const BEFORE_PICKUP: ShipmentStatus[] = [
    "CREATED",
    "CONFIRMED",
    "SCHEDULED",
    "DRIVER_ASSIGNED",
    "EN_ROUTE_TO_PICKUP",
  ];

  it.each(BEFORE_PICKUP)("%s KHÔNG chuyển thẳng sang IN_TRANSIT", (status) => {
    expect(canTransition(status, "IN_TRANSIT", "DRIVER").allowed).toBe(false);
    expect(canTransition(status, "IN_TRANSIT", "DISPATCHER").allowed).toBe(false);
  });

  it("chỉ IN_TRANSIT được sau khi đã xếp hàng xong", () => {
    expect(canTransition("LOADING", "IN_TRANSIT", "DRIVER").allowed).toBe(true);
    expect(canTransition("SECURED_ON_VEHICLE", "IN_TRANSIT", "DRIVER").allowed).toBe(true);
  });

  it("hasReachedPickup nhận diện đúng các mốc đã tới điểm lấy", () => {
    expect(hasReachedPickup("EN_ROUTE_TO_PICKUP")).toBe(false);
    expect(hasReachedPickup("AT_PICKUP")).toBe(true);
    expect(hasReachedPickup("LOADING")).toBe(true);
    expect(hasReachedPickup("IN_TRANSIT")).toBe(true);
    expect(hasReachedPickup("COMPLETED")).toBe(true);
  });
});

describe("§15 — không COMPLETED trước khi giao hàng", () => {
  it("chỉ tới COMPLETED từ DELIVERED_PENDING_CONFIRMATION", () => {
    for (const status of SHIPMENT_STATUSES) {
      if (status === "DELIVERED_PENDING_CONFIRMATION") continue;
      expect(
        canTransition(status, "COMPLETED", "DISPATCHER").allowed,
        `${status} không được hoàn tất thẳng`
      ).toBe(false);
    }

    expect(canTransition("DELIVERED_PENDING_CONFIRMATION", "COMPLETED", "DRIVER").allowed).toBe(
      true
    );
  });

  it("không nhảy từ IN_TRANSIT thẳng sang COMPLETED", () => {
    expect(canTransition("IN_TRANSIT", "COMPLETED", "DISPATCHER").allowed).toBe(false);
  });
});

describe("§15 — tài xế không tự quay ngược trạng thái", () => {
  it("tài xế không đưa đơn từ IN_TRANSIT về AT_PICKUP", () => {
    expect(canTransition("IN_TRANSIT", "AT_PICKUP", "DRIVER").allowed).toBe(false);
  });

  it("tài xế không đưa đơn từ AT_DELIVERY về IN_TRANSIT", () => {
    expect(canTransition("AT_DELIVERY", "IN_TRANSIT", "DRIVER").allowed).toBe(false);
  });

  it("tài xế không tự hủy đơn", () => {
    expect(canTransition("IN_TRANSIT", "CANCELLED", "DRIVER").allowed).toBe(false);
    expect(canTransition("DRIVER_ASSIGNED", "CANCELLED", "DRIVER").allowed).toBe(false);
  });

  it("tài xế không tự đánh dấu đơn thất bại", () => {
    expect(canTransition("AT_DELIVERY", "FAILED", "DRIVER").allowed).toBe(false);
  });

  it("nhưng tài xế BÁO ĐƯỢC sự cố, kèm lý do", () => {
    expect(canTransition("IN_TRANSIT", "INCIDENT", "DRIVER").allowed).toBe(false);
    expect(
      canTransition("IN_TRANSIT", "INCIDENT", "DRIVER", { reason: "Xe thủng lốp trên cao tốc" })
        .allowed
    ).toBe(true);
  });

  it("điều phối sửa được về sau khi có lý do", () => {
    expect(
      canTransition("DRIVER_ASSIGNED", "SCHEDULED", "DISPATCHER", { reason: "Đổi tài xế" }).allowed
    ).toBe(true);
  });
});

describe("§15 — hủy và thất bại bắt buộc có lý do", () => {
  it.each([
    ["SCHEDULED", "CANCELLED"],
    ["IN_TRANSIT", "FAILED"],
    ["AT_DELIVERY", "CANCELLED"],
    ["LOADING", "ON_HOLD"],
  ] as const)("%s → %s thiếu lý do thì bị từ chối", (from, to) => {
    expect(canTransition(from, to, "DISPATCHER").allowed).toBe(false);
    expect(canTransition(from, to, "DISPATCHER", { reason: "   " }).allowed).toBe(false);
    expect(canTransition(from, to, "DISPATCHER", { reason: "Khách hủy đơn" }).allowed).toBe(true);
  });

  it("có danh mục mã lý do để chọn, không phải nhập tự do hoàn toàn", () => {
    expect(SHIPMENT_FAILURE_REASONS.length).toBeGreaterThan(5);
    expect(SHIPMENT_FAILURE_REASONS.map((r) => r.code)).toContain("VEHICLE_BREAKDOWN");
    for (const reason of SHIPMENT_FAILURE_REASONS) {
      expect(reason.label).toBeTruthy();
    }
  });
});

// -----------------------------------------------------------------------------
// Trạng thái kết thúc
// -----------------------------------------------------------------------------

describe("trạng thái kết thúc", () => {
  it.each(TERMINAL)("%s không chuyển đi đâu được", (status) => {
    expect(isTerminal(status)).toBe(true);
    expect(allowedTransitions(status)).toHaveLength(0);
  });

  it("đơn đã hoàn tất không mở lại được", () => {
    for (const target of SHIPMENT_STATUSES) {
      if (target === "COMPLETED") continue;
      expect(canTransition("COMPLETED", target, "DISPATCHER").allowed).toBe(false);
    }
  });
});

// -----------------------------------------------------------------------------
// Tạm dừng và khôi phục
// -----------------------------------------------------------------------------

describe("tạm dừng và sự cố", () => {
  it("ON_HOLD và INCIDENT quay lại được luồng chính", () => {
    expect(isPaused("ON_HOLD")).toBe(true);
    expect(isPaused("INCIDENT")).toBe(true);
    expect(isPaused("IN_TRANSIT")).toBe(false);
  });

  it("khôi phục từ ON_HOLD phải nêu lý do", () => {
    expect(canTransition("ON_HOLD", "IN_TRANSIT", "DISPATCHER").allowed).toBe(false);
    expect(
      canTransition("ON_HOLD", "IN_TRANSIT", "DISPATCHER", { reason: "Đã xử lý xong" }).allowed
    ).toBe(true);
  });

  it("tài xế không tự khôi phục đơn đang tạm dừng", () => {
    expect(
      canTransition("ON_HOLD", "IN_TRANSIT", "DRIVER", { reason: "Đi tiếp" }).allowed
    ).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Hỗ trợ giao diện
// -----------------------------------------------------------------------------

describe("nextDriverStep — một nút CTA duy nhất cho tài xế (§26.2)", () => {
  it.each([
    ["DRIVER_ASSIGNED", "EN_ROUTE_TO_PICKUP"],
    ["EN_ROUTE_TO_PICKUP", "AT_PICKUP"],
    ["AT_PICKUP", "LOADING"],
    ["LOADING", "IN_TRANSIT"],
    ["IN_TRANSIT", "AT_DELIVERY"],
    ["UNLOADING", "DELIVERED_PENDING_CONFIRMATION"],
  ] as const)("từ %s gợi ý bước %s", (from, expected) => {
    expect(nextDriverStep(from)).toBe(expected);
  });

  it("bước gợi ý luôn là bước hợp lệ cho tài xế", () => {
    for (const status of SHIPMENT_STATUSES) {
      const next = nextDriverStep(status);
      if (!next) continue;
      expect(
        canTransition(status, next, "DRIVER").allowed,
        `${status} → ${next} phải hợp lệ cho tài xế`
      ).toBe(true);
    }
  });

  it("không gợi ý bước nào ở trạng thái kết thúc hoặc chờ xử lý", () => {
    expect(nextDriverStep("COMPLETED")).toBeNull();
    expect(nextDriverStep("CANCELLED")).toBeNull();
    expect(nextDriverStep("ON_HOLD")).toBeNull();
  });
});

describe("isActiveOnRoad — quyết định có nhận vị trí GPS không (§17)", () => {
  it("chuyến đang chạy thì nhận vị trí", () => {
    expect(isActiveOnRoad("EN_ROUTE_TO_PICKUP")).toBe(true);
    expect(isActiveOnRoad("IN_TRANSIT")).toBe(true);
    expect(isActiveOnRoad("UNLOADING")).toBe(true);
  });

  it("chuyến chưa bắt đầu hoặc đã xong thì KHÔNG nhận vị trí", () => {
    for (const status of ["CREATED", "CONFIRMED", "SCHEDULED", "COMPLETED", "CANCELLED"] as const) {
      expect(isActiveOnRoad(status), `${status} không được nhận ping`).toBe(false);
    }
  });

  it("đơn đang tạm dừng không nhận vị trí", () => {
    expect(isActiveOnRoad("ON_HOLD")).toBe(false);
  });
});

describe("customerMilestoneOf — gom 19 trạng thái về 5 mốc cho khách (§15)", () => {
  it.each([
    ["CONFIRMED", "confirmed"],
    ["DRIVER_ASSIGNED", "confirmed"],
    ["AT_PICKUP", "picked_up"],
    ["LOADING", "picked_up"],
    ["IN_TRANSIT", "in_transit"],
    ["AT_DELIVERY", "delivered"],
    ["DELIVERED_PENDING_CONFIRMATION", "delivered"],
    ["COMPLETED", "completed"],
  ] as const)("%s hiển thị mốc %s", (status, expected) => {
    expect(customerMilestoneOf(status)).toBe(expected);
  });

  it("trạng thái bất thường không nằm trên trục mốc", () => {
    for (const status of ["ON_HOLD", "INCIDENT", "FAILED", "CANCELLED"] as const) {
      expect(customerMilestoneOf(status)).toBe("pending");
    }
  });
});

describe("shipmentActorOf", () => {
  it("dispatcher có quyền điều phối", () => {
    expect(shipmentActorOf(actor(["DISPATCHER"]))).toBe("DISPATCHER");
    expect(shipmentActorOf(actor(["ADMIN"]))).toBe("DISPATCHER");
  });

  it("tài xế là DRIVER", () => {
    expect(shipmentActorOf(actor(["DRIVER"]))).toBe("DRIVER");
  });

  it("kế toán KHÔNG có quyền điều phối dù đọc được đơn hàng", () => {
    // ACCOUNTANT có shipment.read_all nhưng không có shipment.dispatch (§8).
    expect(shipmentActorOf(actor(["ACCOUNTANT"]))).toBe("DRIVER");
  });

  it("khách chưa đăng nhập không được coi là điều phối", () => {
    expect(shipmentActorOf(GUEST)).toBe("DRIVER");
  });
});

describe("assertTransition", () => {
  it("không ném lỗi khi hợp lệ", () => {
    expect(() => assertTransition("CREATED", "CONFIRMED", "DISPATCHER")).not.toThrow();
  });

  it("ném INVALID_STATE_TRANSITION kèm lý do đọc được", () => {
    try {
      assertTransition("CREATED", "IN_TRANSIT", "DISPATCHER");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
      expect((error as AppError).message).toContain("CREATED");
    }
  });

  it("thông báo nêu rõ vai trò khi sai quyền", () => {
    try {
      assertTransition("IN_TRANSIT", "CANCELLED", "DRIVER", { reason: "x" });
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect((error as AppError).message).toMatch(/Tài xế/);
    }
  });
});

describe("checkStatusPreconditions", () => {
  const ok = { hasProofOfDelivery: true } as const;

  it("chặn COMPLETED khi chưa có bằng chứng giao hàng (§15 ràng buộc 2)", () => {
    const result = checkStatusPreconditions({
      to: "COMPLETED",
      hasProofOfDelivery: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/bằng chứng giao hàng/);
  });

  it("cho phép COMPLETED khi đã có bằng chứng giao hàng", () => {
    expect(checkStatusPreconditions({ to: "COMPLETED", ...ok }).allowed).toBe(true);
  });

  it.each(REASON_CODE_REQUIRED_STATUSES)(
    "%s bắt buộc có mã lý do (§15 ràng buộc 4)",
    (status) => {
      expect(checkStatusPreconditions({ to: status, ...ok }).allowed).toBe(false);
      expect(
        checkStatusPreconditions({ to: status, reasonCode: "   ", ...ok }).allowed
      ).toBe(false);
    }
  );

  it("từ chối mã lý do ngoài danh mục", () => {
    const result = checkStatusPreconditions({
      to: "CANCELLED",
      reasonCode: "TÔI_TỰ_NGHĨ_RA",
      ...ok,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/không hợp lệ/);
  });

  it.each(SHIPMENT_FAILURE_REASONS.map((reason) => reason.code))(
    "chấp nhận mã lý do %s trong danh mục",
    (code) => {
      expect(
        checkStatusPreconditions({ to: "CANCELLED", reasonCode: code, ...ok }).allowed
      ).toBe(true);
    }
  );

  it("trạng thái thường không đòi mã lý do", () => {
    for (const status of SHIPMENT_STATUSES) {
      if (REASON_CODE_REQUIRED_STATUSES.includes(status) || status === "COMPLETED") continue;
      expect(checkStatusPreconditions({ to: status, hasProofOfDelivery: false }).allowed).toBe(
        true
      );
    }
  });

  it("chỉ COMPLETED mới cần bằng chứng giao hàng, kể cả bước ngay trước nó", () => {
    // DELIVERED_PENDING_CONFIRMATION là lúc tài xế báo đã giao xong nhưng biên bản có thể
    // lập sau — chặn ở đây sẽ khoá tài xế lại giữa chừng.
    expect(
      checkStatusPreconditions({
        to: "DELIVERED_PENDING_CONFIRMATION",
        hasProofOfDelivery: false,
      }).allowed
    ).toBe(true);
  });
});
