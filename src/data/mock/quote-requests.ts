import type { QuoteRequest } from "@/types";

export const quoteRequests: QuoteRequest[] = [
  {
    id: "qr-demo-001",
    code: "BG-DEMO-001",
    customerName: "Nguyễn Văn An",
    customerPhone: "0901 234 567",
    pickupAddress: "Quận 7, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Biên Hòa, Đồng Nai",
    serviceSlug: "van-chuyen-lien-tinh",
    items: [{ cargoType: "Hàng bách hóa đóng thùng", weightKg: 850, quantity: 12 }],
    status: "confirmed",
    estimatedPriceNote: "Đã xác nhận và chuyển thành vận đơn VT-DEMO-001",
    createdAt: "2026-08-09T08:20:00+07:00",
    isDemo: true,
  },
  {
    id: "qr-demo-002",
    code: "BG-DEMO-002",
    customerName: "Nguyễn Văn An",
    customerPhone: "0901 234 567",
    pickupAddress: "TP. Thủ Đức, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Vũng Tàu, Bà Rịa – Vũng Tàu",
    serviceSlug: "thue-xe-tai-theo-chuyen",
    items: [{ cargoType: "Vật liệu xây dựng", weightKg: 1500, quantity: 1 }],
    status: "quoted",
    estimatedPriceNote: "Chi phí minh họa, chờ khách hàng xác nhận",
    createdAt: "2026-08-10T07:50:00+07:00",
    isDemo: true,
  },
  {
    id: "qr-demo-003",
    code: "BG-DEMO-003",
    customerName: "Nguyễn Văn An",
    customerPhone: "0901 234 567",
    pickupAddress: "Quận Bình Thạnh, TP. Hồ Chí Minh",
    dropoffAddress: "TP. Cần Thơ",
    serviceSlug: "van-chuyen-doanh-nghiep",
    items: [{ cargoType: "Hàng tiêu dùng đóng pallet", weightKg: 2200, quantity: 8 }],
    status: "pending",
    createdAt: "2026-08-10T13:10:00+07:00",
    isDemo: true,
  },
];

export function getQuoteRequestById(id: string): QuoteRequest | undefined {
  return quoteRequests.find((q) => q.id === id);
}
