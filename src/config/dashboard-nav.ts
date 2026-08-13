export interface DashboardNavItem {
  label: string;
  href: string;
  icon: string;
}

export const dashboardNav: DashboardNavItem[] = [
  { label: "Tổng quan", href: "/tai-khoan", icon: "LayoutDashboard" },
  { label: "Yêu cầu", href: "/tai-khoan/yeu-cau", icon: "FileText" },
  { label: "Báo giá", href: "/tai-khoan/bao-gia", icon: "ReceiptText" },
  { label: "Đơn hàng", href: "/tai-khoan/don-hang", icon: "Package" },
  { label: "Hóa đơn", href: "/tai-khoan/hoa-don", icon: "ReceiptText" },
  { label: "Hỗ trợ", href: "/tai-khoan/ho-tro", icon: "LifeBuoy" },
  { label: "Thông báo", href: "/tai-khoan/thong-bao", icon: "Bell" },
  { label: "Hồ sơ", href: "/tai-khoan/ho-so", icon: "UserRound" },
];
