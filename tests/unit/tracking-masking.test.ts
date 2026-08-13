import { describe, it, expect } from "vitest";
import {
  toPublicView,
  matchesPhoneSuffix,
  type ShipmentForMasking,
} from "@/modules/tracking/masking";
import { CUSTOMER_MILESTONES, SHIPMENT_STATUSES } from "@/modules/shipments/state-machine";

/**
 * Điều quan trọng nhất cần chứng minh: người tra cứu bằng mã vận đơn KHÔNG lấy được thông
 * tin cá nhân, kể cả khi bản ghi gốc có chứa (§16.1).
 */

function shipment(overrides: Partial<ShipmentForMasking> = {}): ShipmentForMasking {
  return {
    trackingCode: "VT12AB34CD56",
    status: "IN_TRANSIT",
    estimatedDeliveryAt: new Date("2026-09-02T14:30:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    stops: [
      { kind: "PICKUP", province: "TP. Hồ Chí Minh" },
      { kind: "DELIVERY", province: "Đồng Nai" },
    ],
    statusEvents: [
      { toStatus: "CONFIRMED", occurredAt: new Date("2026-09-01T06:00:00Z") },
      { toStatus: "AT_PICKUP", occurredAt: new Date("2026-09-01T08:00:00Z") },
      { toStatus: "IN_TRANSIT", occurredAt: new Date("2026-09-01T09:30:00Z") },
    ],
    ...overrides,
  };
}

describe("toPublicView — không rò rỉ dữ liệu cá nhân", () => {
  it("chỉ trả về đúng các khoá đã khai báo", () => {
    const view = toPublicView(shipment());

    expect(Object.keys(view).sort()).toEqual(
      [
        "estimatedDeliveryDate",
        "hasException",
        "lastUpdatedAt",
        "milestones",
        "statusLabel",
        "stops",
        "trackingCode",
      ].sort()
    );
  });

  it("điểm dừng chỉ còn tỉnh/thành, không có địa chỉ hay quận huyện", () => {
    const view = toPublicView(shipment());

    for (const stop of view.stops) {
      expect(Object.keys(stop).sort()).toEqual(["kind", "province"]);
    }
  });

  it("không đưa giờ giao cụ thể ra ngoài, chỉ tới ngày", () => {
    const view = toPublicView(shipment());
    const date = view.estimatedDeliveryDate!;

    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it("không có ngày dự kiến thì trả null chứ không bịa", () => {
    const view = toPublicView(shipment({ estimatedDeliveryAt: null }));
    expect(view.estimatedDeliveryDate).toBeNull();
  });

  it("trả nhãn tiếng Việt chứ không phải mã trạng thái nội bộ", () => {
    const view = toPublicView(shipment({ status: "SECURED_ON_VEHICLE" }));

    expect(view.statusLabel).toBe("Đã chằng buộc xong");
    expect(view.statusLabel).not.toContain("SECURED");
  });
});

describe("toPublicView — mốc tiến trình", () => {
  it("luôn trả đủ 5 mốc, kể cả khi chuyến mới bắt đầu", () => {
    const view = toPublicView(shipment({ status: "CONFIRMED", statusEvents: [] }));
    expect(view.milestones).toHaveLength(CUSTOMER_MILESTONES.length);
  });

  it("đánh dấu đã đạt cho mọi mốc từ đầu tới mốc hiện tại", () => {
    const view = toPublicView(shipment({ status: "IN_TRANSIT" }));
    const reached = view.milestones.filter((m) => m.reached).map((m) => m.key);

    expect(reached).toEqual(["confirmed", "picked_up", "in_transit"]);
  });

  it("mốc chưa đạt không có thời gian", () => {
    const view = toPublicView(shipment({ status: "IN_TRANSIT" }));

    for (const milestone of view.milestones) {
      if (!milestone.reached) expect(milestone.occurredAt).toBeNull();
    }
  });

  it("ghi thời điểm LẦN ĐẦU đạt mốc, không phải lần gần nhất", () => {
    // Chuyến bị tạm dừng rồi chạy lại đi qua IN_TRANSIT hai lần.
    const view = toPublicView(
      shipment({
        statusEvents: [
          { toStatus: "IN_TRANSIT", occurredAt: new Date("2026-09-01T09:00:00Z") },
          { toStatus: "ON_HOLD", occurredAt: new Date("2026-09-01T10:00:00Z") },
          { toStatus: "IN_TRANSIT", occurredAt: new Date("2026-09-01T12:00:00Z") },
        ],
      })
    );

    const inTransit = view.milestones.find((m) => m.key === "in_transit")!;
    expect(inTransit.occurredAt?.toISOString()).toBe("2026-09-01T09:00:00.000Z");
  });

  it("sắp xếp lại đúng khi sự kiện đưa vào lộn xộn thứ tự", () => {
    const view = toPublicView(
      shipment({
        statusEvents: [
          { toStatus: "IN_TRANSIT", occurredAt: new Date("2026-09-01T09:30:00Z") },
          { toStatus: "CONFIRMED", occurredAt: new Date("2026-09-01T06:00:00Z") },
        ],
      })
    );

    const confirmed = view.milestones.find((m) => m.key === "confirmed")!;
    expect(confirmed.occurredAt?.toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });
});

describe("toPublicView — trạng thái ngoại lệ", () => {
  it.each(["ON_HOLD", "INCIDENT", "FAILED", "CANCELLED"])(
    "%s được đánh dấu là ngoại lệ",
    (status) => {
      expect(toPublicView(shipment({ status })).hasException).toBe(true);
    }
  );

  it.each(["CONFIRMED", "IN_TRANSIT", "COMPLETED"])("%s KHÔNG phải ngoại lệ", (status) => {
    expect(toPublicView(shipment({ status })).hasException).toBe(false);
  });

  it("mọi trạng thái đều dựng được view mà không ném lỗi", () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(() => toPublicView(shipment({ status }))).not.toThrow();
    }
  });
});

describe("matchesPhoneSuffix", () => {
  it("khớp 4 số cuối của số đã chuẩn hoá", () => {
    expect(matchesPhoneSuffix("+84912345678", "5678")).toBe(true);
  });

  it("bỏ qua khoảng trắng và dấu người dùng gõ thêm", () => {
    expect(matchesPhoneSuffix("+84912345678", "56 78")).toBe(true);
    expect(matchesPhoneSuffix("+84912345678", "5-6-7-8")).toBe(true);
  });

  it("từ chối khi sai số", () => {
    expect(matchesPhoneSuffix("+84912345678", "1234")).toBe(false);
  });

  it("từ chối khi không đủ 4 chữ số", () => {
    expect(matchesPhoneSuffix("+84912345678", "678")).toBe(false);
    expect(matchesPhoneSuffix("+84912345678", "")).toBe(false);
  });

  it("từ chối khi nhập nhiều hơn 4 chữ số, kể cả khi chứa đúng 4 số cuối", () => {
    // Nhập cả số điện thoại phải bị từ chối: bước xác minh này cố tình chỉ nhận 4 số.
    expect(matchesPhoneSuffix("+84912345678", "345678")).toBe(false);
  });

  it("đơn không có số điện thoại thì không ai tra cứu công khai được", () => {
    expect(matchesPhoneSuffix(null, "5678")).toBe(false);
  });
});
