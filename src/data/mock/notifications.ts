import type { AppNotification } from "@/types";

export const notifications: AppNotification[] = [
  {
    id: "noti-1",
    title: "Đơn hàng VT-DEMO-001 đang vận chuyển",
    message: "Hàng hóa đã rời điểm lấy hàng và đang trên đường đến điểm giao.",
    type: "info",
    read: false,
    createdAt: "2026-08-10T09:20:00+07:00",
    isDemo: true,
  },
  {
    id: "noti-2",
    title: "Báo giá BG-DEMO-002 đã sẵn sàng",
    message: "Chi phí minh họa cho yêu cầu vận chuyển của bạn đã được cập nhật.",
    type: "success",
    read: false,
    createdAt: "2026-08-10T08:05:00+07:00",
    isDemo: true,
  },
  {
    id: "noti-3",
    title: "Đơn hàng VT-DEMO-002 đã giao thành công",
    message: "Cảm ơn bạn đã sử dụng dịch vụ. Vui lòng kiểm tra hàng hóa nhận được.",
    type: "success",
    read: true,
    createdAt: "2026-08-07T15:45:00+07:00",
    isDemo: true,
  },
  {
    id: "noti-4",
    title: "Yêu cầu BG-DEMO-003 đang chờ xử lý",
    message: "Đội ngũ vận hành sẽ liên hệ xác nhận thông tin hàng hóa trong thời gian sớm nhất.",
    type: "warning",
    read: true,
    createdAt: "2026-08-10T13:15:00+07:00",
    isDemo: true,
  },
];
