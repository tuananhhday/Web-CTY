/**
 * Cấu hình thông tin doanh nghiệp — nguồn duy nhất (single source of truth).
 * Toàn bộ component phải import từ đây, KHÔNG hard-code lặp lại thông tin doanh nghiệp.
 *
 * TRẠNG THÁI: Thông tin minh họa (placeholder). Chưa có dữ liệu thật từ doanh nghiệp.
 * Xem docs/content-needed.md để biết danh sách thông tin cần cung cấp trước khi go-live.
 * KHÔNG tự ý thay các placeholder bằng số liệu tự bịa (số năm hoạt động, số xe, tỷ lệ
 * đúng hạn, chứng nhận, đối tác, đánh giá khách hàng...).
 */

export const company = {
  name: "Công ty TNHH Vận Tuấn Anh",
  shortName: "TA Logistics",
  slogan: "Vận chuyển chủ động – Giao hàng đúng kế hoạch",
  phone: "0968773550",
  zalo: "0968773550",
  email: "tanh2811@gmail.com",
  address: "379 Đ. Giáp Hải, Bát Tràng, Hà Nội, Việt Nam",
  taxCode: "Thông tin minh họa — cần mã số thuế thật",
  workingHours: "Thứ 2 – Thứ 7: 08:00 – 18:00 (nghỉ Chủ nhật và ngày lễ)",
} as const;

/** Mạng xã hội — chưa có tài khoản chính thức, để trống chờ doanh nghiệp cung cấp. */
export const socialLinks = {
  facebook: "",
  zaloOa: "",
  youtube: "",
} as const;

/**
 * Danh sách khu vực phục vụ — dữ liệu cấu hình tạm thời để dễ thay thế sau này.
 * Chưa xác nhận phạm vi phủ toàn quốc; hiển thị kèm ghi chú "xác nhận theo yêu cầu".
 */
export const serviceAreas: { region: string; provinces: string[]; isDemo: true }[] = [
  {
    region: "Miền Bắc",
    provinces: ["Hà Nội", "Hải Phòng", "Bắc Ninh", "Quảng Ninh"],
    isDemo: true,
  },
  {
    region: "Miền Trung",
    provinces: ["Đà Nẵng", "Huế", "Khánh Hòa"],
    isDemo: true,
  },
  {
    region: "Miền Nam",
    provinces: ["TP. Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Long An"],
    isDemo: true,
  },
];

export const legalNotice =
  "Nội dung pháp lý trong trang này là bản nháp minh họa, cần doanh nghiệp rà soát và phê duyệt trước khi công bố chính thức.";
