import { describe, it, expect } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  permissionsForRole,
  permissionsForRoles,
  isStaffRole,
  isHighPrivilegeRole,
  SUPER_ADMIN_ONLY_PERMISSIONS,
  type StoredRole,
  type Permission,
} from "@/modules/auth/permissions";

const storedRoles = ROLES.filter((r): r is StoredRole => r !== "GUEST");

describe("catalog quyền", () => {
  it("có đủ 8 vai trò theo §8", () => {
    expect(ROLES).toHaveLength(8);
    expect(ROLES).toContain("GUEST");
    expect(ROLES).toContain("SUPER_ADMIN");
  });

  it("không tạo vai trò CARGO_PARTNER (§8 cấm ở phiên bản này)", () => {
    expect(ROLES as readonly string[]).not.toContain("CARGO_PARTNER");
  });

  it("mọi permission đều có namespace dạng <tài nguyên>.<hành động>", () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("không có permission trùng lặp", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});

describe("ràng buộc phân quyền bắt buộc của §8", () => {
  const perms = (role: StoredRole) => new Set(permissionsForRole(role));

  it("CUSTOMER không có bất kỳ quyền đọc toàn hệ thống nào", () => {
    const customer = perms("CUSTOMER");
    for (const permission of PERMISSIONS) {
      if (permission.endsWith("_all")) {
        expect(customer.has(permission)).toBe(false);
      }
    }
    expect(customer.size).toBe(0);
  });

  it("DRIVER không xem được bảng giá nội bộ", () => {
    const driver = perms("DRIVER");
    expect(driver.has("pricing.read")).toBe(false);
    expect(driver.has("pricing.manage")).toBe(false);
  });

  it("DRIVER không xem được dữ liệu tài chính", () => {
    const driver = perms("DRIVER");
    expect(driver.has("invoice.read_all")).toBe(false);
    expect(driver.has("invoice.manage")).toBe(false);
    expect(driver.has("payment.record")).toBe(false);
  });

  it("DRIVER không xem được dữ liệu khách hàng khác", () => {
    const driver = perms("DRIVER");
    expect(driver.has("shipment.read_all")).toBe(false);
    expect(driver.has("user.read")).toBe(false);
    expect(driver.has("request.read_all")).toBe(false);
  });

  it("EDITOR chỉ quản lý nội dung, không điều phối", () => {
    const editor = perms("EDITOR");
    expect(editor.has("cms.write")).toBe(true);
    expect(editor.has("shipment.dispatch")).toBe(false);
    expect(editor.has("shipment.update")).toBe(false);
    expect(editor.has("fleet.manage")).toBe(false);
  });

  it("EDITOR không xem được dữ liệu nhạy cảm", () => {
    const editor = perms("EDITOR");
    expect(editor.has("invoice.read_all")).toBe(false);
    expect(editor.has("user.manage")).toBe(false);
    expect(editor.has("audit.read")).toBe(false);
  });

  it("ACCOUNTANT quản lý hóa đơn nhưng KHÔNG đổi trạng thái vận chuyển", () => {
    const accountant = perms("ACCOUNTANT");
    expect(accountant.has("invoice.manage")).toBe(true);
    expect(accountant.has("payment.record")).toBe(true);
    expect(accountant.has("shipment.update")).toBe(false);
    expect(accountant.has("shipment.dispatch")).toBe(false);
  });

  it("DISPATCHER điều phối nhưng KHÔNG tự cấp quyền tài khoản", () => {
    const dispatcher = perms("DISPATCHER");
    expect(dispatcher.has("shipment.dispatch")).toBe(true);
    expect(dispatcher.has("fleet.manage")).toBe(true);
    expect(dispatcher.has("user.manage")).toBe(false);
    expect(dispatcher.has("settings.manage")).toBe(false);
  });

  it("DISPATCHER không duyệt được báo giá vượt ngưỡng", () => {
    expect(perms("DISPATCHER").has("quote.approve")).toBe(false);
  });

  it("ADMIN không mặc nhiên có mọi quyền của SUPER_ADMIN", () => {
    const admin = perms("ADMIN");
    for (const permission of SUPER_ADMIN_ONLY_PERMISSIONS) {
      expect(admin.has(permission)).toBe(false);
    }
  });

  it("chỉ SUPER_ADMIN có settings.manage", () => {
    for (const role of storedRoles) {
      const expected = role === "SUPER_ADMIN";
      expect(perms(role).has("settings.manage")).toBe(expected);
    }
  });

  it("SUPER_ADMIN có toàn bộ permission", () => {
    expect(perms("SUPER_ADMIN").size).toBe(PERMISSIONS.length);
  });
});

describe("permissionsForRoles — người dùng giữ nhiều vai trò", () => {
  it("hợp nhất quyền của các vai trò", () => {
    const combined = permissionsForRoles(["EDITOR", "ACCOUNTANT"]);
    expect(combined.has("cms.write")).toBe(true);
    expect(combined.has("invoice.manage")).toBe(true);
  });

  it("không phát sinh quyền ngoài tổng của các vai trò thành phần", () => {
    const combined = permissionsForRoles(["EDITOR", "ACCOUNTANT"]);
    const union = new Set<Permission>([
      ...permissionsForRole("EDITOR"),
      ...permissionsForRole("ACCOUNTANT"),
    ]);
    expect(combined.size).toBe(union.size);
    // Cụ thể: gộp EDITOR + ACCOUNTANT vẫn không cho phép điều phối.
    expect(combined.has("shipment.dispatch")).toBe(false);
  });

  it("danh sách vai trò rỗng cho ra tập quyền rỗng", () => {
    expect(permissionsForRoles([]).size).toBe(0);
  });
});

describe("phân loại vai trò", () => {
  it("nhận diện đúng vai trò nhân viên nội bộ", () => {
    expect(isStaffRole("DISPATCHER")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(isStaffRole("DRIVER")).toBe(false);
  });

  it("nhận diện đúng vai trò quyền cao cần MFA", () => {
    expect(isHighPrivilegeRole("ADMIN")).toBe(true);
    expect(isHighPrivilegeRole("SUPER_ADMIN")).toBe(true);
    expect(isHighPrivilegeRole("DISPATCHER")).toBe(false);
  });
});
