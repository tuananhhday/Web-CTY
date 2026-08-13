import { describe, it, expect } from "vitest";
import { DRIVER_SHIPMENT_SELECT } from "@/modules/shipments/repository";

/**
 * Tài xế KHÔNG được xem dữ liệu tài chính và báo giá (§8).
 *
 * Đây là kiểm tra hình dạng truy vấn chứ không phải kiểm tra giao diện: giao diện có thể
 * quên ẩn một trường, nhưng nếu trường đó không bao giờ rời khỏi database thì không có gì
 * để lộ. Test nằm ở nhóm integration vì repository kéo theo Prisma Client.
 *
 * Lỗi thật đã gặp: mã báo giá bị nhúng vào ghi chú của sự kiện trạng thái "Mới tạo", nên
 * hiện nguyên trong lịch sử chuyến trên màn hình tài xế dù không có trường `quote` nào.
 */

/** Trường tuyệt đối không được có trong dữ liệu gửi tới màn hình tài xế. */
const FORBIDDEN_FOR_DRIVER = [
  "quote",
  "quoteId",
  "totalAmount",
  "currency",
  "internalNote",
  "serviceRequest",
  "user",
  "invoices",
  "cancelReason",
];

function collectKeys(node: unknown, path = "", acc: string[] = []): string[] {
  if (typeof node !== "object" || node === null) return acc;

  for (const [key, value] of Object.entries(node)) {
    // `select` và `orderBy` là từ khoá của Prisma, không phải tên cột.
    if (key === "select" || key === "orderBy" || key === "where") {
      collectKeys(value, path, acc);
      continue;
    }
    acc.push(path ? `${path}.${key}` : key);
    collectKeys(value, path ? `${path}.${key}` : key, acc);
  }

  return acc;
}

describe("DRIVER_SHIPMENT_SELECT", () => {
  const keys = collectKeys(DRIVER_SHIPMENT_SELECT);

  it.each(FORBIDDEN_FOR_DRIVER)("không chọn trường %s ở bất kỳ cấp nào", (forbidden) => {
    const leaked = keys.filter((key) => key.split(".").includes(forbidden));
    expect(leaked, `rò rỉ qua: ${leaked.join(", ")}`).toHaveLength(0);
  });

  it("vẫn chọn đủ thứ tài xế cần để làm việc", () => {
    for (const required of [
      "trackingCode",
      "status",
      "instructions",
      "stops.line",
      "stops.contactPhone",
      "stops.accessNote",
      "assignments.vehicle.plateNumber",
      "statusEvents.toStatus",
    ]) {
      expect(keys, `thiếu ${required}`).toContain(required);
    }
  });

  it("giữ userId để kiểm tra quyền, nhưng không kéo cả bản ghi người dùng", () => {
    expect(keys).toContain("userId");
    expect(keys).not.toContain("user");
  });
});
