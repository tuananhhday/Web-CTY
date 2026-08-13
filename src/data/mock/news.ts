import type { NewsArticle } from "@/types";

export const newsArticles: NewsArticle[] = [
  {
    id: "news-1",
    slug: "quy-trinh-tiep-nhan-yeu-cau-van-chuyen",
    title: "Quy trình tiếp nhận yêu cầu vận chuyển hoạt động như thế nào?",
    excerpt:
      "Tìm hiểu các bước từ khi gửi yêu cầu đến khi hàng hóa được giao, giúp khách hàng chuẩn bị thông tin đầy đủ hơn.",
    content:
      "Nội dung minh họa: bài viết mô tả quy trình 5 bước từ gửi yêu cầu, xác nhận hàng hóa, nhận báo giá, điều phối phương tiện đến theo dõi và giao hàng. Nội dung chi tiết cần đội ngũ nghiệp vụ biên soạn trước khi công bố chính thức.",
    publishedAt: "2026-07-28T09:00:00+07:00",
    category: "Hướng dẫn",
    isDemo: true,
  },
  {
    id: "news-2",
    slug: "chuan-bi-thong-tin-hang-hoa-truoc-khi-bao-gia",
    title: "Chuẩn bị thông tin hàng hóa trước khi yêu cầu báo giá",
    excerpt:
      "Một số lưu ý giúp khách hàng cung cấp thông tin hàng hóa chính xác, rút ngắn thời gian xác nhận báo giá.",
    content:
      "Nội dung minh họa: bài viết gợi ý các thông tin nên chuẩn bị như loại hàng, số kiện, trọng lượng ước tính, ảnh hàng hóa. Nội dung chi tiết cần đội ngũ nghiệp vụ biên soạn trước khi công bố chính thức.",
    publishedAt: "2026-08-02T09:00:00+07:00",
    category: "Hướng dẫn",
    isDemo: true,
  },
  {
    id: "news-3",
    slug: "cach-tra-cuu-trang-thai-don-hang",
    title: "Cách tra cứu trạng thái đơn hàng nhanh chóng",
    excerpt:
      "Hướng dẫn sử dụng mã vận đơn và số điện thoại để kiểm tra trạng thái vận chuyển hiện tại.",
    content:
      "Nội dung minh họa: bài viết hướng dẫn nhập mã vận đơn và số điện thoại tại trang Tra cứu để xem trạng thái vận chuyển theo thời gian. Nội dung chi tiết cần đội ngũ nghiệp vụ biên soạn trước khi công bố chính thức.",
    publishedAt: "2026-08-08T09:00:00+07:00",
    category: "Hướng dẫn",
    isDemo: true,
  },
];

export function getNewsBySlug(slug: string): NewsArticle | undefined {
  return newsArticles.find((n) => n.slug === slug);
}
