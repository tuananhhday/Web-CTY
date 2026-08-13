import type { VehicleType } from "@/types";

/**
 * Nhóm phương tiện minh họa. KHÔNG ghi tải trọng hoặc số lượng xe cụ thể vì chưa có
 * dữ liệu thật — chỉ mô tả nhóm chung để khách hàng hình dung, chi tiết xác nhận khi báo giá.
 */
export const vehicleTypes: VehicleType[] = [
  {
    id: "veh-nhe",
    slug: "xe-tai-nhe",
    name: "Xe tải nhẹ",
    category: "light",
    description: "Phù hợp hàng hóa khối lượng nhỏ, giao nhận trong nội thành.",
    imageKey: "fleet-warehouse",
    suitableFor: ["Hàng tiêu dùng", "Đơn hàng thương mại điện tử", "Giao nhận trong ngày"],
    isDemo: true,
  },
  {
    id: "veh-trung",
    slug: "xe-tai-trung",
    name: "Xe tải trung",
    category: "medium",
    description: "Phù hợp khối lượng vừa, tuyến nội thành và liên tỉnh gần.",
    imageKey: "fleet-warehouse",
    suitableFor: ["Hàng tạp hóa, bách hóa", "Vận chuyển theo lô vừa"],
    isDemo: true,
  },
  {
    id: "veh-nang",
    slug: "xe-tai-nang",
    name: "Xe tải nặng",
    category: "heavy",
    description: "Phù hợp khối lượng lớn, tuyến liên tỉnh đường dài.",
    imageKey: "domestic-transport",
    suitableFor: ["Vận chuyển hàng công nghiệp", "Tuyến liên tỉnh đường dài"],
    isDemo: true,
  },
  {
    id: "veh-thung-kin",
    slug: "xe-thung-kin",
    name: "Xe thùng kín",
    category: "closed-box",
    description: "Bảo vệ hàng hóa khỏi thời tiết, phù hợp hàng cần che chắn.",
    imageKey: "cargo-loading",
    suitableFor: ["Hàng cần tránh mưa nắng", "Hàng dễ hư hỏng do thời tiết"],
    isDemo: true,
  },
  {
    id: "veh-thung-bat",
    slug: "xe-thung-bat",
    name: "Xe thùng bạt",
    category: "flatbed",
    description: "Linh hoạt bốc dỡ, phù hợp hàng hóa cồng kềnh.",
    imageKey: "domestic-transport",
    suitableFor: ["Hàng cồng kềnh", "Vật liệu xây dựng", "Hàng cần bốc dỡ nhanh"],
    isDemo: true,
  },
  {
    id: "veh-chuyen-dung",
    slug: "phuong-tien-chuyen-dung",
    name: "Phương tiện chuyên dụng",
    category: "specialized",
    description: "Dành cho hàng hóa có yêu cầu vận chuyển đặc thù, cần khảo sát riêng.",
    imageKey: "cargo-loading",
    suitableFor: ["Hàng quá khổ, quá tải", "Hàng cần thiết bị hỗ trợ riêng"],
    isDemo: true,
  },
];

export function getVehicleTypeBySlug(slug: string): VehicleType | undefined {
  return vehicleTypes.find((v) => v.slug === slug);
}
