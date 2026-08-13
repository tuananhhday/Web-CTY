# Nguồn hình ảnh

> Nguồn dữ liệu duy nhất: [`src/data/image-sources.ts`](../src/data/image-sources.ts)
> Trang hiển thị công khai: `/nguon-hinh-anh`

## Nguyên tắc sử dụng ảnh trong dự án

- Chỉ dùng ảnh từ **Unsplash** (nguồn có giấy phép sử dụng rõ ràng).
- **Không** lấy ảnh từ Google Images, Facebook, website đối thủ hoặc nguồn không rõ bản quyền.
- **Không** dùng logo, biển số xe hoặc thương hiệu của đơn vị vận tải khác làm nhận diện cho công ty này.
- Mọi URL ảnh phải khai báo trong `src/data/image-sources.ts`, không hard-code trong component.
- Hostname ảnh remote được giới hạn đúng `images.unsplash.com` trong [`next.config.ts`](../next.config.ts) — không dùng wildcard rộng hơn mức cần thiết.
- Mỗi ảnh phải có `alt` tiếng Việt mô tả đúng nội dung.
- Ảnh hero dùng `priority`; các ảnh phía dưới dùng `loading="lazy"`.
- Mọi ảnh đều khai báo `sizes` phù hợp responsive và có màu nền fallback (`bg-navy/10`) khi ảnh chưa tải.
- Link ra trang nguồn dùng `target="_blank"` kèm `rel="noopener noreferrer"`.

## Danh sách ảnh đang sử dụng

### 1. Hero — xe tải trên đường cao tốc

- **ID:** `hero-truck-highway`
- **Mô tả (alt):** Xe tải container di chuyển trên đường cao tốc
- **Sử dụng tại:** Ảnh nền khu vực Hero trang chủ
- **Tải ưu tiên:** `priority` (ảnh LCP)
- **URL ảnh:** `https://images.unsplash.com/photo-1720127601642-7c3a7ba88f5f?auto=format&fit=crop&w=2000&q=85`
- **Trang nguồn:** https://unsplash.com/photos/a-large-semi-truck-driving-down-a-highway-VlAHPXYF9ok

### 2. Đội xe và kho bãi

- **ID:** `fleet-warehouse`
- **Mô tả (alt):** Đội xe tải và rơ moóc đậu trước kho bãi
- **Sử dụng tại:** Mục Đội xe trang chủ, trang `/gioi-thieu`, trang `/doi-xe`
- **Tải ảnh:** lazy
- **URL ảnh:** `https://images.unsplash.com/photo-1778015862504-b877b548266e?auto=format&fit=crop&w=1800&q=85`
- **Trang nguồn:** https://unsplash.com/photos/truck-and-trailers-parked-in-front-of-a-warehouse-xkAIwD0hsbg

### 3. Bốc xếp hàng hóa

- **ID:** `cargo-loading`
- **Mô tả (alt):** Xe nâng bốc xếp pallet hàng hóa lên xe tải
- **Sử dụng tại:** Mục Đội xe trang chủ, trang chi tiết dịch vụ, trang `/doi-xe`
- **Tải ảnh:** lazy
- **URL ảnh:** `https://images.unsplash.com/photo-1779517226273-bcf843b759b9?auto=format&fit=crop&w=1800&q=85`
- **Trang nguồn:** https://unsplash.com/photos/a-forklift-loads-pallets-of-goods-into-a-truck-qBD1__CH_MI

### 4. Vận tải nội địa

- **ID:** `domestic-transport`
- **Mô tả (alt):** Xe tải trắng di chuyển trên đường liên tỉnh
- **Sử dụng tại:** Mục Khu vực phục vụ trang chủ, trang `/doi-xe`
- **Tải ảnh:** lazy
- **URL ảnh:** `https://images.unsplash.com/photo-1774013603237-fcb40a354104?auto=format&fit=crop&w=1800&q=85`
- **Trang nguồn:** https://unsplash.com/photos/a-white-truck-drives-on-a-rural-road-4gVlgXmvIzY

## Kế hoạch thay thế

Toàn bộ 4 ảnh trên là **ảnh minh họa tạm thời**. Khi doanh nghiệp cung cấp ảnh thật (xem [`content-needed.md`](content-needed.md) mục 7):

1. Tải ảnh thật vào `public/images/` hoặc đưa lên CDN của doanh nghiệp.
2. Cập nhật `src/data/image-sources.ts` — đổi `url`, `sourcePageUrl`, `description`, `author`.
3. Nếu dùng CDN mới, bổ sung hostname vào `images.remotePatterns` trong `next.config.ts`.
4. Kiểm tra lại `alt` của từng ảnh mô tả đúng nội dung ảnh mới.
