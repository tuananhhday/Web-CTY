export interface NavItem {
  label: string;
  href: string;
}

export const mainNav: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Giới thiệu", href: "/gioi-thieu" },
  { label: "Dịch vụ", href: "/dich-vu" },
  { label: "Đội xe", href: "/doi-xe" },
  { label: "Bảng giá", href: "/bang-gia" },
  { label: "Tra cứu", href: "/tra-cuu" },
  { label: "Liên hệ", href: "/lien-he" },
];

export const footerServiceLinks: NavItem[] = [
  { label: "Vận chuyển hàng hóa", href: "/dich-vu/van-chuyen-hang-hoa" },
  { label: "Chuyển nhà, chuyển văn phòng", href: "/chuyen-nha" },
  { label: "Thuê xe tải theo chuyến", href: "/dich-vu/thue-xe-tai-theo-chuyen" },
  { label: "Vận chuyển cho doanh nghiệp", href: "/dich-vu/van-chuyen-doanh-nghiep" },
  { label: "Bốc xếp và nhân công", href: "/bang-gia/boc-xep" },
];

export const footerQuickLinks: NavItem[] = [
  { label: "Giới thiệu", href: "/gioi-thieu" },
  { label: "Khu vực phục vụ", href: "/khu-vuc-phuc-vu" },
  { label: "Bảng giá vận chuyển", href: "/bang-gia" },
  { label: "Câu hỏi thường gặp", href: "/faq" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: "Nguồn hình ảnh", href: "/nguon-hinh-anh" },
];

export const footerPolicyLinks: NavItem[] = [
  { label: "Chính sách bảo mật", href: "/chinh-sach/bao-mat" },
  { label: "Điều khoản sử dụng", href: "/chinh-sach/dieu-khoan" },
  { label: "Chính sách vận chuyển", href: "/chinh-sach/van-chuyen" },
  { label: "Chính sách cookie", href: "/chinh-sach/cookie" },
];

/** Điều hướng trong khu vực tài khoản khách hàng (§7.3). */
export const customerNav: NavItem[] = [
  { label: "Tổng quan", href: "/tai-khoan" },
  { label: "Yêu cầu", href: "/tai-khoan/yeu-cau" },
  { label: "Báo giá", href: "/tai-khoan/bao-gia" },
  { label: "Đơn hàng", href: "/tai-khoan/don-hang" },
  { label: "Hóa đơn", href: "/tai-khoan/hoa-don" },
  { label: "Hỗ trợ", href: "/tai-khoan/ho-tro" },
  { label: "Hồ sơ", href: "/tai-khoan/ho-so" },
];
