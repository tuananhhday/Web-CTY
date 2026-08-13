/**
 * Kiểu dữ liệu dùng chung cho toàn bộ frontend (giai đoạn giao diện + mock data).
 * Các entity tương ứng với bảng trong prisma/schema.prisma sẽ được đồng bộ ở giai đoạn sau.
 */

export interface DemoFlagged {
  /** Đánh dấu dữ liệu minh họa — chưa lấy từ hệ thống thật. */
  isDemo: true;
}

export interface CompanyInfo {
  name: string;
  shortName: string;
  slogan: string;
  phone: string;
  zalo: string;
  email: string;
  address: string;
  taxCode: string;
  workingHours: string;
}

export interface Service extends DemoFlagged {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** Tên icon trong lucide-react, vd: "Truck", "Building2" */
  icon: string;
  highlights: string[];
}

export type VehicleCategory =
  | "light"
  | "medium"
  | "heavy"
  | "closed-box"
  | "flatbed"
  | "specialized";

export interface VehicleType extends DemoFlagged {
  id: string;
  slug: string;
  name: string;
  category: VehicleCategory;
  description: string;
  imageKey: string;
  suitableFor: string[];
}

export type QuoteRequestStatus = "pending" | "quoted" | "confirmed" | "rejected";

export interface QuoteRequestItem {
  cargoType: string;
  weightKg: number;
  quantity: number;
  note?: string;
}

export interface QuoteRequest extends DemoFlagged {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  serviceSlug: string;
  items: QuoteRequestItem[];
  status: QuoteRequestStatus;
  estimatedPriceNote?: string;
  createdAt: string;
}

export type ShipmentStatus =
  | "requested"
  | "confirmed"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface TrackingEvent extends DemoFlagged {
  id: string;
  status: ShipmentStatus;
  title: string;
  description: string;
  location?: string;
  timestamp: string;
}

export interface ShipmentItem {
  cargoType: string;
  weightKg: number;
  quantity: number;
}

export interface Shipment extends DemoFlagged {
  id: string;
  code: string;
  status: ShipmentStatus;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleTypeName: string;
  items: ShipmentItem[];
  estimatedDelivery?: string;
  createdAt: string;
  trackingEvents: TrackingEvent[];
}

export type UserRole = "customer" | "admin";

export interface User extends DemoFlagged {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  companyName?: string;
}

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification extends DemoFlagged {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface ImageSource {
  id: string;
  url: string;
  sourcePageUrl: string;
  description: string;
  author?: string;
  usage: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
}

export interface BenefitItem {
  title: string;
  description: string;
  icon: string;
}

export interface NewsArticle extends DemoFlagged {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  category: string;
}
