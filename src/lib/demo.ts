/**
 * DEMO_MODE — toàn bộ chức năng nghiệp vụ trong giai đoạn này chạy trên dữ liệu mô phỏng.
 * Không có API, không có database, không có xác thực thật, không gọi AI thật.
 * Khi chuyển sang giai đoạn backend, đặt cờ này về false và thay bằng gọi API thật.
 */
export const DEMO_MODE = true;

export const DEMO_NOTICE = {
  estimate:
    "Chức năng đang sử dụng dữ liệu minh họa. Chi phí chính thức sẽ được xác nhận sau khi có đầy đủ thông tin hàng hóa.",
  tracking:
    "Kết quả tra cứu là dữ liệu mô phỏng. Sử dụng mã VT-DEMO-001 để xem ví dụ hành trình.",
  auth: "Chế độ xem thử: không có hệ thống đăng nhập thật, không tạo phiên đăng nhập và không lưu mật khẩu.",
  ai: "Kết quả AI chỉ mang tính tham khảo, không thay thế cân đo và xác nhận nghiệp vụ.",
  form: "Biểu mẫu đang ở chế độ mô phỏng: dữ liệu không được gửi đi và không được lưu trữ ở bất kỳ đâu.",
} as const;

/** Giả lập độ trễ mạng để kiểm tra loading state của giao diện. */
export function simulateDelay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
