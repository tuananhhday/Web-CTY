import type { Shipment } from "@/types";

/**
 * Vận đơn minh họa. Mã "VT-DEMO-001" được dùng cố định cho chức năng tra cứu demo
 * ở trang chủ và trang /tra-cuu — mọi mã khác trả về "không tìm thấy".
 */
export const shipments: Shipment[] = [
  {
    id: "shp-demo-001",
    code: "VT-DEMO-001",
    status: "in_transit",
    pickupAddress: "Quận 7, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Biên Hòa, Đồng Nai",
    vehicleTypeName: "Xe tải trung",
    items: [{ cargoType: "Hàng bách hóa đóng thùng", weightKg: 850, quantity: 12 }],
    estimatedDelivery: "2026-08-11T17:00:00+07:00",
    createdAt: "2026-08-09T08:30:00+07:00",
    isDemo: true,
    trackingEvents: [
      {
        id: "evt-1",
        status: "requested",
        title: "Đã tiếp nhận yêu cầu",
        description: "Yêu cầu vận chuyển được ghi nhận trên hệ thống.",
        location: "TP. Hồ Chí Minh",
        timestamp: "2026-08-09T08:30:00+07:00",
        isDemo: true,
      },
      {
        id: "evt-2",
        status: "confirmed",
        title: "Đã xác nhận đơn hàng",
        description: "Thông tin hàng hóa và phương tiện đã được xác nhận.",
        location: "TP. Hồ Chí Minh",
        timestamp: "2026-08-09T10:15:00+07:00",
        isDemo: true,
      },
      {
        id: "evt-3",
        status: "picked_up",
        title: "Đã lấy hàng",
        description: "Tài xế đã tiếp nhận hàng hóa tại điểm lấy hàng.",
        location: "Quận 7, TP. Hồ Chí Minh",
        timestamp: "2026-08-10T07:45:00+07:00",
        isDemo: true,
      },
      {
        id: "evt-4",
        status: "in_transit",
        title: "Đang vận chuyển",
        description: "Hàng hóa đang trên đường đến điểm giao.",
        location: "Cao tốc TP.HCM – Long Thành – Dầu Giây",
        timestamp: "2026-08-10T09:20:00+07:00",
        isDemo: true,
      },
    ],
  },
  {
    id: "shp-demo-002",
    code: "VT-DEMO-002",
    status: "delivered",
    pickupAddress: "Quận Bình Thạnh, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Thủ Dầu Một, Bình Dương",
    vehicleTypeName: "Xe tải nhẹ",
    items: [{ cargoType: "Thiết bị văn phòng", weightKg: 320, quantity: 5 }],
    estimatedDelivery: "2026-08-07T16:00:00+07:00",
    createdAt: "2026-08-06T09:00:00+07:00",
    isDemo: true,
    trackingEvents: [
      {
        id: "evt-1",
        status: "requested",
        title: "Đã tiếp nhận yêu cầu",
        description: "Yêu cầu vận chuyển được ghi nhận trên hệ thống.",
        timestamp: "2026-08-06T09:00:00+07:00",
        isDemo: true,
      },
      {
        id: "evt-2",
        status: "delivered",
        title: "Đã giao thành công",
        description: "Hàng hóa đã được giao đến người nhận.",
        location: "TP. Thủ Dầu Một, Bình Dương",
        timestamp: "2026-08-07T15:40:00+07:00",
        isDemo: true,
      },
    ],
  },
  {
    id: "shp-demo-003",
    code: "VT-DEMO-003",
    status: "confirmed",
    pickupAddress: "TP. Thủ Đức, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Vũng Tàu, Bà Rịa – Vũng Tàu",
    vehicleTypeName: "Xe thùng bạt",
    items: [{ cargoType: "Vật liệu xây dựng", weightKg: 1500, quantity: 1 }],
    estimatedDelivery: "2026-08-12T18:00:00+07:00",
    createdAt: "2026-08-10T08:00:00+07:00",
    isDemo: true,
    trackingEvents: [
      {
        id: "evt-1",
        status: "requested",
        title: "Đã tiếp nhận yêu cầu",
        description: "Yêu cầu vận chuyển được ghi nhận trên hệ thống.",
        timestamp: "2026-08-10T08:00:00+07:00",
        isDemo: true,
      },
      {
        id: "evt-2",
        status: "confirmed",
        title: "Đã xác nhận đơn hàng",
        description: "Thông tin hàng hóa và phương tiện đã được xác nhận.",
        timestamp: "2026-08-10T11:00:00+07:00",
        isDemo: true,
      },
    ],
  },
];

export function getShipmentByCode(code: string): Shipment | undefined {
  return shipments.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
}

export function getShipmentById(id: string): Shipment | undefined {
  return shipments.find((s) => s.id === id);
}

export const shipmentStatusLabels: Record<Shipment["status"], string> = {
  requested: "Đã tiếp nhận yêu cầu",
  confirmed: "Đã xác nhận",
  picked_up: "Đã lấy hàng",
  in_transit: "Đang vận chuyển",
  out_for_delivery: "Đang giao hàng",
  delivered: "Đã giao thành công",
  exception: "Có vấn đề phát sinh",
};
