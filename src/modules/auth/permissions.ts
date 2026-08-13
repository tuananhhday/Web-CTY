/**
 * Catalog vai trò và quyền (§8).
 *
 * Nguyên tắc:
 *   - Deny by default: không có trong ma trận nghĩa là không được phép.
 *   - Permission là chuỗi có namespace: `<tài nguyên>.<hành động>`.
 *   - ADMIN không mặc nhiên có mọi quyền của SUPER_ADMIN.
 *   - Có quyền chưa đủ: tài nguyên riêng tư còn phải qua kiểm tra ownership/assignment
 *     (xem policy.ts). Ma trận này chỉ trả lời "vai trò này được phép làm gì về nguyên tắc".
 */

export const ROLES = [
  "GUEST",
  "CUSTOMER",
  "DRIVER",
  "DISPATCHER",
  "EDITOR",
  "ACCOUNTANT",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

/** Vai trò lưu trong database. GUEST là trạng thái chưa đăng nhập, không có bản ghi. */
export type StoredRole = Exclude<Role, "GUEST">;

export const PERMISSIONS = [
  // Nội dung website
  "cms.read",
  "cms.write",
  "cms.publish",

  // Yêu cầu dịch vụ
  "request.read_all",
  "request.manage",

  // Báo giá
  "quote.read_all",
  "quote.create",
  "quote.approve",
  "quote.send",

  // Bảng giá
  "pricing.read",
  "pricing.manage",
  "pricing.publish",

  // Đơn hàng
  "shipment.read_all",
  "shipment.dispatch",
  "shipment.update",

  // Đội xe
  "fleet.read",
  "fleet.manage",

  // Theo dõi
  "tracking.read_all",
  "tracking.manage",

  // Sự cố
  "incident.read_all",
  "incident.manage",

  // Hỗ trợ
  "support.read_all",
  "support.manage",

  // Tài chính
  "invoice.read_all",
  "invoice.manage",
  "payment.record",

  // Người dùng và hệ thống
  "user.read",
  "user.manage",
  "audit.read",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Ma trận vai trò → quyền.
 *
 * Các ràng buộc của §8 được thể hiện trực tiếp ở đây:
 *   - DRIVER không có `pricing.*`, `invoice.*`, `payment.*`, `quote.*` — tài xế không
 *     được xem bảng giá nội bộ hay dữ liệu tài chính.
 *   - EDITOR chỉ có `cms.*` — không điều phối, không xem dữ liệu nhạy cảm.
 *   - ACCOUNTANT có `invoice.*` và `payment.record` nhưng KHÔNG có `shipment.update`
 *     — không tự thay đổi trạng thái vận chuyển.
 *   - DISPATCHER điều phối vận hành nhưng KHÔNG có `user.manage` — không tự cấp quyền.
 *   - ADMIN không có `settings.manage` ở mức thay đổi vai trò đặc quyền; chỉ SUPER_ADMIN.
 */
const ROLE_PERMISSIONS: Record<StoredRole, readonly Permission[]> = {
  CUSTOMER: [
    // Khách hàng không có permission `*_all` nào. Truy cập dữ liệu của chính mình
    // được kiểm soát bằng ownership trong policy.ts, không bằng permission.
  ],

  DRIVER: [
    // Tài xế chỉ cập nhật chuyến được phân công — assignment kiểm tra ở policy.ts.
    "shipment.update",
    "incident.manage",
  ],

  DISPATCHER: [
    "request.read_all",
    "request.manage",
    "quote.read_all",
    "quote.create",
    "quote.send",
    "pricing.read",
    "shipment.read_all",
    "shipment.dispatch",
    "shipment.update",
    "fleet.read",
    "fleet.manage",
    "tracking.read_all",
    "tracking.manage",
    "incident.read_all",
    "incident.manage",
    "support.read_all",
    "user.read",
  ],

  EDITOR: ["cms.read", "cms.write", "cms.publish"],

  ACCOUNTANT: [
    "invoice.read_all",
    "invoice.manage",
    "payment.record",
    "quote.read_all",
    "pricing.read",
    // Đọc được đơn hàng để đối chiếu công nợ, nhưng không có shipment.update.
    "shipment.read_all",
    "request.read_all",
  ],

  ADMIN: [
    "cms.read",
    "cms.write",
    "cms.publish",
    "request.read_all",
    "request.manage",
    "quote.read_all",
    "quote.create",
    "quote.approve",
    "quote.send",
    "pricing.read",
    "pricing.manage",
    "pricing.publish",
    "shipment.read_all",
    "shipment.dispatch",
    "shipment.update",
    "fleet.read",
    "fleet.manage",
    "tracking.read_all",
    "tracking.manage",
    "incident.read_all",
    "incident.manage",
    "support.read_all",
    "support.manage",
    "invoice.read_all",
    "invoice.manage",
    "payment.record",
    "user.read",
    "user.manage",
    "audit.read",
  ],

  // SUPER_ADMIN là vai trò duy nhất có settings.manage.
  SUPER_ADMIN: [...PERMISSIONS],
};

/** Quyền chỉ SUPER_ADMIN được cấp, kể cả cho ADMIN (§8). */
export const SUPER_ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ["settings.manage"];

/** Vai trò được coi là nhân viên nội bộ — không cho đăng ký công khai (§9). */
export const STAFF_ROLES: readonly StoredRole[] = [
  "DISPATCHER",
  "EDITOR",
  "ACCOUNTANT",
  "ADMIN",
  "SUPER_ADMIN",
];

/** Vai trò quyền cao — nên hoặc bắt buộc bật MFA (§9). */
export const HIGH_PRIVILEGE_ROLES: readonly StoredRole[] = ["ADMIN", "SUPER_ADMIN"];

/** Thao tác nhạy cảm cần xác thực lại hoặc MFA trước khi thực hiện (§30.2). */
export const REAUTH_REQUIRED_PERMISSIONS: readonly Permission[] = [
  "user.manage",
  "settings.manage",
  "payment.record",
];

export function permissionsForRole(role: StoredRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Gộp quyền của nhiều vai trò — một người dùng có thể giữ đồng thời nhiều vai trò. */
export function permissionsForRoles(roles: readonly StoredRole[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      result.add(permission);
    }
  }
  return result;
}

export function isStaffRole(role: StoredRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function isHighPrivilegeRole(role: StoredRole): boolean {
  return HIGH_PRIVILEGE_ROLES.includes(role);
}
