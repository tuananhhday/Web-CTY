import type { User } from "@/types";

/** Người dùng demo dùng cho chế độ xem thử dashboard (DEMO_MODE). */
export const demoUser: User = {
  id: "user-demo-001",
  name: "Nguyễn Văn An",
  email: "nguyenvanan@example.com",
  phone: "0901 234 567",
  role: "customer",
  companyName: "Công ty TNHH Thương mại An Phát",
  isDemo: true,
};
