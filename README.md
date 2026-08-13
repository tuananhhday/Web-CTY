# Website công ty vận tải

Website giới thiệu dịch vụ và tiếp nhận yêu cầu vận chuyển hàng hóa, xây dựng bằng Next.js App Router.

> ## ⚠️ Giai đoạn hiện tại: `DEMO_MODE`
>
> Dự án đang ở **giai đoạn hoàn thiện giao diện**. Toàn bộ chức năng nghiệp vụ chạy trên **dữ liệu mô phỏng**:
>
> - Không có database — không có API — không có xác thực thật
> - Không gọi AI thật — không có thanh toán
> - Biểu mẫu chỉ validate trên trình duyệt, **không gửi dữ liệu đi đâu và không lưu trữ**
> - Nút "Đăng nhập" chỉ điều hướng sang dashboard mẫu, **không tạo phiên đăng nhập**
>
> Mọi màn hình mô phỏng đều hiển thị nhãn `DEMO_MODE` / "Chế độ xem thử" cho người dùng.
> **Không được xem đây là hệ thống đã hoạt động.**

## Công nghệ

| Thành phần | Phiên bản |
|---|---|
| Next.js (App Router, Turbopack) | 16 |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| Radix UI primitives | — |
| Lucide Icons | — |
| React Hook Form + Zod | — |
| Prisma (chỉ chuẩn bị schema) | 7 |
| ESLint | 9 |

Package manager: **npm**

## Chạy dự án

Cài đặt dependency:

```bash
npm install
```

Chạy môi trường phát triển:

```bash
npm run dev
```

Mở http://localhost:3000

Build production:

```bash
npm run build
```

Chạy bản build:

```bash
npm start
```

## Kiểm tra chất lượng

Lint:

```bash
npm run lint
```

Kiểm tra kiểu TypeScript:

```bash
npx tsc --noEmit
```

Định dạng schema Prisma:

```bash
npx prisma format
```

Kiểm tra schema Prisma:

```bash
npx prisma validate
```

> Không chạy `prisma migrate` hoặc `prisma db push` ở giai đoạn này — chưa kết nối database thật.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── (public)/       # Trang công khai, dùng Header + Footer
│   ├── (auth)/         # Đăng nhập, đăng ký, quên mật khẩu...
│   ├── khach-hang/     # Dashboard mẫu, layout riêng có sidebar
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── globals.css     # Design tokens
├── components/
│   ├── ui/             # Primitive UI
│   ├── layout/         # Header, Footer, Logo
│   ├── home/           # Section trang chủ
│   ├── shared/         # Component dùng lại nhiều trang
│   ├── auth/           # Form xác thực
│   └── dashboard/      # Component khu vực khách hàng
├── config/             # company.ts, nav.ts
├── data/               # mock data + nguồn ảnh
├── lib/                # utils, format, validations, demo
└── types/              # Type dùng chung
prisma/schema.prisma    # Bản nháp schema (chưa migrate)
docs/                   # Tài liệu bàn giao
```

## Thay đổi thông tin doanh nghiệp

Sửa **một file duy nhất**: [`src/config/company.ts`](src/config/company.ts)

Toàn bộ header, footer, trang giới thiệu, trang liên hệ và metadata SEO đều đọc từ file này.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/frontend-status.md](docs/frontend-status.md) | Danh sách trang, chức năng mô phỏng, bảo mật, accessibility |
| [docs/database-plan.md](docs/database-plan.md) | Schema, ERD Mermaid, phân nhóm theo giai đoạn |
| [docs/content-needed.md](docs/content-needed.md) | Thông tin doanh nghiệp cần cung cấp |
| [docs/image-sources.md](docs/image-sources.md) | Nguồn hình ảnh và quy tắc sử dụng |

## Biến môi trường

Giai đoạn hiện tại **không cần** biến môi trường nào. Xem [`.env.example`](.env.example) để biết các biến sẽ dùng ở giai đoạn backend.

Không commit file `.env` chứa giá trị thật.

## Dữ liệu demo

| Loại | Giá trị |
|---|---|
| Mã vận đơn tra cứu được | `VT-DEMO-001`, `VT-DEMO-002`, `VT-DEMO-003` |
| Mã báo giá | `BG-DEMO-001`, `BG-DEMO-002`, `BG-DEMO-003` |

Mọi bản ghi mock đều mang thuộc tính `isDemo: true`. Toàn bộ mock data tập trung tại `src/data/mock/`.
