import type { Service } from "@/types";

/**
 * Danh sách dịch vụ — nội dung minh họa, cần doanh nghiệp xác nhận danh mục dịch vụ
 * thực tế trước khi công bố (xem docs/content-needed.md).
 */
export const services: Service[] = [
  {
    id: "svc-noi-thanh",
    slug: "van-chuyen-noi-thanh",
    name: "Vận chuyển nội thành",
    shortDescription: "Giao nhận hàng hóa trong phạm vi nội thành, thời gian linh hoạt.",
    description:
      "Dịch vụ vận chuyển hàng hóa trong nội thành dành cho cửa hàng, doanh nghiệp nhỏ và cá nhân có nhu cầu giao nhận nhanh trong ngày. Phương tiện và thời gian giao nhận được xác nhận theo từng yêu cầu cụ thể.",
    icon: "Truck",
    highlights: [
      "Phù hợp đơn hàng khối lượng nhỏ và vừa",
      "Xác nhận thời gian lấy/giao theo yêu cầu",
      "Theo dõi trạng thái vận chuyển tập trung",
    ],
    isDemo: true,
  },
  {
    id: "svc-lien-tinh",
    slug: "van-chuyen-lien-tinh",
    name: "Vận chuyển liên tỉnh",
    shortDescription: "Kết nối vận chuyển hàng hóa giữa các tỉnh, thành phố.",
    description:
      "Dịch vụ vận chuyển hàng hóa giữa các tỉnh thành, phù hợp với nhu cầu luân chuyển hàng định kỳ hoặc theo chuyến. Phạm vi phục vụ cụ thể được xác nhận theo từng tuyến đường.",
    icon: "MapPinned",
    highlights: [
      "Hỗ trợ vận chuyển theo tuyến cố định hoặc theo yêu cầu",
      "Cập nhật trạng thái hành trình",
      "Tư vấn phương tiện phù hợp với loại hàng",
    ],
    isDemo: true,
  },
  {
    id: "svc-thue-xe-chuyen",
    slug: "thue-xe-tai-theo-chuyen",
    name: "Thuê xe tải theo chuyến",
    shortDescription: "Thuê phương tiện theo từng chuyến, chủ động lịch trình.",
    description:
      "Dành cho khách hàng có nhu cầu thuê xe tải riêng cho một chuyến vận chuyển cụ thể, chủ động về thời gian lấy hàng, lộ trình và điểm giao.",
    icon: "CalendarClock",
    highlights: [
      "Chủ động lịch trình vận chuyển",
      "Đa dạng loại xe theo nhu cầu hàng hóa",
      "Báo giá theo chuyến sau khi xác nhận thông tin",
    ],
    isDemo: true,
  },
  {
    id: "svc-doanh-nghiep",
    slug: "van-chuyen-doanh-nghiep",
    name: "Vận chuyển cho doanh nghiệp",
    shortDescription: "Giải pháp vận chuyển định kỳ dành cho khách hàng doanh nghiệp.",
    description:
      "Giải pháp vận chuyển dành cho doanh nghiệp có nhu cầu luân chuyển hàng hóa định kỳ, cần đầu mối liên hệ cố định và lịch sử vận chuyển được lưu trữ tập trung.",
    icon: "Building2",
    highlights: [
      "Đầu mối phối hợp cố định",
      "Lưu trữ lịch sử báo giá và vận chuyển",
      "Hỗ trợ nhiều điểm giao nhận trong một yêu cầu",
    ],
    isDemo: true,
  },
  {
    id: "svc-chuyen-kho",
    slug: "chuyen-kho-van-phong",
    name: "Chuyển kho và văn phòng",
    shortDescription: "Hỗ trợ vận chuyển khi thay đổi địa điểm kho, văn phòng.",
    description:
      "Dịch vụ hỗ trợ doanh nghiệp trong quá trình chuyển địa điểm kho hàng hoặc văn phòng, bao gồm phối hợp thời gian, phương tiện phù hợp với khối lượng và tính chất tài sản cần di chuyển.",
    icon: "Warehouse",
    highlights: [
      "Khảo sát và xác nhận khối lượng trước khi thực hiện",
      "Phối hợp thời gian phù hợp hoạt động doanh nghiệp",
      "Hỗ trợ đóng gói theo thỏa thuận",
    ],
    isDemo: true,
  },
  {
    id: "svc-hang-cong-kenh",
    slug: "hang-cong-kenh-theo-yeu-cau",
    name: "Hàng cồng kềnh theo yêu cầu",
    shortDescription: "Vận chuyển hàng hóa kích thước lớn, cần khảo sát riêng.",
    description:
      "Dành cho hàng hóa có kích thước hoặc trọng lượng vượt mức thông thường, cần khảo sát thực tế để đề xuất phương tiện và phương án vận chuyển phù hợp.",
    icon: "PackageSearch",
    highlights: [
      "Khảo sát và tư vấn phương án riêng",
      "Đề xuất loại xe phù hợp với kích thước hàng",
      "Xác nhận chi tiết trước khi báo giá chính thức",
    ],
    isDemo: true,
  },
];

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
