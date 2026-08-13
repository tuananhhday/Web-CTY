# Trạng thái frontend

> Cập nhật: 2026-08-10 — Giai đoạn 1: hoàn thiện giao diện, toàn bộ chức năng chạy `DEMO_MODE`.

## 1. DEMO_MODE là gì

Cờ `DEMO_MODE` khai báo tại [`src/lib/demo.ts`](../src/lib/demo.ts). Ở giai đoạn này:

- **Không** có database
- **Không** có API route
- **Không** có xác thực thật (không tạo session, không lưu token, không lưu mật khẩu)
- **Không** gọi mô hình AI thật
- **Không** có thanh toán

Mọi biểu mẫu chỉ validate phía trình duyệt bằng Zod rồi hiển thị phản hồi mô phỏng, **không gửi dữ liệu đi đâu**. Mọi màn hình mô phỏng đều có nhãn `DEMO_MODE` hoặc "Chế độ xem thử" hiển thị rõ cho người dùng.

## 2. Danh sách trang đã tạo

### Trang public — 15 route

| Route | Nội dung |
|---|---|
| `/` | Trang chủ đầy đủ 10 section |
| `/gioi-thieu` | Giới thiệu doanh nghiệp (bản nháp) |
| `/dich-vu` | Danh sách 6 dịch vụ |
| `/dich-vu/[slug]` | Chi tiết dịch vụ (6 trang tĩnh) |
| `/doi-xe` | 6 nhóm phương tiện, có anchor theo slug |
| `/bao-gia` | Form yêu cầu báo giá đầy đủ |
| `/tra-cuu` | Tra cứu vận đơn + bảng trạng thái |
| `/uoc-tinh-ai` | Mockup nhận diện hàng hóa từ ảnh |
| `/tin-tuc` | Danh sách bài viết |
| `/tin-tuc/[slug]` | Chi tiết bài viết (3 trang tĩnh) |
| `/lien-he` | Form liên hệ + thông tin doanh nghiệp |
| `/nguon-hinh-anh` | Nguồn 4 ảnh Unsplash |
| `/chinh-sach-bao-mat` | Bản nháp pháp lý |
| `/dieu-khoan-su-dung` | Bản nháp pháp lý |
| `not-found` | Trang 404 |

### Trang tài khoản — 5 route

| Route | Nội dung |
|---|---|
| `/dang-nhap` | Form đăng nhập, chuyển tới dashboard mẫu |
| `/dang-ky` | Form đăng ký + kiểm tra độ mạnh mật khẩu |
| `/quen-mat-khau` | Form khôi phục mật khẩu |
| `/dat-lai-mat-khau` | Form đặt mật khẩu mới |
| `/xac-thuc-email` | Màn hình hướng dẫn xác thực email |

### Dashboard khách hàng — 6 route

| Route | Nội dung |
|---|---|
| `/khach-hang/tong-quan` | 3 thẻ số liệu, hành động nhanh, timeline đơn gần nhất |
| `/khach-hang/bao-gia` | Bảng yêu cầu báo giá |
| `/khach-hang/don-hang` | Danh sách đơn hàng |
| `/khach-hang/don-hang/[id]` | Chi tiết hành trình (3 trang tĩnh) |
| `/khach-hang/thong-bao` | Danh sách thông báo, phân biệt đã/chưa đọc |
| `/khach-hang/ho-so` | Form hồ sơ khách hàng |

Kèm `loading.tsx` (skeleton) và `error.tsx` (không lộ stack trace) cho khu vực dashboard.

## 3. Chức năng đang mô phỏng

| Chức năng | Hành vi hiện tại | Cần làm ở giai đoạn sau |
|---|---|---|
| Ước tính chi phí | Validate rồi hiện thông báo "chưa thể đưa ra mức giá" — **không tự sinh giá giả** | Tính giá theo công thức nghiệp vụ thật |
| Tra cứu vận đơn | Tra trên mock data; `VT-DEMO-001/002/003` có kết quả, mã khác báo không tìm thấy | Gọi API tra cứu thật |
| Gửi yêu cầu báo giá | Validate + phản hồi mô phỏng, không lưu | POST tới API, ghi vào `QuoteRequest` |
| Liên hệ | Validate + phản hồi mô phỏng, không lưu | POST tới API, ghi vào `ContactLead` |
| Đăng nhập | Không xác thực, chỉ điều hướng sang dashboard mẫu | Tích hợp xác thực thật + session |
| Đăng ký | Không tạo tài khoản, không lưu mật khẩu | Tạo `User`, hash mật khẩu, gửi email xác thực |
| Quên / đặt lại mật khẩu | Không gửi email, không đổi mật khẩu | Sinh token `Verification`, gửi email thật |
| Ước tính AI từ ảnh | Ảnh chỉ hiển thị bằng blob URL trong trình duyệt; kết quả là dữ liệu cố định | Upload ảnh, gọi mô hình, ghi `CargoImage` + `AiAnalysis` |
| Hồ sơ khách hàng | Không lưu thay đổi | PATCH tới API |
| Thông báo | Danh sách tĩnh, chưa đánh dấu đã đọc được | API đánh dấu đã đọc |

## 4. Kiến trúc thư mục

```
src/
├── app/
│   ├── (public)/          # Route group dùng Header + Footer
│   ├── (auth)/            # Route group layout riêng cho đăng nhập/đăng ký
│   ├── khach-hang/        # Dashboard, layout riêng có sidebar
│   ├── layout.tsx         # Root layout: font, metadata, skip link
│   ├── not-found.tsx
│   └── globals.css        # Design tokens + Tailwind theme
├── components/
│   ├── ui/                # Primitive: button, input, card, tabs, accordion...
│   ├── layout/            # Header, Footer, TopBar, Logo
│   ├── home/              # 10 section trang chủ
│   ├── shared/            # Form và block dùng lại nhiều trang
│   ├── auth/              # 4 form xác thực
│   └── dashboard/         # Shell, nav, empty state, profile form
├── config/                # company.ts, nav.ts, dashboard-nav.ts
├── data/
│   ├── mock/              # Toàn bộ mock data, mỗi bản ghi có isDemo
│   └── image-sources.ts
├── lib/                   # utils, format, validations (Zod), demo
└── types/                 # Type dùng chung
```

## 5. Design system

| Token | Giá trị |
|---|---|
| Navy chính | `#0B1F33` |
| Navy sáng | `#163A5F` |
| Cam CTA (nền nút) | `#F97316` |
| Cam hover (nền nút) | `#EA580C` |
| Cam cho **chữ trên nền sáng** | `#C2410C` |
| Cam cho **chữ trên nền sáng** (hover) | `#9A3412` |
| Nền sáng | `#F7F9FC` |
| Chữ | `#142033` |
| Thành công | `#15803D` |
| Cảnh báo | `#B45309` |
| Lỗi | `#B91C1C` |
| Font | Be Vietnam Pro (subset `latin` + `vietnamese`) |
| Bề rộng nội dung | 1280px |

Không dùng gradient tím, không dùng hiệu ứng kính, không dùng emoji thay icon (toàn bộ icon từ `lucide-react`).

### Ghi chú về màu cam và WCAG AA

Cam thương hiệu `#F97316` với **chữ trắng** chỉ đạt tương phản **2.80:1**, không đạt WCAG AA (yêu cầu 4.5:1). Cách xử lý đã thống nhất:

| Ngữ cảnh | Cách dùng | Tương phản |
|---|---|---|
| Nút CTA | Nền `#F97316` + chữ navy `#0B1F33` | 5.96:1 ✅ |
| Nút CTA (hover) | Nền `#EA580C` + chữ navy | 4.69:1 ✅ |
| Chữ/icon cam trên nền sáng | `#C2410C` (token `text-orange-text`) | 5.18:1 ✅ |
| Chữ/icon cam trên nền navy | `#F97316` giữ nguyên | 5.96:1 ✅ |
| Focus ring | `#C2410C` (token `ring-orange-text`) | 5.18:1 ✅ |

Màu thương hiệu `#F97316` và `#EA580C` được giữ nguyên 100% làm màu nền nút và điểm nhấn.

## 6. Bảo mật đã áp dụng ở tầng giao diện

- Không dùng `dangerouslySetInnerHTML` ở bất kỳ đâu
- Không lưu mật khẩu / session giả vào `localStorage` hay `sessionStorage`
- Không có API key trong mã nguồn frontend
- Không gửi form tới endpoint chưa tồn tại
- `images.remotePatterns` chỉ cho phép `images.unsplash.com`
- Mọi link ngoài có `target="_blank"` đều kèm `rel="noopener noreferrer"`
- Toàn bộ input đều có schema Zod ([`src/lib/validations.ts`](../src/lib/validations.ts))
- `error.tsx` không hiển thị stack trace cho người dùng
- Trang dashboard đặt `robots: { index: false }`
- Ảnh tải lên ở `/uoc-tinh-ai` được kiểm tra MIME type và giới hạn 8 MB, chỉ xử lý trong trình duyệt

## 7. Accessibility

- Skip link "Bỏ qua đến nội dung chính"
- Semantic HTML: `header`, `nav`, `main`, `aside`, `footer`, `article`, `section`
- Heading theo đúng thứ tự, mỗi trang một `h1`
- Mọi input có `<label>` liên kết bằng `htmlFor`
- Lỗi validation dùng `role="alert"` và `aria-invalid`
- Nút chỉ có icon đều có `aria-label`
- Nav item hiện tại có `aria-current="page"`
- Modal/drawer dùng Radix Dialog (focus trap, đóng bằng Esc, có `SheetTitle` ẩn cho screen reader)
- Focus state rõ ràng: `focus-visible:ring-2 ring-orange`
- Hỗ trợ `prefers-reduced-motion` trong `globals.css`
- Nút bấm mobile tối thiểu cao 44px (`h-11`)
- Bảng dữ liệu có `<caption class="sr-only">` và `scope="col"`

## 8. Việc chưa làm

- [ ] Kết nối database (chờ duyệt giao diện)
- [ ] API routes
- [ ] Xác thực thật
- [ ] Tích hợp AI thật
- [ ] Content Security Policy header (đã chuẩn bị nguyên tắc, chưa thêm header vì cần xác định domain triển khai)
- [ ] Sitemap / robots.txt
- [ ] Thay ảnh minh họa bằng ảnh thật của doanh nghiệp
