import { describe, it, expect } from "vitest";
import {
  formatDateTime,
  formatDate,
  hasOverlap,
  isValidTimeWindow,
  addMinutes,
  addDays,
  isExpired,
  BUSINESS_TIMEZONE,
} from "@/lib/datetime";

describe("múi giờ nghiệp vụ", () => {
  it("dùng Asia/Ho_Chi_Minh", () => {
    expect(BUSINESS_TIMEZONE).toBe("Asia/Ho_Chi_Minh");
  });

  it("chuyển UTC sang giờ Việt Nam khi hiển thị", () => {
    // 2026-08-10T01:30:00Z là 08:30 ngày 10/08 theo giờ Việt Nam (UTC+7).
    const utc = "2026-08-10T01:30:00.000Z";
    expect(formatDateTime(utc)).toContain("08:30");
    expect(formatDate(utc)).toBe("10/08/2026");
  });

  it("mốc qua ngày được đổi đúng ngày theo giờ Việt Nam", () => {
    // 2026-08-09T18:00:00Z là 01:00 ngày 10/08 giờ Việt Nam — đã sang ngày hôm sau.
    expect(formatDate("2026-08-09T18:00:00.000Z")).toBe("10/08/2026");
  });

  it("ném lỗi với giá trị thời gian không hợp lệ", () => {
    expect(() => formatDateTime("khong-phai-ngay")).toThrow();
  });
});

describe("hasOverlap — nền tảng chống double-booking", () => {
  const window = (from: string, to: string) => ({
    start: new Date(from),
    end: new Date(to),
  });

  it("phát hiện hai khoảng giao nhau một phần", () => {
    expect(
      hasOverlap(
        window("2026-09-01T08:00:00Z", "2026-09-01T12:00:00Z"),
        window("2026-09-01T10:00:00Z", "2026-09-01T14:00:00Z")
      )
    ).toBe(true);
  });

  it("phát hiện khoảng nằm lọt bên trong", () => {
    expect(
      hasOverlap(
        window("2026-09-01T08:00:00Z", "2026-09-01T18:00:00Z"),
        window("2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z")
      )
    ).toBe(true);
  });

  it("hai khoảng liền kề nhau KHÔNG tính là giao nhau", () => {
    // Xe xong chuyến lúc 12:00 thì được nhận chuyến mới bắt đầu đúng 12:00.
    expect(
      hasOverlap(
        window("2026-09-01T08:00:00Z", "2026-09-01T12:00:00Z"),
        window("2026-09-01T12:00:00Z", "2026-09-01T16:00:00Z")
      )
    ).toBe(false);
  });

  it("hai khoảng tách rời không giao nhau", () => {
    expect(
      hasOverlap(
        window("2026-09-01T08:00:00Z", "2026-09-01T10:00:00Z"),
        window("2026-09-01T14:00:00Z", "2026-09-01T16:00:00Z")
      )
    ).toBe(false);
  });

  it("đối xứng — đổi thứ tự tham số cho kết quả giống nhau", () => {
    const a = window("2026-09-01T08:00:00Z", "2026-09-01T12:00:00Z");
    const b = window("2026-09-01T10:00:00Z", "2026-09-01T14:00:00Z");
    expect(hasOverlap(a, b)).toBe(hasOverlap(b, a));
  });
});

describe("isValidTimeWindow", () => {
  it("bắt đầu phải trước kết thúc", () => {
    expect(isValidTimeWindow(new Date("2026-09-01T08:00:00Z"), new Date("2026-09-01T12:00:00Z"))).toBe(true);
    expect(isValidTimeWindow(new Date("2026-09-01T12:00:00Z"), new Date("2026-09-01T08:00:00Z"))).toBe(false);
  });

  it("khoảng có độ dài bằng 0 là không hợp lệ", () => {
    const t = new Date("2026-09-01T08:00:00Z");
    expect(isValidTimeWindow(t, t)).toBe(false);
  });
});

describe("addMinutes và addDays", () => {
  it("cộng phút chính xác", () => {
    const base = new Date("2026-09-01T08:00:00Z");
    expect(addMinutes(base, 90).toISOString()).toBe("2026-09-01T09:30:00.000Z");
  });

  it("cộng ngày qua ranh giới tháng", () => {
    const base = new Date("2026-08-30T08:00:00Z");
    expect(addDays(base, 3).toISOString()).toBe("2026-09-02T08:00:00.000Z");
  });
});

describe("isExpired", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("thời điểm trong quá khứ là đã hết hạn", () => {
    expect(isExpired("2026-09-01T11:59:59Z", now)).toBe(true);
  });

  it("đúng thời điểm hết hạn tính là đã hết hạn", () => {
    expect(isExpired("2026-09-01T12:00:00Z", now)).toBe(true);
  });

  it("thời điểm tương lai chưa hết hạn", () => {
    expect(isExpired("2026-09-01T12:00:01Z", now)).toBe(false);
  });
});
