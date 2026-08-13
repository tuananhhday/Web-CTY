import { describe, it, expect } from "vitest";
import {
  findConflicts,
  canOverride,
  summarizeConflicts,
  isExclusionViolation,
  type ExistingAssignment,
  type AvailabilityWindow,
} from "@/modules/fleet/conflicts";

const VEHICLE = "veh-1";
const DRIVER_A = "drv-a";
const DRIVER_B = "drv-b";

function win(fromHour: number, toHour: number) {
  return {
    effectiveFrom: new Date(`2026-09-01T${String(fromHour).padStart(2, "0")}:00:00Z`),
    effectiveTo: new Date(`2026-09-01T${String(toHour).padStart(2, "0")}:00:00Z`),
  };
}

function assignment(overrides: Partial<ExistingAssignment> = {}): ExistingAssignment {
  return {
    id: "asg-existing",
    shipmentId: "shp-1",
    shipmentTrackingCode: "VTAAA111111",
    vehicleId: VEHICLE,
    primaryDriverId: DRIVER_A,
    secondaryDriverId: null,
    isActive: true,
    overrideConflict: false,
    ...win(8, 12),
    ...overrides,
  };
}

function block(overrides: Partial<AvailabilityWindow> = {}): AvailabilityWindow {
  return {
    id: "blk-1",
    kind: "MAINTENANCE",
    reason: "Bảo dưỡng định kỳ",
    vehicleId: VEHICLE,
    driverProfileId: null,
    ...win(8, 12),
    ...overrides,
  };
}

function check(overrides: Partial<Parameters<typeof findConflicts>[0]> = {}) {
  return findConflicts({
    window: win(10, 14),
    vehicleId: VEHICLE,
    primaryDriverId: DRIVER_A,
    secondaryDriverId: null,
    existingAssignments: [],
    availabilityBlocks: [],
    ...overrides,
  });
}

describe("phát hiện xe bị trùng lịch", () => {
  it("báo xung đột khi hai khoảng giao nhau", () => {
    const conflicts = check({ existingAssignments: [assignment({ primaryDriverId: null })] });
    expect(conflicts.map((c) => c.kind)).toContain("VEHICLE_BUSY");
  });

  it("KHÔNG báo xung đột khi hai chuyến liền kề nhau", () => {
    // Xe xong lúc 12:00 thì nhận chuyến mới bắt đầu đúng 12:00 được.
    const conflicts = check({
      window: win(12, 16),
      existingAssignments: [assignment({ primaryDriverId: null })],
    });
    expect(conflicts).toHaveLength(0);
  });

  it("KHÔNG báo xung đột khi hai chuyến tách rời", () => {
    const conflicts = check({
      window: win(14, 18),
      existingAssignments: [assignment({ primaryDriverId: null })],
    });
    expect(conflicts).toHaveLength(0);
  });

  it("phát hiện khi khoảng mới nằm lọt bên trong khoảng cũ", () => {
    const conflicts = check({
      window: win(9, 10),
      existingAssignments: [assignment({ primaryDriverId: null })],
    });
    expect(conflicts).toHaveLength(1);
  });

  it("phân công đã gỡ KHÔNG còn chiếm chỗ", () => {
    const conflicts = check({
      existingAssignments: [assignment({ isActive: false, primaryDriverId: null })],
    });
    expect(conflicts).toHaveLength(0);
  });

  it("bỏ qua chính bản ghi đang sửa", () => {
    const conflicts = check({
      existingAssignments: [assignment({ id: "asg-me", primaryDriverId: null })],
      excludeAssignmentId: "asg-me",
    });
    expect(conflicts).toHaveLength(0);
  });

  it("xe khác thì không xung đột", () => {
    const conflicts = check({
      vehicleId: "veh-2",
      primaryDriverId: null,
      existingAssignments: [assignment({ primaryDriverId: null })],
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe("phát hiện tài xế bị trùng lịch", () => {
  it("báo xung đột khi tài xế chính trùng", () => {
    const conflicts = check({
      vehicleId: null,
      existingAssignments: [assignment({ vehicleId: null })],
    });
    expect(conflicts.map((c) => c.kind)).toContain("DRIVER_BUSY");
  });

  it("phát hiện khi tài xế chính bên này là tài xế PHỤ bên kia", () => {
    const conflicts = check({
      vehicleId: null,
      primaryDriverId: DRIVER_B,
      existingAssignments: [
        assignment({ vehicleId: null, primaryDriverId: DRIVER_A, secondaryDriverId: DRIVER_B }),
      ],
    });
    expect(conflicts.map((c) => c.kind)).toContain("DRIVER_BUSY");
  });

  it("phát hiện khi tài xế phụ bên này là tài xế chính bên kia", () => {
    const conflicts = check({
      vehicleId: null,
      primaryDriverId: null,
      secondaryDriverId: DRIVER_A,
      existingAssignments: [assignment({ vehicleId: null, primaryDriverId: DRIVER_A })],
    });
    expect(conflicts.map((c) => c.kind)).toContain("DRIVER_BUSY");
  });

  it("tài xế khác thì không xung đột", () => {
    const conflicts = check({
      vehicleId: null,
      primaryDriverId: DRIVER_B,
      existingAssignments: [assignment({ vehicleId: null, primaryDriverId: DRIVER_A })],
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe("báo cả hai xung đột cùng lúc", () => {
  it("trùng cả xe lẫn tài xế thì báo hai lỗi, không dừng ở lỗi đầu", () => {
    const conflicts = check({ existingAssignments: [assignment()] });

    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((c) => c.kind).sort()).toEqual(["DRIVER_BUSY", "VEHICLE_BUSY"]);
  });

  it("gộp thông báo thành một khối đọc được", () => {
    const conflicts = check({ existingAssignments: [assignment()] });
    const summary = summarizeConflicts(conflicts);

    expect(summary).toContain("2 xung đột");
    expect(summary).toContain("•");
  });

  it("một xung đột thì hiển thị thẳng thông báo, không cần đánh số", () => {
    const conflicts = check({
      existingAssignments: [assignment({ primaryDriverId: null })],
    });
    expect(summarizeConflicts(conflicts)).not.toContain("•");
  });
});

describe("lịch bận: bảo trì và nghỉ phép", () => {
  it("xe đang bảo trì thì không phân công được", () => {
    const conflicts = check({ primaryDriverId: null, availabilityBlocks: [block()] });

    expect(conflicts.map((c) => c.kind)).toContain("VEHICLE_BLOCKED");
    expect(conflicts[0].message).toContain("bảo trì");
    expect(conflicts[0].message).toContain("Bảo dưỡng định kỳ");
  });

  it("tài xế nghỉ phép thì không phân công được", () => {
    const conflicts = check({
      vehicleId: null,
      availabilityBlocks: [
        block({ kind: "LEAVE", vehicleId: null, driverProfileId: DRIVER_A, reason: "Nghỉ ốm" }),
      ],
    });

    expect(conflicts.map((c) => c.kind)).toContain("DRIVER_BLOCKED");
    expect(conflicts[0].message).toContain("nghỉ phép");
  });

  it("lịch bận không giao nhau thì bỏ qua", () => {
    const conflicts = check({
      window: win(14, 18),
      primaryDriverId: null,
      availabilityBlocks: [block()],
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe("canOverride — chỉ trùng phân công mới bỏ qua được (§14.3)", () => {
  it("không có xung đột thì đương nhiên qua", () => {
    expect(canOverride([])).toBe(true);
  });

  it("trùng phân công thì override được, có lý do", () => {
    const conflicts = check({ existingAssignments: [assignment()] });
    expect(canOverride(conflicts)).toBe(true);
  });

  it("xe đang bảo trì thì KHÔNG override được — đó là ràng buộc vật lý", () => {
    const conflicts = check({ primaryDriverId: null, availabilityBlocks: [block()] });
    expect(canOverride(conflicts)).toBe(false);
  });

  it("tài xế nghỉ phép thì KHÔNG override được", () => {
    const conflicts = check({
      vehicleId: null,
      availabilityBlocks: [block({ kind: "LEAVE", vehicleId: null, driverProfileId: DRIVER_A })],
    });
    expect(canOverride(conflicts)).toBe(false);
  });

  it("lẫn cả hai loại thì không override được", () => {
    const conflicts = check({
      existingAssignments: [assignment()],
      availabilityBlocks: [block()],
    });
    expect(conflicts.length).toBeGreaterThan(2);
    expect(canOverride(conflicts)).toBe(false);
  });
});

describe("isExclusionViolation — bắt lỗi ràng buộc của PostgreSQL", () => {
  it("nhận diện mã lỗi 23P01", () => {
    expect(isExclusionViolation({ code: "23P01" })).toBe(true);
  });

  it("nhận diện mã P2010 của Prisma khi bọc lỗi raw", () => {
    expect(isExclusionViolation({ code: "P2010" })).toBe(true);
  });

  it("nhận diện theo nội dung thông báo", () => {
    expect(
      isExclusionViolation({
        message: 'conflicting key value violates exclusion constraint "shipment_assignments_vehicle_no_overlap"',
      })
    ).toBe(true);
  });

  it("không nhầm với lỗi khác", () => {
    expect(isExclusionViolation({ code: "23505" })).toBe(false);
    expect(isExclusionViolation(new Error("Mất kết nối database"))).toBe(false);
    expect(isExclusionViolation(null)).toBe(false);
    expect(isExclusionViolation("chuỗi")).toBe(false);
  });
});

describe("excludeShipmentId — phân công lại chính chuyến đó", () => {
  const base = {
    window: win(8, 12),
    vehicleId: VEHICLE,
    primaryDriverId: DRIVER_A,
    secondaryDriverId: null,
    availabilityBlocks: [],
  };

  it("KHÔNG báo trùng với phân công cũ của chính chuyến đang sửa", () => {
    // Lỗi thật gặp khi kiểm thử: dispatcher chỉ nới khung giờ cho chuyến đã phân công lại
    // bị buộc tick "bỏ qua cảnh báo", ghi vào nhật ký một lần override không có thật.
    const conflicts = findConflicts({
      ...base,
      existingAssignments: [assignment({ shipmentId: "shp-1" })],
      excludeShipmentId: "shp-1",
    });

    expect(conflicts).toHaveLength(0);
  });

  it("vẫn báo trùng với chuyến KHÁC", () => {
    const conflicts = findConflicts({
      ...base,
      existingAssignments: [assignment({ shipmentId: "shp-2" })],
      excludeShipmentId: "shp-1",
    });

    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("không loại trừ gì khi không truyền excludeShipmentId", () => {
    const conflicts = findConflicts({
      ...base,
      existingAssignments: [assignment({ shipmentId: "shp-1" })],
    });

    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("loại trừ theo chuyến bỏ qua được cả nhiều phân công của chuyến đó", () => {
    const conflicts = findConflicts({
      ...base,
      existingAssignments: [
        assignment({ id: "asg-1", shipmentId: "shp-1" }),
        assignment({ id: "asg-2", shipmentId: "shp-1", primaryDriverId: DRIVER_B }),
      ],
      excludeShipmentId: "shp-1",
    });

    expect(conflicts).toHaveLength(0);
  });
});
