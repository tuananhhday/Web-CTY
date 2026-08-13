import { describe, it, expect } from "vitest";
import {
  freightRequestSchema,
  movingRequestSchema,
  listRequestsQuerySchema,
} from "@/modules/service-requests/schema";

/** Dữ liệu hợp lệ tối thiểu, dùng làm gốc rồi ghi đè từng trường để test. */
function validFreight(overrides: Record<string, unknown> = {}) {
  return {
    serviceSlug: "van-chuyen-hang-hoa",
    contactName: "Nguyễn Văn An",
    contactPhone: "0912345678",
    pickup: { line: "12 Nguyễn Huệ", province: "TP. Hồ Chí Minh" },
    dropoff: { line: "45 Lê Lợi", province: "Đồng Nai" },
    items: [{ cargoType: "Hàng bách hóa", quantity: 5, weightKg: 100 }],
    acceptPolicy: true,
    ...overrides,
  };
}

function validMoving(overrides: Record<string, unknown> = {}) {
  return {
    contactName: "Trần Thị Bình",
    contactPhone: "0987654321",
    propertyType: "APARTMENT",
    origin: { line: "20 Trần Hưng Đạo", province: "Hà Nội" },
    destination: { line: "88 Giải Phóng", province: "Hà Nội" },
    inventoryItems: [{ category: "FURNITURE", name: "Tủ quần áo", quantity: 1 }],
    acceptPolicy: true,
    ...overrides,
  };
}

describe("freightRequestSchema — trường bắt buộc", () => {
  it("chấp nhận dữ liệu hợp lệ tối thiểu", () => {
    expect(freightRequestSchema.safeParse(validFreight()).success).toBe(true);
  });

  it("bắt buộc đồng ý chính sách dữ liệu (§11, §31)", () => {
    const result = freightRequestSchema.safeParse(validFreight({ acceptPolicy: false }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/đồng ý/i);
    }
  });

  it("từ chối khi không khai báo hàng hóa nào", () => {
    const result = freightRequestSchema.safeParse(validFreight({ items: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ít nhất một loại hàng/i);
    }
  });
});

describe("freightRequestSchema — số điện thoại Việt Nam", () => {
  it.each(["0912345678", "84912345678", "+84912345678", "0912 345 678", "0912.345.678"])(
    "chấp nhận %s",
    (phone) => {
      expect(freightRequestSchema.safeParse(validFreight({ contactPhone: phone })).success).toBe(true);
    }
  );

  it.each(["123", "091234567", "abcdefghij", "", "1912345678"])("từ chối %s", (phone) => {
    expect(freightRequestSchema.safeParse(validFreight({ contactPhone: phone })).success).toBe(false);
  });

  it("thông báo lỗi có ví dụ định dạng đúng", () => {
    const result = freightRequestSchema.safeParse(validFreight({ contactPhone: "123" }));
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("contactPhone"));
      expect(issue?.message).toContain("0912 345 678");
    }
  });
});

describe("freightRequestSchema — chống giá trị vô lý", () => {
  it("từ chối khối lượng âm", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({ items: [{ cargoType: "Hàng", quantity: 1, weightKg: -5 }] })
    );
    expect(result.success).toBe(false);
  });

  it("từ chối số kiện bằng 0", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({ items: [{ cargoType: "Hàng", quantity: 0, weightKg: 10 }] })
    );
    expect(result.success).toBe(false);
  });

  it("từ chối số kiện thập phân", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({ items: [{ cargoType: "Hàng", quantity: 1.5, weightKg: 10 }] })
    );
    expect(result.success).toBe(false);
  });

  it("từ chối giá trị khai báo âm", () => {
    expect(freightRequestSchema.safeParse(validFreight({ declaredValue: -1000 })).success).toBe(false);
  });

  it("chấp nhận tầng âm (tầng hầm) nhưng từ chối tầng vô lý", () => {
    const basement = validFreight({
      pickup: { line: "12 Nguyễn Huệ", province: "TP. Hồ Chí Minh", floorNumber: -2 },
    });
    expect(freightRequestSchema.safeParse(basement).success).toBe(true);

    const absurd = validFreight({
      pickup: { line: "12 Nguyễn Huệ", province: "TP. Hồ Chí Minh", floorNumber: 500 },
    });
    expect(freightRequestSchema.safeParse(absurd).success).toBe(false);
  });

  it("từ chối khoảng cách bê hàng âm", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({ pickup: { line: "12 Nguyễn Huệ", province: "Hà Nội", carryDistanceM: -10 } })
    );
    expect(result.success).toBe(false);
  });

  it("từ chối quá 50 dòng hàng trong một yêu cầu", () => {
    const many = Array.from({ length: 51 }, () => ({
      cargoType: "Hàng",
      quantity: 1,
      weightKg: 1,
    }));
    expect(freightRequestSchema.safeParse(validFreight({ items: many })).success).toBe(false);
  });
});

describe("freightRequestSchema — thời gian", () => {
  it("từ chối thời gian giao TRƯỚC thời gian lấy", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({
        preferredPickupAt: "2026-09-02T08:00:00+07:00",
        preferredDeliveryAt: "2026-09-01T08:00:00+07:00",
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/sau thời gian lấy/i);
    }
  });

  it("chấp nhận thời gian giao sau thời gian lấy", () => {
    const result = freightRequestSchema.safeParse(
      validFreight({
        preferredPickupAt: "2026-09-01T08:00:00+07:00",
        preferredDeliveryAt: "2026-09-02T08:00:00+07:00",
      })
    );
    expect(result.success).toBe(true);
  });

  it("chấp nhận khi chỉ có một trong hai mốc thời gian", () => {
    expect(
      freightRequestSchema.safeParse(
        validFreight({ preferredPickupAt: "2026-09-01T08:00:00+07:00" })
      ).success
    ).toBe(true);
  });
});

describe("freightRequestSchema — honeypot", () => {
  it("KHÔNG từ chối khi trường bẫy có giá trị — route xử lý riêng để không lộ cơ chế", () => {
    const result = freightRequestSchema.safeParse(validFreight({ website: "http://spam.example" }));
    expect(result.success).toBe(true);
  });
});

describe("movingRequestSchema", () => {
  it("chấp nhận dữ liệu hợp lệ", () => {
    expect(movingRequestSchema.safeParse(validMoving()).success).toBe(true);
  });

  it("từ chối khi vừa không liệt kê đồ vừa không yêu cầu khảo sát", () => {
    const result = movingRequestSchema.safeParse(
      validMoving({ inventoryItems: [], requestsSiteSurvey: false })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/khảo sát/i);
    }
  });

  it("chấp nhận danh sách rỗng NẾU khách yêu cầu khảo sát trực tiếp", () => {
    const result = movingRequestSchema.safeParse(
      validMoving({ inventoryItems: [], requestsSiteSurvey: true })
    );
    expect(result.success).toBe(true);
  });

  it("từ chối nhóm đồ đạc không hợp lệ", () => {
    const result = movingRequestSchema.safeParse(
      validMoving({ inventoryItems: [{ category: "SPACESHIP", name: "X", quantity: 1 }] })
    );
    expect(result.success).toBe(false);
  });

  it("từ chối loại hình bất động sản không hợp lệ", () => {
    expect(movingRequestSchema.safeParse(validMoving({ propertyType: "CASTLE" })).success).toBe(false);
  });

  it("giới hạn 200 dòng đồ đạc, gợi ý khảo sát khi vượt", () => {
    const many = Array.from({ length: 201 }, () => ({
      category: "BOX" as const,
      name: "Thùng",
      quantity: 1,
    }));
    const result = movingRequestSchema.safeParse(validMoving({ inventoryItems: many }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/khảo sát/i);
    }
  });
});

describe("listRequestsQuerySchema — allowlist chống injection (§25)", () => {
  it("dùng giá trị mặc định khi không truyền gì", () => {
    const result = listRequestsQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sort).toBe("createdAt");
    expect(result.order).toBe("desc");
  });

  it("từ chối cột sắp xếp ngoài allowlist", () => {
    expect(listRequestsQuerySchema.safeParse({ sort: "contactPhone" }).success).toBe(false);
    expect(listRequestsQuerySchema.safeParse({ sort: "id; DROP TABLE users" }).success).toBe(false);
  });

  it("từ chối trạng thái không tồn tại", () => {
    expect(listRequestsQuerySchema.safeParse({ status: "HACKED" }).success).toBe(false);
  });

  it("chặn limit quá lớn để một request không kéo cả bảng", () => {
    expect(listRequestsQuerySchema.safeParse({ limit: 10000 }).success).toBe(false);
    expect(listRequestsQuerySchema.parse({ limit: "50" }).limit).toBe(50);
  });

  it("từ chối số trang nhỏ hơn 1", () => {
    expect(listRequestsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listRequestsQuerySchema.safeParse({ page: -5 }).success).toBe(false);
  });
});
