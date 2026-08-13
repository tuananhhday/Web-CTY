import type { ImageSource } from "@/types";

/**
 * Toàn bộ ảnh Unsplash dùng trong website — mọi component phải lấy URL từ đây,
 * không hard-code URL ảnh trong component. Trang /nguon-hinh-anh render danh sách này.
 */
export const imageSources: ImageSource[] = [
  {
    id: "hero-truck-highway",
    url: "https://images.unsplash.com/photo-1720127601642-7c3a7ba88f5f?auto=format&fit=crop&w=2000&q=85",
    sourcePageUrl: "https://unsplash.com/photos/a-large-semi-truck-driving-down-a-highway-VlAHPXYF9ok",
    description: "Xe tải container di chuyển trên đường cao tốc",
    author: "Unsplash",
    usage: "Ảnh nền khu vực Hero trang chủ",
  },
  {
    id: "fleet-warehouse",
    url: "https://images.unsplash.com/photo-1778015862504-b877b548266e?auto=format&fit=crop&w=1800&q=85",
    sourcePageUrl: "https://unsplash.com/photos/truck-and-trailers-parked-in-front-of-a-warehouse-xkAIwD0hsbg",
    description: "Đội xe tải và rơ moóc đậu trước kho bãi",
    author: "Unsplash",
    usage: "Minh họa mục Đội xe & kho bãi",
  },
  {
    id: "cargo-loading",
    url: "https://images.unsplash.com/photo-1779517226273-bcf843b759b9?auto=format&fit=crop&w=1800&q=85",
    sourcePageUrl: "https://unsplash.com/photos/a-forklift-loads-pallets-of-goods-into-a-truck-qBD1__CH_MI",
    description: "Xe nâng bốc xếp pallet hàng hóa lên xe tải",
    author: "Unsplash",
    usage: "Minh họa quy trình vận chuyển / dịch vụ bốc xếp",
  },
  {
    id: "domestic-transport",
    url: "https://images.unsplash.com/photo-1774013603237-fcb40a354104?auto=format&fit=crop&w=1800&q=85",
    sourcePageUrl: "https://unsplash.com/photos/a-white-truck-drives-on-a-rural-road-4gVlgXmvIzY",
    description: "Xe tải trắng di chuyển trên đường liên tỉnh",
    author: "Unsplash",
    usage: "Minh họa dịch vụ vận chuyển liên tỉnh / nội địa",
  },
];

export function getImageSource(id: string): ImageSource {
  const found = imageSources.find((img) => img.id === id);
  if (!found) {
    throw new Error(`Không tìm thấy nguồn ảnh với id: ${id}`);
  }
  return found;
}
