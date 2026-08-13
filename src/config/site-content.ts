/**
 * Nội dung biên tập tĩnh của website.
 *
 * Khác với src/data/mock/: đây KHÔNG phải dữ liệu giả chờ thay bằng dữ liệu thật, mà là
 * nội dung do đội ngũ soạn và chỉ đổi khi có quyết định biên tập. Không chứa số liệu
 * hay tuyên bố cần doanh nghiệp xác minh (§1).
 */
import type { BenefitItem, ProcessStep } from "@/types";


export const benefits: BenefitItem[] = [
  {
    title: "Tiếp nhận thông tin có cấu trúc",
    description: "Yêu cầu vận chuyển được ghi nhận đầy đủ, hạn chế thiếu sót khi trao đổi.",
    icon: "ClipboardList",
  },
  {
    title: "Theo dõi trạng thái tập trung",
    description: "Xem trạng thái vận chuyển tại một nơi duy nhất, không cần trao đổi qua nhiều kênh.",
    icon: "Radar",
  },
  {
    title: "Dễ dàng đối chiếu yêu cầu",
    description: "Lịch sử yêu cầu và báo giá được lưu lại rõ ràng, tiện đối chiếu khi cần.",
    icon: "FileSearch",
  },
  {
    title: "Hỗ trợ lựa chọn phương tiện",
    description: "Thông tin nhóm phương tiện giúp khách hàng hình dung lựa chọn phù hợp.",
    icon: "Truck",
  },
  {
    title: "Lưu lịch sử báo giá và vận chuyển",
    description: "Toàn bộ báo giá và đơn hàng trước đó được lưu trong tài khoản khách hàng.",
    icon: "History",
  },
  {
    title: "Thông tin liên hệ rõ ràng",
    description: "Kênh liên hệ hotline, email hiển thị nhất quán trên toàn bộ website.",
    icon: "PhoneCall",
  },
];


export const processSteps: ProcessStep[] = [
  {
    step: 1,
    title: "Gửi yêu cầu",
    description: "Khách hàng gửi thông tin điểm lấy hàng, điểm giao và loại hàng hóa.",
  },
  {
    step: 2,
    title: "Xác nhận hàng hóa",
    description: "Đội ngũ vận hành kiểm tra và xác nhận chi tiết hàng hóa cần vận chuyển.",
  },
  {
    step: 3,
    title: "Nhận báo giá",
    description: "Khách hàng nhận báo giá dựa trên thông tin đã xác nhận.",
  },
  {
    step: 4,
    title: "Điều phối phương tiện",
    description: "Hệ thống điều phối phương tiện phù hợp với khối lượng và lộ trình.",
  },
  {
    step: 5,
    title: "Theo dõi và giao hàng",
    description: "Khách hàng theo dõi trạng thái vận chuyển đến khi giao hàng thành công.",
  },
];
