# Tiến độ triển khai

> Cập nhật: 13/08/2026 — Pha 9 xong. Toàn bộ Pha 0–9 đã hoàn thành.
>
> **Hệ thống vẫn CHƯA sẵn sàng production.** Xem `deployment.md` §8 — quét mã độc và
> MFA là hai điều kiện chặn.
>
> Đối chiếu chi tiết với từng mục §1–§39 của bản yêu cầu gốc:
> [master-prompt-gap-analysis.md](./master-prompt-gap-analysis.md).

## Tổng quan theo pha (§37)

| Pha | Nội dung | Trạng thái |
|---|---|---|
| Pha 0 | Khảo sát và gap analysis | ✅ Xong |
| Pha 1 | Nền tảng | ✅ Xong |
| Pha 2 | Auth và authorization | ✅ Xong |
| Pha 3 | Website public và CMS | ✅ Xong |
| Pha 4 | Service request và moving | ✅ Xong |
| Pha 5 | Pricing và quote | ✅ Xong |
| Pha 6 | Fleet và dispatch | ✅ Xong |
| Pha 7 | Tracking | ✅ Xong |
| Pha 8 | Support, incident, finance, notification | ✅ Xong |
| Pha 9 | Hoàn thiện | ✅ Xong |

---

## Pha 0 — Khảo sát

Repository trước đó là frontend `DEMO_MODE` thuần: 103 file, 6.196 dòng, không backend.

Gap so với master prompt: đạt khoảng 8–10% phạm vi. Thiếu toàn bộ backend, auth, RBAC,
dashboard tài xế, dashboard quản trị, ~54 model database, ~40 nhóm API và toàn bộ test.

### Quyết định kiến trúc đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Package manager | pnpm | Theo §34; nhanh và tiết kiệm đĩa cho dự án nhiều dependency |
| Database local | Docker Compose + PostgreSQL 17 | Theo §4 |
| Cổng PostgreSQL | 5433 | Tránh xung đột với PostgreSQL cài sẵn trên máy dev |
| Prisma client output | `src/generated/prisma` | pnpm dùng thư mục nested nên TypeScript không resolve được type từ `node_modules/@prisma/client` |
| Prisma driver | `@prisma/adapter-pg` | Prisma 7 bắt buộc driver adapter |
| Nhịp làm việc | Từng pha, báo cáo rồi chờ duyệt | Theo lựa chọn của chủ dự án |

---

## Pha 1 — Nền tảng

### Đã hoàn thành

**Hạ tầng phát triển**
- Chuyển npm → pnpm, khoá phiên bản trong `pnpm-lock.yaml`
- `pnpm-workspace.yaml` chỉ cấp phép build script cho 4 package thực sự cần
  (`@prisma/engines`, `prisma`, `unrs-resolver`, `esbuild`) — mặc định pnpm chặn để
  giảm rủi ro supply-chain
- `docker-compose.yml`: PostgreSQL 17 có healthcheck; Redis để sau profile `redis`
  vì §4 nói Redis chỉ dùng khi thực sự cần

**Cấu hình và bảo mật cấu hình**
- `src/lib/env.ts`: validate toàn bộ biến môi trường bằng Zod, fail fast khi thiếu.
  Tách `serverEnv()` và `clientEnv`; gọi `serverEnv()` từ trình duyệt sẽ ném lỗi ngay
  thay vì âm thầm rò secret vào bundle
- `.env.example`: 45 biến, chỉ chứa placeholder an toàn
- `.gitignore`: chặn `.env` nhưng giữ `.env.example`; loại trừ `src/generated/`, `/storage/`,
  kết quả test

**Database**
- `prisma/schema.prisma`: **74 model, 39 enum, 2.349 dòng**, phủ đủ 8 nhóm của §24
- Migration đầu tiên: **2.176 dòng SQL sinh tự động + 112 câu lệnh ràng buộc viết tay**
- Đã xác minh migration chạy thành công trên database hoàn toàn trống

**Ràng buộc ở tầng database** (không thể vượt qua kể cả khi tầng ứng dụng có lỗi)
- 24 check constraint: tiền không âm, toạ độ trong biên hợp lệ, khoảng thời gian hợp lệ,
  số lượng và kích thước tệp phải dương
- 2 exclusion constraint dùng `btree_gist` chặn double-booking xe và tài xế theo khoảng
  thời gian giao nhau — đã kiểm chứng bằng SQL, PostgreSQL từ chối đúng như thiết kế

**Thư viện nền tảng**

| File | Vai trò |
|---|---|
| `src/lib/db.ts` | Prisma client singleton qua driver adapter |
| `src/lib/errors.ts` | 18 mã lỗi ổn định, thông báo tiếng Việt an toàn, không lộ chi tiết nội bộ |
| `src/lib/logger.ts` | Pino có requestId, redact 20 nhóm trường nhạy cảm |
| `src/lib/ids.ts` | Sinh mã ngẫu nhiên không tuần tự, bảng chữ cái bỏ ký tự dễ nhìn nhầm |
| `src/lib/money.ts` | Decimal.js cho VND, không dùng Float ở bất kỳ đâu |
| `src/lib/normalize.ts` | Chuẩn hoá email/điện thoại/biển số cho unique index; slug tiếng Việt |
| `src/lib/datetime.ts` | UTC trong DB, Asia/Ho_Chi_Minh khi hiển thị; `hasOverlap` cho dispatch |
| `src/lib/format.ts` | Đơn vị đo lường hiển thị |

**Seed**
- Chạy lặp nhiều lần không tạo bản ghi trùng (đã xác minh bằng cách chạy 2 lần)
- 6 dịch vụ, 6 nhóm phương tiện, 6 FAQ, 7 khoá cấu hình, 6 mẫu thông báo
- `CompanyProfile` tạo rỗng với 8 trường đánh dấu `pendingFields` — **không bịa** tên
  pháp nhân, mã số thuế, giấy phép (§1)
- **Không** seed tải trọng xe, bảng giá, đánh giá hay số liệu thành tích

**Cấu trúc dự án**
- 18 thư mục module trong `src/modules/` kèm `README.md` mô tả quy ước bắt buộc
- `tests/{unit,integration,e2e,fixtures}`
- Vitest và Playwright đã cấu hình (Playwright chạy 2 project: desktop + mobile)

**Dọn vi phạm §1**
- Xóa section AI trên trang chủ, trang `/uoc-tinh-ai`, component mockup, mock data và type
- Sửa 2 câu FAQ nhắc tới AI; nội dung chuyển sang roadmap

### Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ 74/74 test pass (4 file) |
| `pnpm build` | ✅ Thành công |
| `prisma validate` | ✅ Schema hợp lệ |
| `prisma migrate deploy` trên DB trống | ✅ Thành công |
| Seed chạy 2 lần | ✅ Không tạo bản ghi trùng |
| Test double-booking bằng SQL | ✅ PostgreSQL từ chối đúng |

`pnpm test:e2e` chưa chạy: chưa có test E2E nào ở Pha 1, kịch bản E2E thuộc Pha 3 trở đi.
Trình duyệt Playwright cũng chưa tải (`pnpm exec playwright install chromium`).

### Giới hạn hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Object storage | Adapter `local` — chưa có khoá R2/S3 |
| Bản đồ | `MAP_PROVIDER=none` — hiển thị địa chỉ dạng văn bản |
| Email / SMS / Zalo | Adapter `console` — in ra terminal |
| Quét mã độc file | `noop` — chỉ chấp nhận ở development |
| CAPTCHA | `none` |
| Rate limit | In-memory — chỉ đúng khi chạy một instance |

Toàn bộ đều đã có interface để thay bằng provider thật mà không phải sửa nghiệp vụ.

---

## Pha 2 — Auth và authorization

### Đã hoàn thành

**Đồng bộ schema với Better Auth**

Better Auth quy định tên cột cho 4 bảng `users`/`sessions`/`accounts`/`verifications`.
Migration thứ hai điều chỉnh schema cho khớp thay vì tự đoán API thư viện (§4):

| Thay đổi | Lý do |
|---|---|
| `users.email` từ optional → bắt buộc + unique | Better Auth yêu cầu; giá trị lưu đã chuẩn hoá chữ thường nên chính cột này là unique index trên email normalized |
| Bỏ `users.emailNormalized` | Trùng vai trò với cột `email` |
| `users.emailVerifiedAt` → `emailVerified` Boolean | Kiểu dữ liệu thư viện dùng |
| Bỏ `users.passwordHash` | Better Auth lưu hash tại `accounts.password` với `providerId = "credential"` |
| `sessions.tokenHash` → `token` | Tên cột thư viện dùng |
| `verifications.tokenHash` → `value`, `purpose` thành optional | Thư viện không set các cột bổ sung của hệ thống |

**Xác thực**
- Better Auth với Prisma adapter, cookie HttpOnly + SameSite=lax, Secure ở production
- Bắt buộc xác minh email trước khi đăng nhập
- Mật khẩu tối thiểu 10 ký tự, hash bằng cấu hình mặc định của thư viện
- Rate limit riêng cho từng endpoint nhạy cảm: đăng nhập 5 lần/5 phút, đăng ký và đặt lại
  mật khẩu 5 lần/giờ
- `EmailProvider` adapter — hiện dùng `console`, in ra terminal ở development

**Phân quyền**
- 8 vai trò, 31 permission có namespace, ma trận đầy đủ trong `permissions.ts`
- `Actor` context thuần dữ liệu — mọi service method đều nhận, kiểm thử được không cần database
- `policy.ts` tách bạch hai lớp: permission và ownership/assignment
- Vai trò đọc từ database mỗi request, thu hồi có hiệu lực ngay
- Truy cập chéo trả `NOT_FOUND` thay vì `FORBIDDEN` để không tiết lộ bản ghi tồn tại
- `requireFreshAuth`: thao tác nhạy cảm cần xác thực trong 15 phút và MFA với tài khoản quyền cao

**Audit**
- `AuditLog` append-only, chỉ có hàm ghi
- `redact.ts` là module thuần, lọc 22 nhóm trường nhạy cảm trước khi ghi
- Nhận Prisma transaction client để audit nằm cùng transaction với nghiệp vụ

**Bảo vệ route**
- Middleware điều hướng sớm cho `/tai-khoan`, `/tai-xe`, `/quan-tri`
- Header `X-Robots-Tag: noindex` và `Cache-Control: no-store` cho khu vực riêng tư
- `guards.ts` là lớp bảo vệ thật ở Server Component
- `sanitizeRedirect` chặn open redirect

**Trang auth nối vào hệ thống thật**
- Gỡ toàn bộ `DEMO_MODE` khỏi khu vực auth — hệ thống đăng nhập giờ là thật
- `/xac-thuc-email` đổi thành `/xac-minh` theo §7.2, có chức năng gửi lại liên kết
- Đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu đều gọi Better Auth
- Bọc `Suspense` quanh form đọc query string để trang vẫn prerender tĩnh

### Kiểm chứng bằng thử nghiệm thật

| Kịch bản | Kết quả |
|---|---|
| Đăng nhập đúng mật khẩu | 200, cookie HttpOnly + SameSite=Lax |
| Sai mật khẩu vs email không tồn tại | Hai phản hồi **giống hệt nhau** — không dò được email |
| 8 lần đăng nhập sai liên tiếp | Chặn từ lần thứ 3 (HTTP 429) |
| Tài khoản chưa xác minh email | 403 `EMAIL_NOT_VERIFIED` |
| Chưa đăng nhập → `/tai-khoan`, `/tai-xe`, `/quan-tri` | 307 về `/dang-nhap?tiep-tuc=...` |
| Đã đăng nhập → `/dang-nhap` | 307 về `/tai-khoan` |
| Header trang riêng tư | `noindex, nofollow` + `no-cache` |
| Header trang public | Không có `X-Robots-Tag` |
| Đăng ký thật qua giao diện | Tạo user, gửi email xác minh, hiện màn hình chờ |

### Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ 153/153 pass (7 file) |
| `pnpm build` | ✅ 36 trang |
| `prisma validate` | ✅ Hợp lệ |
| 2 migration trên DB trống | ✅ 76 bảng |

Test tăng từ 74 lên **153**, trong đó 79 test mới cho phân quyền, IDOR, open redirect và
lọc dữ liệu nhạy cảm.

`pnpm test:e2e` vẫn chưa chạy: chưa có kịch bản E2E, và trình duyệt Playwright chưa tải
(`pnpm exec playwright install chromium`).

### Hai trục trặc đã xử lý

1. `server-only` ném lỗi khi chạy ngoài React Server Component, làm hỏng cả seed script lẫn
   Vitest. Seed dùng `tsx --conditions=react-server`; Vitest alias sang stub rỗng.
   Nhân đó tách `redactSensitive` ra module thuần — kiến trúc tốt hơn, không kéo theo database.
2. Seed tài khoản gán nhầm cả `SUPER_ADMIN` lẫn `ADMIN` cho một user vì `SEED_ADMIN_EMAIL`
   trong `.env` trùng email tài khoản ADMIN. Đã sửa và thêm bước kiểm tra trùng email,
   dừng ngay thay vì tạo dữ liệu sai.

### Chưa làm trong Pha 2

| Hạng mục | Ghi chú |
|---|---|
| MFA thực tế | Bảng `MfaCredential` và policy đã sẵn sàng; chưa có luồng đăng ký TOTP |
| Đăng nhập bằng số điện thoại | Cần plugin `phoneNumber` của Better Auth |
| Đăng xuất mọi thiết bị | Repository đã có `revokeAllSessions`; chưa có giao diện |
| Trang quản lý người dùng | Thuộc Pha 9 |
| Khoá tạm thời sau nhiều lần sai | Hiện dựa vào rate limit; cột `failedLoginCount`/`lockedUntil` chưa dùng |

---

## Pha 3 — Website public và CMS

### Đã hoàn thành

**Module CMS**
- `repository.ts` + `service.ts`: mọi hàm `getPublic*` chỉ trả bản ghi `PUBLISHED`;
  bài `SCHEDULED` chưa tới giờ bị loại bằng điều kiện `publishedAt <= now`, không phụ
  thuộc job nền
- Bọc `cache()` của React nên header và footer dùng chung một truy vấn mỗi request
- Giá trị dự phòng có cờ `isFallback` để giao diện biết đang thiếu dữ liệu thật (§1)

**Sanitize rich text**
- `lib/sanitize.ts` dùng allowlist 26 thẻ, chặn `script`/`style`/`iframe`/`object`/`form`
- Hook tự gắn `rel="noopener noreferrer"` cho mọi liên kết ngoài, ghi đè cả `rel` do
  người dùng tự đặt (§5)
- Sanitize **hai lớp**: khi lưu vào database và khi render
- `RichText` là nơi DUY NHẤT trong dự án dùng `dangerouslySetInnerHTML`

**Nội dung CMS đã seed**
- 10 khu vực phục vụ, 3 kênh liên hệ, 1 văn phòng
- 4 trang chính sách — mỗi trang mở đầu bằng khối cảnh báo bản nháp chưa phê duyệt
- 2 chuyên mục và 3 bài viết có nội dung thật, không phải văn bản độn
- 2 bảng giá tạo **phiên bản rỗng** đánh dấu `isReferenceOnly` — không bịa mức giá (§1)

**9 route public mới**

| Route | Ghi chú |
|---|---|
| `/khu-vuc-phuc-vu` | Không tuyên bố phủ toàn quốc; ghi rõ xác nhận theo từng yêu cầu |
| `/chuyen-nha` | Trả 404 khi doanh nghiệp chưa bật dịch vụ chuyển nhà (§3.1) |
| `/bang-gia`, `/bang-gia/boc-xep` | Chưa có giá thì hiện khối "chưa công bố", không hiện số minh họa |
| `/faq` | Nhóm theo chuyên mục, kèm JSON-LD FAQPage |
| `/chinh-sach/{bao-mat,dieu-khoan,van-chuyen,cookie}` | Nội dung từ CMS |

**Đổi cấu trúc route**
- `/khach-hang/*` → `/tai-khoan/*` theo §7.3, trang tổng quan lên `/tai-khoan`
- Redirect 308 từ toàn bộ slug cũ, không mất liên kết đã chia sẻ
- Layout `/tai-khoan` gắn `requireUser` — lớp bảo vệ thật, và `force-dynamic`

**SEO**
- `metadataBase`, canonical, OpenGraph, Twitter card ở layout gốc
- `robots.txt` chặn khu vực riêng tư và URL tra cứu có query
- `sitemap.xml` 27 URL, sinh động từ database, **đã kiểm chứng không lộ URL riêng tư**
- JSON-LD: Organization, BreadcrumbList, FAQPage, Article
- Dùng `Organization` chứ không phải `LocalBusiness`, và không có `aggregateRating`
  hay `priceRange` — những trường đó cần dữ liệu thật (§28)

### Ba lỗi thật do test phát hiện

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Tương phản màu dưới chuẩn ở 50 vị trí | `text-foreground/40..60` chỉ đạt 2.4–4.4:1, dưới ngưỡng AA 4.5:1 | Thêm token `--color-muted: #5a6472` đạt 5.7–6.0:1, thay toàn bộ |
| 4 trang mới không có `<h1>` | `SectionHeading` luôn render `h2` | Thêm prop `as` để trang truyền `h1` |
| Panel tab không có focus nhìn thấy | Tôi đặt `focus-visible:outline-none` mà không thay thế, trong khi Radix đặt `tabIndex=0` lên panel | Thêm focus ring |

Ngoài ra `<dl>` ở trang liên hệ có `dt`/`dd` lồng sâu hai cấp div — cấu trúc HTML không
hợp lệ. Đã chuyển sang grid để `dt`/`dd` là con trực tiếp.

### Hạ tầng test

E2E chuyển từ dev server sang **bản build production**. Dev server biên dịch theo yêu cầu
khiến nhiều worker song song gây timeout ngẫu nhiên — mỗi lần chạy lại fail một tập test
khác nhau. Sau khi đổi: thời gian giảm từ 1,5 phút xuống 27 giây và kết quả ổn định.

### Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ 180/180 (8 file) |
| `pnpm test:e2e` | ✅ **92/92** (desktop + mobile) |
| `pnpm build` | ✅ 40 trang |
| `prisma validate` | ✅ Hợp lệ |
| Migration + seed trên DB trống | ✅ Thành công |

**Axe WCAG 2.2 AA**: 12 route cốt lõi, 0 vi phạm.
**Responsive**: 11 route × 5 breakpoint (390/768/1024/1366/1440), không trang nào cuộn ngang.

### Còn lại của Pha 3

| Hạng mục | Ghi chú |
|---|---|
| Trang quản trị CMS | Nội dung sửa được qua database nhưng chưa có giao diện — thuộc Pha 9 |
| Preview bản nháp | Cần trang quản trị trước |
| Ảnh CMS | `MediaAsset` đã có schema; ảnh xe hiện dùng stock theo nhóm, chờ ảnh thật |
| Phân trang tin tức | Repository đã hỗ trợ `skip`/`take`, giao diện chưa dùng |

---

## Pha 4 — Service request và moving

### Đã hoàn thành

**State machine 11 trạng thái**

Module thuần, không chạm database nên kiểm thử được độc lập. Bảng chuyển trạng thái khai
báo rõ ai được làm bước nào và bước nào bắt buộc nhập lý do.

| Ràng buộc | Cách thực thi |
|---|---|
| Khách không tự tạo báo giá cho mình | `UNDER_REVIEW → QUOTED` chỉ dành cho STAFF |
| Chỉ khách chấp nhận được báo giá | `QUOTED → ACCEPTED` chỉ dành cho CUSTOMER |
| Không nhảy cóc | `SUBMITTED → CONVERTED_TO_SHIPMENT` không tồn tại |
| Lịch sử không viết lại được | 4 trạng thái kết thúc không có lối ra |
| Từ chối/hủy phải có lý do | `requiresReason` trên từng bước chuyển |
| Chỉ hệ thống đánh dấu hết hạn | `EXPIRED` chỉ nhận actor SYSTEM |

Một test duyệt đồ thị để chứng minh **mọi trạng thái đều tới được ít nhất một trạng thái
kết thúc** — chống tạo ra trạng thái "kẹt" mà yêu cầu vào rồi không bao giờ đóng được.

**Nghiệp vụ trong transaction**

Tạo yêu cầu ghi đồng thời `ServiceRequest` + `RequestStop` + `CargoItem` +
`RequestStatusEvent` + `OutboxEvent` + `AuditLog` trong **một transaction**. Thất bại một
phần thì rollback toàn bộ, không để lại trạng thái nửa vời hay thông báo sai sự thật.

Đổi trạng thái dùng `updateMany` kèm điều kiện `status: from` để chống race — hai người
cùng sửa thì người sau nhận `STALE_VERSION` thay vì ghi đè âm thầm.

**Ba lớp chống lạm dụng form public**

| Lớp | Cơ chế | Kết quả kiểm chứng |
|---|---|---|
| Rate limit | 5 yêu cầu/giờ mỗi IP | Chặn từ lượt thứ 5 (HTTP 429) |
| Honeypot | Trường ẩn ngoài khung nhìn | Trả 201 **giả**, không tạo bản ghi, bot không biết bị phát hiện |
| Validate hai phía | Zod dùng chung client và server | 7 lỗi theo từng trường, tiếng Việt |

Honeypot ban đầu khai báo `z.literal("")` khiến Zod từ chối trước và **lộ ra rằng trường
này bị kiểm tra**. Đã sửa thành `z.string().optional()` để route xử lý âm thầm.

**Giao diện**

- Form báo giá 3 bước: progress, cảnh báo trước khi rời trang, focus lỗi đầu tiên, mảng
  hàng hóa thêm/xóa được, khối điều kiện tiếp cận thu gọn
- Form chuyển nhà 3 bước với danh sách đồ đạc **có cấu trúc** theo 6 nhóm, phân biệt mục
  khách khai với mục nhân viên bổ sung sau khảo sát
- Khách chưa đăng nhập nhận mã yêu cầu kèm link theo dõi; **database chỉ lưu hash token**
- `/tai-khoan/yeu-cau` danh sách và chi tiết có timeline trạng thái
- `/quan-tri` tổng quan, `/quan-tri/yeu-cau` hộp thư có lọc theo trạng thái qua URL
- Đổi trạng thái bằng server action; danh sách bước hợp lệ lấy trực tiếp từ state machine

**Phân quyền tại chỗ**

`ACCOUNTANT` đọc được yêu cầu nhưng không đổi được trạng thái — giao diện hiện thông báo
thay vì form. `AdminNav` ẩn mục không có quyền, nhưng đó chỉ là tiện ích: guard của từng
trang mới là lớp bảo vệ.

### Kiểm chứng bằng dữ liệu thật

| Kịch bản | Kết quả |
|---|---|
| Gửi yêu cầu hợp lệ | 201, mã `YCKK3NRCQA` |
| Chuẩn hoá số điện thoại | `0912345678` → `+84912345678` |
| Token khách vãng lai | Chỉ lưu hash, không lưu token thô |
| Transaction | StatusEvent + Outbox + Audit đều ghi, đếm khớp |
| Thể tích tự tính | 100×80×60cm × 12 kiện = 5,760 m³ |
| Lỗi validate | 7 trường, có requestId, **không lộ stack trace** |

### Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **256/256** (10 file) |
| `pnpm test:e2e` | ✅ **100/100** |
| `pnpm build` | ✅ Thành công |
| Migration + seed trên DB trống | ✅ Thành công |

Test tăng từ 180 lên 256: 40 test state machine, 36 test schema validation.

### Hai lỗi tự phát hiện

1. **Honeypot lộ cơ chế** — mô tả ở trên.
2. **`watch()` của React Hook Form** khiến React Compiler bỏ qua tối ưu cho cả component.
   Đã chuyển sang `useWatch`.

### Chưa làm trong Pha 4

| Hạng mục | Ghi chú |
|---|---|
| Upload ảnh hàng hóa | Schema `RequestAttachment` sẵn sàng; cần StorageProvider và luồng intent/confirm — chuyển sang Pha 7 cùng media của shipment |
| Lưu bản nháp | Trạng thái `DRAFT` đã có trong state machine; giao diện hiện gửi thẳng |
| Magic link cho khách vãng lai | Token đã sinh và hash; endpoint tra cứu bằng token chưa làm |
| Idempotency-Key | `IdempotencyRecord` có schema; chưa áp vào API |
| Bổ sung inventory sau khảo sát | Cột `addedByStaff` đã có; giao diện nhân viên chưa làm |

---

## Pha 5 — Pricing và quote

### Đã hoàn thành

**State machine 9 trạng thái báo giá**

Điểm cốt lõi: **tách người lập khỏi người duyệt**. Vai trò `PREPARER` không tự chuyển
`PENDING_APPROVAL → SENT` được — chỉ `APPROVER` (có quyền `quote.approve`) làm được.

| Ràng buộc §13.3 | Cách thực thi |
|---|---|
| Không ghi đè lịch sử | 4 trạng thái kết thúc không có lối ra |
| Chỉ khách chấp nhận báo giá | `SENT/VIEWED → ACCEPTED` chỉ CUSTOMER |
| Khách không tự gửi báo giá | `DRAFT → SENT` không có CUSTOMER |
| Khách không thấy bản nháp | `isVisibleToCustomer` loại DRAFT, PENDING_APPROVAL, CANCELLED |
| Người lập không tự duyệt | `PENDING_APPROVAL → SENT` chỉ APPROVER |
| Từ chối phải nêu lý do | `requiresReason` trên bước DECLINED |

**Tính tiền bằng Decimal**

Thứ tự bắt buộc: thành tiền → trừ giảm giá → **thuế tính trên phần còn lại**. Tính thuế
trước khi trừ giảm giá sẽ khiến khách phải trả thuế cho cả phần được giảm.

Một test cộng 33 dòng × 333.333 đ để chứng minh không tích luỹ sai số — kết quả đúng
10.999.989 đ.

**Ngưỡng duyệt đọc từ dữ liệu**

Ngưỡng nằm trong `SystemSetting` nên doanh nghiệp đổi được mà không cần deploy. Giá trị
mặc định cố ý **siết chặt**: thiếu cấu hình thì thà bắt duyệt thừa còn hơn để lọt báo giá
lớn ra ngoài.

Kiểm tra **độc lập hai điều kiện** và gộp lý do — người lập cần biết chính xác vì sao cần
duyệt, không chỉ biết "cần duyệt".

**Revision thay vì ghi đè**

- Mỗi lần sửa nội dung tạo `QuoteRevision` mới; bản cũ giữ nguyên
- Khách chấp nhận thì `acceptedRevisionId` ghim đúng bản đó và `lockedAt` khoá lại
- Trang khách hiển thị **bản đã chốt**, không phải bản mới nhất — đó mới là thứ hai bên
  đã thống nhất
- Nhân viên vào trang sửa của báo giá đã chấp nhận thì nhận 404

**Chống chấp nhận nhầm bản cũ**

`acceptQuote` yêu cầu khách gửi kèm `revisionNumber`. Nếu nhân viên vừa gửi bản mới,
thao tác bị từ chối với `STALE_VERSION` kèm số hiệu bản mới, thay vì âm thầm chấp nhận
bản khách đang xem.

Ngoài ra `updateMany` kèm điều kiện `currentRevisionId` chống race ở tầng database.

**Giao diện**

- `QuoteBuilder` dùng chung cho tạo mới và tạo revision, xem trước tổng tiền theo thời
  gian thực, cảnh báo ngay khi vượt ngưỡng duyệt
- Nút gửi đổi nhãn theo ngữ cảnh: "Gửi duyệt" khi vượt ngưỡng, "Gửi báo giá cho khách"
  khi không — người bấm biết trước kết quả
- Khách chấp nhận qua **hai bước xác nhận** vì đây là cam kết tài chính
- `QuoteSummaryTable` dùng chung để hai bên nhìn thấy cùng một con số

### Một lỗi tự phát hiện

`submitOrSend` ban đầu truyền `discountPercent: 0` cứng, nghĩa là **ngưỡng giảm giá không
bao giờ được kiểm tra khi gửi**. Một báo giá tổng tiền nhỏ nhưng giảm 50% sẽ lọt qua mà
không cần duyệt. Đã sửa để tính lại tỷ lệ từ `subtotal` và `discountAmount` đã lưu.

### Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **322/322** (12 file) |
| `pnpm test:e2e` | ✅ **100/100** |
| `pnpm build` | ✅ 43 trang |
| Migration + seed trên DB trống | ✅ Thành công |

Test tăng từ 256 lên 322: 33 test tính tiền và ngưỡng duyệt, 33 test state machine báo giá.

### Chưa làm trong Pha 5

| Hạng mục | Ghi chú |
|---|---|
| Thương lượng qua QuoteMessage | Schema và repository sẵn sàng; giao diện chat chưa làm |
| PDF báo giá | §13.3 nói "chỉ khi dữ liệu hợp lệ" — cần quyết định về nhãn pháp lý trước |
| Quản lý bảng giá trong admin | `PriceCatalogVersion` có schema; giao diện thuộc Pha 9 |
| Áp giá tự động từ bảng giá | Hiện nhân viên nhập tay đơn giá; gợi ý từ `VehicleRate` là bước sau |
| Job đánh dấu hết hạn | `isQuoteExpired` kiểm tra lúc đọc; chưa có cron chuyển trạng thái |

---

## Pha 6 — Fleet và dispatch ✅ XONG

> Cập nhật 12/08/2026. Dự án ở trạng thái sạch: lint, typecheck, **452 unit/integration
> test** và **100 E2E test** đều pass, build 46 trang. Chạy `pnpm dev` được ngay.

### Đã xong

**State machine đơn hàng — 19 trạng thái** (`src/modules/shipments/state-machine.ts`)

Bốn ràng buộc cứng của §15 đã mã hoá và có test:

| Ràng buộc | Cách thực thi |
|---|---|
| Không `IN_TRANSIT` trước khi tới điểm lấy hàng | 5 trạng thái đầu không có đường tới IN_TRANSIT |
| Không `COMPLETED` trước khi giao | Chỉ tới từ `DELIVERED_PENDING_CONFIRMATION` |
| Tài xế không quay ngược trạng thái | Bước lùi chỉ dành cho DISPATCHER, kèm lý do |
| Hủy/thất bại phải có mã lý do | `requiresReason` + danh mục `SHIPMENT_FAILURE_REASONS` |

Kèm `nextDriverStep()` cho app tài xế (một nút CTA duy nhất, §26.2) và
`customerMilestoneOf()` gom 19 trạng thái nội bộ về 5 mốc cho khách (§15).

**Chống double-booking — ba lớp** (`src/modules/fleet/conflicts.ts`)

1. Giao diện: cảnh báo trước khi bấm (tiện dụng, không phải bảo vệ)
2. Ứng dụng: `findConflicts` báo **tất cả** xung đột cùng lúc, không dừng ở cái đầu
3. Database: exclusion constraint `btree_gist` từ migration đầu — **đã kiểm chứng bằng
   14 integration test chạy thật trên PostgreSQL**, gồm cả test race condition

Bảo trì xe và nghỉ phép tài xế **không override được** — đó là ràng buộc vật lý, khác với
trùng phân công (override được, bắt buộc lý do + AuditLog).

**Module đã viết**

| File | Nội dung |
|---|---|
| `modules/shipments/state-machine.ts` | 19 trạng thái, 59 test |
| `modules/shipments/dispatch-service.ts` | Tạo đơn từ quote, phân công, gỡ phân công |
| `modules/shipments/repository.ts` | Hàng chờ dispatcher, lọc theo driver/user |
| `modules/fleet/conflicts.ts` | Phát hiện xung đột, 26 test |
| `modules/fleet/schema.ts` | Zod cho xe, tài xế, phân công, lịch bận |
| `modules/fleet/repository.ts` | Xe, tài xế, giấy tờ sắp hết hạn |

**Giao diện đã xong**

- `/quan-tri/xe` — danh sách xe, cảnh báo đăng kiểm/bảo hiểm sắp hết hạn
- `/quan-tri/tai-xe` — danh sách tài xế, cảnh báo bằng lái sắp hết hạn
- `/quan-tri/dieu-phoi` — 4 khối: cần xử lý ngay, báo giá chờ tạo đơn, chờ phân công, đang chạy
- `src/app/quan-tri/dieu-phoi/actions.ts` — server action đầy đủ
- `components/admin/create-shipment-button.tsx`

### Hoàn thiện đợt 2 (12/08/2026)

**Trang chi tiết điều phối** — `src/app/quan-tri/dieu-phoi/[code]/page.tsx`

Vá link chết đã tồn tại từ đợt trước. Trang gồm: hành trình và điều kiện tiếp cận, mốc
thời gian kế hoạch/thực tế, phân công hiện tại kèm số điện thoại tài xế bấm gọi được,
lịch sử phân công đã gỡ, nguồn gốc đơn (yêu cầu + báo giá), timeline trạng thái.

**Form phân công** — `components/admin/assignment-form.tsx`

Kiểm tra xung đột ngay khi dispatcher đổi lựa chọn (hoãn 400ms), hiện danh sách xung đột,
chỉ hiện ô "bỏ qua cảnh báo" khi thật sự bỏ qua được, khoá nút gửi cho tới khi xử lý xong.

Kết quả kiểm tra lưu kèm chữ ký của bộ lựa chọn sinh ra nó thay vì xoá state trong effect
— tránh cảnh báo `react-hooks/set-state-in-effect` và tránh hiển thị kết quả cũ.

**Đổi trạng thái đơn hàng** — `modules/shipments/service.ts` + `shipment-status-form.tsx`

`changeShipmentStatus` đặt trong file riêng vì cả tài xế lẫn điều phối đều dùng, còn
`dispatch-service.ts` chỉ dành cho nhân viên. Hai ràng buộc phụ thuộc dữ liệu của §15
(bằng chứng giao hàng, mã lý do) tách thành hàm thuần `checkStatusPreconditions` trong
state machine để unit test được mà không cần database.

Ghi mốc thời gian thực tế (`actualPickupAt`, `deliveredAt`, `completedAt`) ngay lúc
chuyển trạng thái thay vì suy ra từ lịch sử về sau.

**Thêm/sửa xe, sửa hồ sơ tài xế** — `modules/fleet/service.ts`

Không có hàm xoá cứng: xe thanh lý chuyển `RETIRED`, tài xế nghỉ chuyển `INACTIVE`.
Chưa có form TẠO tài xế vì `DriverProfile` bắt buộc gắn với `User`, mà tạo tài khoản
đăng nhập thuộc module quản lý người dùng chưa xây (§3.4) — thà thiếu chức năng còn hơn
tạo hồ sơ mồ côi không đăng nhập được.

### Lỗi thật phát hiện khi kiểm thử và đã sửa

**1. `AdminNav` có 6 link chết** (`components/admin/admin-nav.tsx`)

Nav trỏ tới `/quan-tri/don-hang`, `/bang-gia`, `/hoa-don`, `/noi-dung`, `/nguoi-dung`,
`/nhat-ky` — không trang nào tồn tại. Quản trị viên đăng nhập thấy 6 tab dẫn tới 404.

Sửa: thêm cờ `ready` cho từng mục, chỉ render mục đã có trang. Danh sách vẫn giữ đủ để
thấy bức tranh §3.4.

**2. Không lập nổi báo giá nếu bỏ trống trường tùy chọn** (`modules/quotes/schema.ts`)

`discountAmount: moneyString.optional()` — nhưng ô nhập HTML để trống trả về chuỗi rỗng
chứ không phải `undefined`, nên `""` bị regex `/^\d+$/` từ chối. Nhân viên buộc phải điền
giảm giá và thuế cho **từng dòng** mới gửi được báo giá.

Sửa: `optionalMoneyString` và `optionalNumber()` quy chuỗi rỗng về `undefined` trước khi
kiểm tra. Test hồi quy: `tests/unit/quote-schema.test.ts` (12 test).

**3. Phân công lại báo trùng lịch với chính chuyến đó** (`modules/fleet/conflicts.ts`)

Dispatcher chỉ muốn nới khung giờ hoặc đổi tài xế cho chuyến đã phân công thì nhận cảnh
báo "xe đã được phân công cho đơn VTxxx" — chính là đơn đang sửa. Hậu quả nặng hơn giao
diện: họ buộc phải tick "bỏ qua cảnh báo" và nhập lý do, ghi vào `AuditLog` một lần
override **không có thật**, làm hỏng giá trị của nhật ký khi điều tra về sau.

Sửa: thêm `excludeShipmentId` vào `findConflicts`, truyền xuyên qua
`checkAssignmentConflicts` → `previewConflictsAction` → form. Phân công cũ của chính
chuyến đó sắp bị gỡ trong cùng transaction nên không phải xung đột.
Test hồi quy: 4 test trong `tests/unit/dispatch-conflicts.test.ts`.

### Kiểm chứng end-to-end trên trình duyệt thật

Chạy trọn luồng §38 bằng Playwright trên dev server:

| Bước | Kết quả |
|---|---|
| Thêm xe qua `/quan-tri/xe/moi`, biển số sai bị chặn | ✅ báo "Biển số quá ngắn" |
| Xe hiện trong danh sách, cảnh báo đăng kiểm sắp hết hạn | ✅ |
| Form sửa xe nạp lại đúng toàn bộ giá trị đã lưu | ✅ |
| Khách gửi yêu cầu → điều phối lập và gửi báo giá | ✅ |
| Khách chấp nhận báo giá (xác nhận hai bước) | ✅ |
| Điều phối tạo đơn từ báo giá đã chốt | ✅ |
| Phân công xe rảnh → "Xe và tài xế đều rảnh" | ✅ |
| Phân công trùng chuyến khác → cảnh báo nêu đúng mã đơn, nút bị khoá | ✅ |
| Tick bỏ qua + nhập lý do → mở khoá, trang ghi nhận override | ✅ |
| Sửa lại phân công của chính chuyến đó → không báo trùng | ✅ (sau khi sửa lỗi 3) |
| Đổi trạng thái CREATED → CONFIRMED, không đòi mã lý do | ✅ |
| Chọn CANCELLED → hiện danh mục 8 mã lý do, bắt buộc chọn | ✅ |
| Sau khi hủy, form đổi trạng thái biến mất | ✅ |

**Lưu ý về môi trường:** trong pane trình duyệt tích hợp, trang khu vực khách hàng không
hydrate (mọi phần tử có kích thước 0 vì pane không dựng layout). Đây là hạn chế của công
cụ, không phải lỗi ứng dụng — Playwright chạy cùng trang cho kết quả bình thường.

### Kết quả kiểm tra cuối Pha 6

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **452/452** (16 file, gồm 14 integration test chạm DB thật) |
| `pnpm test:e2e` | ✅ **100 pass**, 16 skip |
| `pnpm build` | ✅ 46 trang |

### Còn nợ lại của Pha 6

- Form **tạo mới** tài xế (chờ module quản lý người dùng, §3.4)
- Upload giấy tờ xe và bằng lái (`VehicleDocument`/`DriverDocument`) — chờ module `media`
- Giao diện quản lý `AvailabilityBlock` (lịch bảo trì, nghỉ phép) — hiện chỉ nhập qua DB
- `/quan-tri/don-hang`: danh sách đơn cho nhân viên không phải dispatcher (§3.4)
- E2E tự động cho luồng điều phối: hiện mới kiểm chứng thủ công bằng script, chưa thành
  test thường trực (cần fixture đăng nhập và dữ liệu đội xe)

---

## Pha 7 — Tracking ✅ XONG

> Cập nhật 12/08/2026. Tra cứu hai mức, đơn hàng khách, giao diện tài xế, media theo giai
> đoạn, bằng chứng giao hàng và vị trí chuyến đều đã xong và kiểm chứng trên trình duyệt thật.

### Đã xong

**Tra cứu hai mức (§16.1)** — `src/modules/tracking/`

| File | Vai trò |
|---|---|
| `masking.ts` | Module thuần quyết định cái gì ĐƯỢC hiện công khai, 24 test |
| `schema.ts` | Zod cho mã vận đơn + 4 số cuối điện thoại |
| `service.ts` | `lookupPublic` (công khai), `listMyShipments`/`getMyShipment` (khách đăng nhập) |
| `app/api/public/tracking/route.ts` | Endpoint POST, rate limit 10 lượt / 5 phút |

Ba quyết định thiết kế đáng ghi lại:

1. **Hai hàm riêng, không phải một cờ boolean.** `lookupPublic` chỉ SELECT đúng những cột
   được phép công khai, nên dữ liệu nhạy cảm không bao giờ rời khỏi database. Một cờ
   `isPublic` truyền sai chỗ là lộ; hai hàm thì không có đường lộ.

2. **POST chứ không GET** dù chỉ là đọc. Mã vận đơn và số điện thoại là dữ liệu cá nhân,
   không được nằm trong query string vì URL bị ghi vào log truy cập, lịch sử trình duyệt
   và header Referer (§31).

3. **Mọi thất bại trả về cùng một thông báo.** Sai mã, sai số xác minh, đơn chưa công bố
   đều không phân biệt được từ bên ngoài — phân biệt được nghĩa là người dò mã biết mã nào
   có thật, chỉ còn thiếu số điện thoại (§16.1).

Công khai chỉ thấy: mốc tiến trình (5 mốc), tỉnh/thành, ngày dự kiến giao (không có giờ).
Không thấy: địa chỉ, tên, điện thoại, tài xế, biển số, giá trị đơn.

**Đơn hàng của khách (§26.1)** — thay toàn bộ mock cũ

- `/tai-khoan` — số liệu thật từ shipment, quote, request
- `/tai-khoan/don-hang` — danh sách thật
- `/tai-khoan/don-hang/[code]` — thay `[id]` mock cũ; tiến trình 5 mốc, địa chỉ đầy đủ,
  lịch sử cập nhật, liên kết tới báo giá và yêu cầu gốc

Thông tin tài xế chỉ hiện **trong cửa sổ thời gian chuyến hoạt động** (§16.1). Ngoài khoảng
đó khách thấy dòng giải thích thay vì số điện thoại — tài xế không nên bị gọi sau khi đã
bàn giao xong. Dữ liệu bị gỡ hẳn khỏi object trả về chứ không để giao diện tự nhớ ẩn.

**Giao diện tài xế (§3.3, §26.2)** — `/tai-xe/*`, lần đầu tiên có

- `layout.tsx` — mobile-first thật: một cột, không sidebar, vùng chạm lớn. `requireDriver`
  chặn cả người đăng nhập không phải tài xế.
- `/tai-xe` — chuyến gom theo Hôm nay / Sắp tới / Đã xong, kèm gợi ý bước kế tiếp
- `/tai-xe/chuyen/[code]` — hành động đặt LÊN ĐẦU trang vì đó là việc tài xế mở trang để làm
- `components/driver/next-step-button.tsx` — **một nút CTA duy nhất**, cao 56px

Tài xế không phải chọn trong danh sách 19 trạng thái: hệ thống biết bước tiếp theo qua
`nextDriverStep()`, việc của họ chỉ là xác nhận đã làm xong. Có bước xác nhận hai lớp vì
bấm nhầm trên điện thoại khi đang cầm hàng là chuyện thường, mà trạng thái đã đẩy lên thì
tài xế không tự lùi được (§15 ràng buộc 3).

Bước đích do **server** tính lại từ trạng thái hiện tại; client chỉ gửi trạng thái nó đang
thấy. Điều phối vừa đổi trạng thái thì `expectedFrom` không khớp và thao tác bị từ chối
thay vì nhảy nhầm bước.

Nút "Dẫn đường" mở app bản đồ sẵn có trên máy thay vì nhúng bản đồ: tài xế đang lái cần mở
thẳng app quen thuộc, và trang vẫn dùng được khi không có API key bản đồ (§17 — luôn có
phương án văn bản).

**Media theo giai đoạn (§16.2, §16.3)** — luồng upload 8 bước

| File | Vai trò |
|---|---|
| `modules/media/file-types.ts` | Nhận dạng bằng magic bytes, allowlist định dạng, 30 test |
| `modules/media/schema.ts` | Zod cho intent/confirm, 10 giai đoạn, gợi ý giai đoạn theo trạng thái |
| `modules/media/service.ts` | Toàn bộ 8 bước, lọc theo quyền khi đọc |
| `lib/providers/storage.ts` | StorageProvider, adapter `local` ký URL bằng HMAC |
| `lib/providers/virus-scan.ts` | VirusScanProvider, adapter `noop` |
| `api/uploads/intent`, `/confirm`, `/local` | Bước 1, 5 và điểm nhận file của adapter local |
| `api/media/[id]` | Proxy đã xác thực để xem tệp |

Quyết định đáng ghi lại:

1. **Bản ghi tạo ở bước 1 với trạng thái `QUARANTINED`**, không phải sau khi upload xong.
   File tải lên mà client không gọi confirm vẫn có dấu vết để dọn, thay vì thành file mồ côi
   nằm mãi trong storage.

2. **Proxy đã xác thực thay vì signed URL** cho việc xem tệp. URL ký sẵn bị chia sẻ lại là
   ai cũng xem được cho tới khi hết hạn; proxy kiểm tra quyền ở TỪNG lần gọi. Chuyến hàng có
   ảnh hàng hóa và địa chỉ nhà khách nên đánh đổi băng thông là xứng đáng.

3. **Allowlist, không phải blocklist.** Không có SVG: SVG là XML chứa được `<script>`, mở
   trong trình duyệt là chạy mã. PDF được phép nhưng ép `Content-Disposition: attachment` vì
   PDF mở inline chạy được JavaScript ở một số trình duyệt. HEIC được phép vì iPhone chụp
   mặc định ra HEIC — từ chối thì tài xế không tải ảnh lên nổi.

4. **MIME ghi vào database là MIME ĐÃ XÁC MINH**, không phải cái client khai.

5. Tệp không đạt chuyển `REJECTED` kèm lý do rồi mới xoá khỏi storage — giữ dấu vết vì sao
   bị loại, thay vì biến mất không giải thích.

Giao diện: tài xế tải ảnh theo giai đoạn (mặc định gợi ý theo trạng thái chuyến, có ô
"cho khách hàng xem"); khách và điều phối xem thư viện gom theo giai đoạn. Ảnh dùng thẻ
`<img>` thường chứ không `next/image` vì bộ tối ưu ảnh của Next fetch không kèm cookie phiên
nên không qua được proxy xác thực.

### Kiểm chứng bảo mật luồng upload

Chạy thật qua API trên dev server:

| Kịch bản | Kết quả |
|---|---|
| PNG thật, đánh dấu nội bộ | ✅ READY |
| PNG thật, đánh dấu cho khách xem | ✅ READY |
| **SVG chứa `<script>` khai man là `image/png`** | ✅ chặn ở bước confirm bằng magic bytes |
| SVG khai đúng MIME | ✅ chặn ngay ở bước intent (ngoài allowlist) |
| Khai sai dung lượng rồi tải nội dung khác | ✅ chặn ở confirm |
| PUT lên storage không có chữ ký hợp lệ | ✅ 403 |
| Tài xế xem: thấy cả ảnh nội bộ, có nhãn "Nội bộ" | ✅ |
| Khách xem: chỉ thấy ảnh đánh dấu cho khách | ✅ 1/2 ảnh |
| **Khách mở thẳng URL ảnh nội bộ của chính đơn mình** | ✅ 404 |


**Bằng chứng lấy hàng và giao hàng (§18)** — `modules/proof-of-delivery/`

| File | Vai trò |
|---|---|
| `otp.ts` | Sinh, hash, kiểm tra OTP. Module thuần, 23 test |
| `schema.ts` | Zod cho POP, POD, yêu cầu OTP, biên bản điều chỉnh |
| `service.ts` | Nghiệp vụ, chuỗi điều chỉnh bất biến |
| `lib/providers/sms.ts` | SmsProvider, adapter `console` |
| `components/driver/delivery-proof-form.tsx` | Giao diện tài xế: gửi mã → nhập mã → lập biên bản |

**Sửa schema để đúng yêu cầu bất biến của §18.**

`ProofOfDelivery.shipmentId` vốn là `@unique`, nghĩa là mỗi chuyến chỉ lưu được ĐÚNG MỘT
biên bản. Với ràng buộc đó, "lập biên bản điều chỉnh" chỉ có thể thực hiện bằng cách ghi đè
hoặc xoá bản cũ — tức là phá huỷ chính bằng chứng cần được bảo toàn. Trường `correctionOfId`
đã có sẵn trong schema cho thấy ý định ban đầu là giữ chuỗi, nhưng ràng buộc unique khiến nó
không dùng được.

Migration `20260812102621_pod_correction_chain`:
- Bỏ unique trên `shipmentId`
- Thêm `supersededAt DateTime?`
- **Partial unique index viết tay**: `UNIQUE (shipmentId) WHERE supersededAt IS NULL` —
  mỗi chuyến chỉ có đúng một biên bản đang hiệu lực, ràng buộc ở tầng database chứ không
  chỉ ở tầng ứng dụng
- Check constraint: bản điều chỉnh không được tự trỏ về chính nó

Điều chỉnh giờ hoạt động đúng: bản cũ giữ nguyên nội dung, chỉ đánh dấu `supersededAt`;
bản mới trỏ về bản cũ qua `correctionOfId` kèm lý do bắt buộc tối thiểu 10 ký tự.

**Bốn quy tắc OTP của §18, mã hoá thành code:**

1. Chỉ lưu hash SHA-256, muối bằng `shipmentId` — hai chuyến cùng mã cho hash khác nhau
2. Hết hạn sau 15 phút
3. Tối đa 5 lần thử; đếm tăng ngay cả khi thất bại
4. Dùng một lần; phát mã mới thì mã cũ bị vô hiệu hoá trong cùng transaction

Thứ tự kiểm tra có chủ ý: **hết hạn và đã dùng xét TRƯỚC khi so mã**. So mã trước thì thời
gian phản hồi để lộ mã nào đúng dù bản ghi đã hết hiệu lực. So sánh hash dùng
`timingSafeEqual`.

**Ai được làm gì:**

- Số nhận OTP lấy từ dữ liệu điểm giao, KHÔNG lấy từ input của tài xế. Nếu tài xế tự nhập
  số tuỳ ý thì họ gửi mã cho chính mình và bước xác nhận của người nhận thành hình thức.
  Chỉ điều phối được chỉ định số khác.
- Nhánh "người nhận từ chối" bỏ yêu cầu OTP: không có ai đọc mã thì đòi mã là bế tắc, và
  tài xế sẽ lách bằng cách khai man kết quả.
- Chỉ điều phối lập được biên bản điều chỉnh. Tài xế ghi sai thì báo điều phối, không tự sửa
  bằng chứng do chính mình tạo.
- Lịch sử điều chỉnh chỉ nhân viên xem được.

Lập biên bản xong hệ thống tự đóng đơn sang `COMPLETED` — tài xế không phải nhớ thêm thao
tác. Đóng đơn là bước riêng sau transaction ghi biên bản: nếu đóng đơn lỗi thì biên bản vẫn
còn, và thông báo nói rõ tình trạng đó.

### Kiểm chứng POD end-to-end

| Kịch bản | Kết quả |
|---|---|
| Nhập mã khi chưa gửi | ✅ "Chưa có mã xác nhận nào đang hiệu lực" |
| Sau khi gửi: số điện thoại hiển thị dạng che | ✅ `*******0008` |
| Database lưu mã thô? | ✅ Không — hash 64 ký tự |
| Nhập sai 2 lần | ✅ `attempts = 2`, mã chưa bị tiêu thụ |
| Nhập đúng | ✅ Biên bản tạo, đơn chuyển `COMPLETED`, mã bị tiêu thụ |
| **Ép ghi biên bản thứ hai thẳng vào database** | ✅ PostgreSQL từ chối |
| Tài xế thử lập biên bản điều chỉnh | ✅ Bị chặn |
| Điều phối lập biên bản điều chỉnh | ✅ Chuỗi 2 bản, bản cũ còn nguyên, đúng 1 bản hiệu lực |
| Khách xem lịch sử điều chỉnh | ✅ Bị chặn |


**Bằng chứng giao hàng (§18)** — `modules/proof-of-delivery/`

| File | Vai trò |
|---|---|
| `otp.ts` | Sinh, hash, xác minh OTP. Module thuần, 22 test |
| `schema.ts` | Zod cho POP, POD, yêu cầu OTP, biên bản điều chỉnh |
| `service.ts` | Nghiệp vụ POP/POD/OTP/correction |
| `lib/providers/sms.ts` | SmsProvider, adapter `console` |
| `components/driver/delivery-proof-form.tsx` | Giao diện tài xế tại điểm giao |

Bốn quy tắc OTP của §18 được mã hoá thành code, không chỉ ghi trong tài liệu:

1. **Chỉ lưu hash**, muối bằng `shipmentId` — hai chuyến có cùng mã vẫn cho hash khác nhau.
   Không dùng bcrypt/argon2: OTP sống 15 phút và chỉ có 10^6 khả năng, hash chậm không mua
   thêm an toàn đáng kể trong khi tài xế phải chờ ở điểm giao.
2. **Hết hạn sau 15 phút.**
3. **Tối đa 5 lần thử**, đếm tăng cả khi nhập sai — chỉ đếm khi đúng thì giới hạn vô nghĩa.
4. **Dùng một lần**; phát mã mới sẽ vô hiệu hoá mã cũ chưa dùng.

Thứ tự kiểm tra có chủ ý: *đã dùng* và *hết hạn* xét TRƯỚC khi so mã. So mã trước thì người
thử dùng được thời gian phản hồi để biết mã nào đúng dù bản ghi đã hết hiệu lực. So sánh
hash bằng `timingSafeEqual`.

Số nhận OTP lấy từ dữ liệu điểm giao, **không lấy từ input của tài xế**. Cho tài xế tự nhập
số nghĩa là họ gửi mã cho chính mình và bước xác nhận của người nhận thành hình thức. Chỉ
điều phối được chỉ định số khác (khách đổi người nhận là chuyện có thật, nhưng đó là quyết
định của nhân viên).

Nhánh *người nhận từ chối* bỏ yêu cầu OTP: không có ai đọc mã thì đòi mã là bế tắc, và tài
xế sẽ lách bằng cách khai man kết quả. Nhánh này cũng KHÔNG tự đóng đơn — đó là chuyến thất
bại, điều phối quyết định xử lý tiếp.

**Sửa schema để đáp ứng yêu cầu bất biến**

Bản đầu tiên của `correctProofOfDelivery` xoá bản cũ rồi tạo bản mới — đúng thứ §18 cấm.
Nguyên nhân sâu hơn: `ProofOfDelivery.shipmentId` khai `@unique`, nên một chuyến không thể
có chuỗi nhiều bản, dù cột `correctionOfId` đã tồn tại sẵn cho đúng mục đích đó.

Migration `20260812102621_pod_correction_chain`:
- Bỏ unique trên `shipmentId`, thêm cột `supersededAt`
- **Partial unique index viết tay**: `UNIQUE (shipmentId) WHERE supersededAt IS NULL` —
  Prisma không diễn đạt được, mà không có nó thì một lỗi ở tầng ứng dụng sẽ tạo hai biên bản
  cùng hiệu lực và không ai biết bản nào là bằng chứng thật
- Check constraint: bản điều chỉnh không tự trỏ về chính nó

Nhờ vậy điều chỉnh giữ nguyên bản cũ, đánh dấu `supersededAt`, tạo bản mới trỏ ngược qua
`correctionOfId` kèm lý do và AuditLog. Chỉ điều phối được sửa: tài xế lập sai thì báo lại,
không tự sửa bằng chứng do chính mình tạo.

**Vị trí chuyến (§17)** — `modules/locations/`

| File | Vai trò |
|---|---|
| `rules.ts` | Luật lọc ping. Module thuần, 25 test |
| `schema.ts` | Zod cho lô ping và cờ chia sẻ |
| `service.ts` | Nhận lô, đọc theo quyền, bật/tắt chia sẻ, dọn dữ liệu quá hạn |
| `api/driver/locations` | Nhận lô từ thiết bị tài xế |
| `components/driver/location-sharing.tsx` | Opt-in, gom lô, chịu được mất sóng |
| `components/shared/shipment-location.tsx` | Hiển thị cho khách và điều phối |

Server tự quyết định điểm nào đáng ghi, không tin thiết bị. Bảy lý do loại: toạ độ ngoài
biên (kể cả `(0,0)` — giá trị mặc định khi chưa định vị được), quá cũ, timestamp ở tương
lai, sai thứ tự, sai số quá lớn, tốc độ suy ra vô lý, gửi quá dày.

Một điểm sai không làm hỏng cả lô: điểm đó bị loại và báo lại, phần còn lại vẫn ghi. Lô được
sắp xếp theo thời gian thiết bị trước khi duyệt — thiết bị mất sóng rồi gửi dồn thường lộn
xộn thứ tự, mà luật "điểm sau phải mới hơn điểm trước" chỉ đúng khi duyệt đúng trình tự.

Ba lớp chặn khi khách xem: doanh nghiệp phải **bật chia sẻ cho chuyến đó** (mặc định TẮT),
chuyến phải đang trên đường, và toạ độ đã làm thô về ~100m. Nhân viên có `tracking.read_all`
xem toạ độ đầy đủ vì họ cần điều hành thật. Khách chỉ thấy 20 điểm gần nhất, nhân viên 200 —
§17 nói không hiển thị lịch sử vị trí cá nhân nhiều hơn mức cần thiết.

**Không nhúng bản đồ.** §17 yêu cầu map provider phải có phương án văn bản và trang không
được hỏng khi API bản đồ lỗi — cách chắc chắn nhất là không phụ thuộc vào nó: hiển thị toạ
độ dạng văn bản kèm liên kết mở app bản đồ sẵn có trên máy.

Ngôn từ nói đúng bản chất: *"vị trí của xe đang chở hàng, không phải thiết bị định vị gắn
trên từng kiện hàng"* — §17 cấm quảng cáo sai thành GPS của từng kiện.

`purgeExpiredLocations()` xoá điểm quá `LOCATION_RETENTION_DAYS` (mặc định 30). **Chưa có bộ
lập lịch** — hiện phải gọi thủ công hoặc qua cron bên ngoài, ghi rõ ở đây thay vì để người
đọc tưởng nó tự chạy.


### Lỗi thật phát hiện khi kiểm thử và đã sửa

**Mã báo giá lọt vào màn hình tài xế** (§8)

Ghi chú của sự kiện "Mới tạo" là `Tạo từ báo giá BGTFW89T8W`, nên mã báo giá hiện nguyên
trong lịch sử chuyến — dù trang tài xế không render trường `quote` nào. DRIVER không có
quyền `quote.*` theo §8.

Sửa hai lớp:
1. `createShipmentFromQuote` không nhúng mã báo giá vào ghi chú nữa. Liên kết tới báo giá
   đã có sẵn qua quan hệ `quote` cho nhân viên, và AuditLog vẫn ghi đầy đủ để truy vết.
2. Thêm `DRIVER_SHIPMENT_SELECT` — truy vấn riêng cho tài xế, chọn tường minh từng cột.
   Trường mới thêm vào `Shipment` sau này sẽ KHÔNG tự động lọt ra màn hình tài xế.

Test hồi quy: `tests/integration/driver-data-exposure.test.ts` duyệt đệ quy cây select và
khẳng định không có `quote`, `totalAmount`, `internalNote`, `serviceRequest`, `user`,
`invoices` ở bất kỳ cấp nào.

### Kiểm chứng end-to-end trên trình duyệt thật

Tra cứu công khai (chưa đăng nhập):

| Kiểm tra | Kết quả |
|---|---|
| Hiện 5 mốc tiến trình, đúng 3/5 đã đạt | ✅ |
| Lộ địa chỉ chi tiết | ❌ không |
| Lộ tên người liên hệ | ❌ không |
| Lộ tên tài xế | ❌ không |
| Lộ biển số | ❌ không |
| Sai số xác minh và sai mã cho thông báo **giống hệt nhau** | ✅ |

Khách đăng nhập: thấy địa chỉ đầy đủ, biển số, tên và số tài xế ✅.
Khách khác truy cập cùng mã: không thấy gì, hiện trang 404 ✅.

Tài xế (giả lập iPhone 390×844):

| Kiểm tra | Kết quả |
|---|---|
| Danh sách gom nhóm đúng, gợi ý bước kế tiếp | ✅ |
| Nút CTA cao 56px (yêu cầu ≥44px cho vùng chạm) | ✅ |
| Xác nhận hai bước rồi mới đổi trạng thái | ✅ |
| Lộ giá trị đơn | ❌ không |
| Lộ mã báo giá | ❌ không (sau khi sửa) |
| Tài xế khác mở cùng chuyến | 404, không thấy địa chỉ ✅ |
| Khách hàng mở `/tai-xe` | 404 ✅ |

### Hạn chế đã biết

`notFound()` trong các trang chi tiết dưới `/tai-khoan` trả HTTP **200** thay vì 404. Nguyên
nhân: `loading.tsx` tạo ranh giới Suspense nên Next đã đẩy phần khung ra trước khi mã trạng
thái được quyết định. Nội dung 404 vẫn hiển thị đúng và đầy đủ cho người dùng; ảnh hưởng chỉ
ở mã HTTP, mà nhóm route này vốn `noindex` và nằm sau đăng nhập. Bỏ `loading.tsx` sẽ trả
đúng 404 nhưng mất khung chờ — chưa đổi, ghi lại để cân nhắc ở Pha 9.

### Kiểm chứng vị trí trên trình duyệt thật

Gửi lô qua API thật với dữ liệu cố tình sai:

| Kiểm tra | Kết quả |
|---|---|
| Lô lẫn 4 điểm xấu | ✅ nhận 1, loại 4, mỗi điểm nêu đúng lý do |
| Toạ độ `(0,0)` | ✅ `OUT_OF_BOUNDS` |
| Timestamp tương lai 15 phút | ✅ `FUTURE_TIMESTAMP` |
| Sai số định vị 9000m | ✅ `TOO_INACCURATE` |
| Nhảy TP.HCM → Hà Nội trong vài giây | ✅ bị loại |
| Gửi lại lô cũ sau khi đã có điểm mới hơn | ✅ `OUT_OF_ORDER` |
| Ping khi chuyến chưa chạy | ✅ từ chối, yêu cầu cập nhật trạng thái trước |
| Ping khi assignment hết hiệu lực | ✅ 403 |
| Khách xem khi chưa bật chia sẻ | ✅ không thấy gì |
| Điều phối xem | ✅ toạ độ đầy đủ `10.79550, 106.71550` |
| Khách xem sau khi bật | ✅ đã làm thô `10.796, 106.716` |
| Ghi rõ là vị trí XE, không phải GPS từng kiện | ✅ |
| Không nhúng bản đồ, có link mở app ngoài | ✅ |

### Kết quả kiểm tra cuối Pha 7

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **571/571** (22 file) |
| `pnpm test:e2e` | ✅ **100 pass**, 16 skip |

### CÒN NỢ LẠI của Pha 7

1. Giao diện điều phối cho biên bản điều chỉnh — service `correctProofOfDelivery` đã xong
   và kiểm chứng được, nhưng chưa có màn hình gọi tới.
2. Chữ ký điện tử và ảnh trong POD (§18) — schema có `signatureKey`, chưa nối vào module
   `media`. Tài xế hiện tải ảnh riêng theo giai đoạn `PROOF_OF_DELIVERY`.
3. Khách tải biên nhận/POD đã làm sạch dữ liệu (§18) — chưa có xuất PDF.
4. `ProofOfPickup` — service xong, chưa có giao diện tài xế gọi tới.
5. **Bộ lập lịch**: `purgeExpiredLocations()` và dọn tệp `QUARANTINED` bị bỏ dở đều phải gọi
   thủ công. Cần cron hoặc worker — thuộc Pha 9.
6. Thumbnail và transcode video (§16.2) — hiện tải nguyên bản. Ảnh điện thoại 5MB tải trên
   danh sách sẽ chậm; cần xử lý trước khi có nhiều dữ liệu thật.
7. `ConsentRecord` cho việc chia sẻ vị trí (§31) — hiện chỉ có cờ trên `Shipment`, chưa lưu
   bản ghi đồng ý riêng.

### Phụ thuộc bên ngoài của Pha 7

| Adapter | Hiện tại | Cần cho production |
|---|---|---|
| StorageProvider | `local` — ghi ra thư mục `storage/` | R2 hoặc S3 thật; `local` không nhân bản, không CDN |
| SmsProvider | `console` — in ra terminal | Bắt buộc: OTP không tới nơi thì tài xế không đóng được chuyến |
| VirusScanProvider | `noop` — **không quét gì** | Bắt buộc có trước khi nhận file từ người ngoài |
| MapProvider | `none` — nút mở app bản đồ ngoài | Không bắt buộc; phương án hiện tại vẫn dùng được |

---

## Pha 8 — Hỗ trợ, sự cố, tài chính, thông báo ✅ XONG

> Cập nhật 13/08/2026. Worker thông báo, hỗ trợ, form liên hệ, sự cố và hóa đơn đều đã xong.

### Đã xong

**Worker thông báo (§21)** — `modules/notifications/`

Từ Pha 4 tới Pha 7, mọi service đều ghi `OutboxEvent` trong CÙNG transaction với thay đổi
dữ liệu, nhưng **chưa có gì đọc hàng chờ đó**. 42 sự kiện đã nằm chờ trong database. Đây là
nửa còn lại của mô hình outbox.

| File | Vai trò |
|---|---|
| `retry.ts` | Backoff, jitter, phân loại lỗi, dead-letter. Module thuần, 25 test |
| `catalog.ts` | Ánh xạ `eventKey` → nội dung thông báo. Module thuần, 57 test |
| `worker.ts` | Nhận sự kiện, xác định người nhận, tạo `Notification` |
| `service.ts` | Đọc thông báo, đánh dấu đã đọc |
| `api/internal/outbox/run` | Endpoint cho bộ lập lịch bên ngoài gọi |

Quyết định đáng ghi lại:

1. **Danh mục sự kiện là module thuần, không đọc `NotificationTemplate` từ database.** Bảng
   template dành cho nội dung doanh nghiệp tự sửa (email marketing, wording theo mùa vụ).
   Thông báo giao dịch cần ổn định và đi cùng code — sửa nội dung phải qua review như sửa
   code, không phải sửa một dòng trong database.

2. **Sự kiện chưa khai báo thì NÉM LỖI**, không im lặng bỏ qua. Thêm sự kiện mới ở service
   mà quên khai báo sẽ vào dead-letter và hiện trong log, thay vì thông báo biến mất không
   ai biết — đúng thứ mô hình outbox sinh ra để tránh.

3. **Phân biệt "cố ý không báo" với "chưa khai báo".** Builder trả `null` là cố ý im lặng;
   `eventKey` không có trong danh mục là lỗi lập trình. Trạng thái nội bộ trong quá trình
   xếp dỡ (`at_pickup`, `packing`, `loading`, `unloading`...) cố ý không báo: báo hết thì
   khách nhận cả chục thông báo một chuyến rồi tắt thông báo, mất luôn cái quan trọng.

4. **Lỗi vĩnh viễn vào dead-letter ngay**, không phí 5 lần thử. Gửi lại email sai định dạng
   5 lần thì cũng sai 5 lần, chỉ tốn thời gian và che khuất lỗi thật. Danh sách lỗi vĩnh
   viễn là allowlist; mọi lỗi khác mặc định coi là tạm thời.

5. **Nhận sự kiện bằng `updateMany` kèm điều kiện trạng thái cũ.** Hai worker chạy song song
   thì chỉ một cái nhận được, cái kia thấy `count = 0` và bỏ qua — không cần khoá riêng.

6. **Giải phóng sự kiện kẹt ở `PROCESSING` quá 15 phút.** Không có mốc này thì một lần
   worker chết giữa chừng sẽ khoá sự kiện đó vĩnh viễn.

**Chưa gửi email/SMS.** `NotificationPreference` chưa có giao diện cho người dùng chọn kênh,
mà gửi email giao dịch khi chưa hỏi ý kiến là sai với §21 và §31. Thông báo trong ứng dụng
thì không cần hỏi vì người dùng chủ động vào xem.

### Lỗi thật phát hiện khi kiểm chứng

**Thông báo gửi cho tài xế nhưng link trỏ tới khu vực khách hàng**

Chạy worker lần đầu trên 42 sự kiện tồn đọng, tài xế nhận được *"Đã phân công tài xế"* với
link `/tai-khoan/don-hang/VT...` — trang mà tài xế không có quyền vào, bấm vào sẽ ra 404.

Nguyên nhân: `linkUrl` là một chuỗi duy nhất cho mọi người nhận, trong khi khách và tài xế
xem cùng một chuyến ở hai khu vực khác nhau.

Sửa: `linkUrl` đổi thành `Partial<Record<Audience, string>>`, worker giữ lại nhóm của từng
người nhận và chọn link tương ứng. Test hồi quy khẳng định link của `CUSTOMER` luôn bắt đầu
bằng `/tai-khoan/`, của `DRIVER` luôn bắt đầu bằng `/tai-xe/`, và nhóm nào nhận thông báo
thì nhóm đó phải có link.

### Kiểm chứng worker trên dữ liệu thật

Chạy trên 42 sự kiện tích luỹ từ Pha 4–7:

| Kiểm tra | Kết quả |
|---|---|
| Xử lý hết hàng chờ | ✅ 42 nhận, 22 tạo thông báo, 20 cố ý bỏ qua |
| Sự kiện chưa khai báo | ✅ 0 dead-letter — mọi `eventKey` đều có trong danh mục |
| Chạy lần hai không tạo trùng | ✅ 0 sự kiện được nhận |
| Tài xế nhận thông báo phân công | ✅ `taixe2` nhận riêng, link `/tai-xe/chuyen/...` |
| Khách nhận link khu vực khách | ✅ `/tai-khoan/don-hang/...` |
| Nội dung tiếng Việt, không lộ mã trạng thái | ✅ có test bao mọi mục trong danh mục |

**Bộ lập lịch chưa có.** Worker chạy qua `POST /api/internal/outbox/run` với header
`x-internal-key`, hoặc gọi trực tiếp `runOutboxOnce()`. Cron hoặc worker thường trú thuộc
Pha 9 — ghi rõ để không ai tưởng nó tự chạy.

**Hỗ trợ khách hàng và tiếp nhận liên hệ (§19, §23)** — `modules/support/`

| File | Vai trò |
|---|---|
| `state-machine.ts` | Vòng đời phiếu, SLA nội bộ. Module thuần, 27 test |
| `schema.ts` | Zod cho phiếu, trả lời, liên hệ công khai |
| `service.ts` | Nghiệp vụ, lọc ghi chú nội bộ ngay trong truy vấn |
| `api/public/contact` | Tiếp nhận form liên hệ, rate limit + honeypot |

Giao diện: `/tai-khoan/ho-tro` (khách tạo và theo dõi phiếu), `/quan-tri/ho-tro` (hàng chờ
nhân viên gom theo quá hạn / chờ xử lý / đang theo dõi, kèm hộp thư liên hệ từ website).

Quyết định đáng ghi lại:

1. **Trạng thái phiếu SUY RA từ hành động, không bắt người dùng chọn.** Khách nhắn thì tới
   lượt nhân viên, nhân viên trả lời thì tới lượt khách. Chỉ những bước không suy ra được
   (đánh dấu đã xử lý, đóng phiếu, mở lại) mới cần thao tác thủ công.

2. **Ghi chú nội bộ KHÔNG đổi trạng thái phiếu.** Đó là trao đổi giữa nhân viên với nhau;
   khách vẫn đang chờ câu trả lời như trước. Không tách ra thì chỉ cần ghi một dòng cho nhau
   là hàng chờ tưởng đã xử lý xong.

3. **Mốc "phản hồi lần đầu" chỉ tính khi nhân viên trả lời KHÁCH.** Cùng lý do trên: tính cả
   ghi chú nội bộ thì SLA trở thành con số vô nghĩa.

4. **Khách KHÔNG chọn mức ưu tiên.** Ai cũng sẽ chọn "khẩn cấp" và mức ưu tiên mất hết ý
   nghĩa. Hệ thống suy ra từ loại phiếu; không loại nào mặc định `URGENT` — mức đó do nhân
   viên nâng lên khi thực sự cần.

5. **SLA là chỉ số NỘI BỘ để xếp hàng chờ, không phải cam kết với khách.** Cam kết dịch vụ là
   nội dung pháp lý phải do doanh nghiệp quyết định và công bố (§1), nên con số này không
   hiển thị ở giao diện khách.

6. **Lý do đổi trạng thái lưu thành TIN NHẮN cho khách đọc**, không giấu trong nhật ký hệ
   thống. Khách có quyền biết vì sao phiếu của mình được đánh dấu đã xử lý.

7. **Khách mở lại được phiếu đã xử lý** thay vì phải tạo phiếu mới và kể lại từ đầu. Nhân
   viên thì không tự mở lại thay khách.

### Ranh giới nội bộ / khách hàng — điểm quan trọng nhất của §19

Điều kiện `visibility` nằm TRONG truy vấn, không lọc sau khi lấy về:

```ts
messages: {
  where: party === "STAFF" ? {} : { visibility: "CUSTOMER_VISIBLE" },
  ...
}
```

Dữ liệu không rời khỏi database thì không có đường rò rỉ qua log, cache, hay một lỗi ở tầng
giao diện. Nhãn "Nội bộ" trên màn hình nhân viên chỉ để họ biết mình đang xem gì, không phải
cơ chế bảo vệ.

Cờ `internal` từ client cũng không được tin: service kiểm tra lại quyền, khách gửi cờ này
thì bị bỏ qua.

Test: `tests/integration/support-visibility.test.ts` (6 test) khẳng định chuỗi JSON trả về
cho khách không chứa nội dung ghi chú nội bộ lẫn chuỗi `"INTERNAL"`, và bản ghi vẫn còn
nguyên trong database — bị lọc khi đọc chứ không bị xoá.

### Kiểm chứng end-to-end trên trình duyệt thật

| Kiểm tra | Kết quả |
|---|---|
| Form liên hệ công khai tạo `ContactInquiry` | ✅ API 201, alert hiện, form reset |
| Bẫy bot: điền trường ẩn | ✅ trả 201 giả thành công, KHÔNG tạo bản ghi |
| Khách tạo phiếu khiếu nại | ✅ mã phiếu sinh ra, trạng thái "Mới tạo" |
| Khách thấy ô ghi chú nội bộ | ✅ không có (0 phần tử) |
| Nhân viên thấy ô ghi chú nội bộ | ✅ có |
| Nhân viên gửi ghi chú nội bộ | ✅ trạng thái phiếu KHÔNG đổi |
| Nhân viên trả lời khách | ✅ chuyển "Chờ bạn phản hồi" |
| **Khách xem lại: ghi chú nội bộ** | ✅ không có trong text lẫn HTML thô |
| Khách khác mở cùng phiếu | ✅ 404, không thấy nội dung |
| Liên hệ hiện trong hàng chờ nhân viên | ✅ |
| Bot spam lọt vào hàng chờ | ✅ không |

### Lỗi nhỏ sửa kèm

`DashboardNav` thiếu khai báo icon `ReceiptText`, nên mục "Báo giá" của khách hiện nhầm icon
mặc định giống hệt mục "Tổng quan". Đã bổ sung cùng `LifeBuoy` cho mục hỗ trợ mới, kèm ghi
chú nhắc danh sách icon phải khớp với `dashboardNav`.


**Sự cố vận hành (§19)** — `modules/incidents/`

Trước module này, tài xế báo sự cố bằng cách chuyển chuyến sang trạng thái `INCIDENT` kèm lý
do. Cách đó ghi được VIỆC GÌ xảy ra nhưng không theo dõi được AI đang xử lý, tới đâu, kết
luận ra sao. Bản ghi `Incident` bổ sung đúng phần thiếu.

| File | Vai trò |
|---|---|
| `state-machine.ts` | 5 trạng thái, mức độ mặc định theo loại. Module thuần, 19 test |
| `service.ts` | Báo, xử lý, phân công. Lọc theo quyền khi đọc |
| `/quan-tri/su-co` + `/[code]` | Hàng chờ và trang xử lý |

Quyết định đáng ghi lại:

1. **Tài xế KHÔNG chọn mức nghiêm trọng.** Người đang đứng giữa đường không phải là người
   đánh giá mức độ, và để tự chọn thì mức độ mất tính so sánh giữa các sự cố. Hệ thống suy
   ra từ loại; điều phối điều chỉnh sau khi xác minh.

2. **Tai nạn và mất hàng luôn ở mức `CRITICAL`** bất kể ai báo — loại việc không được phép
   chìm trong hàng chờ.

3. **Chỉ sự cố đủ nghiêm trọng mới tự dừng chuyến.** Chậm trễ vài chục phút hay không liên
   hệ được khách thì chuyến vẫn chạy; tự dừng sẽ làm hỏng dữ liệu vận hành.

4. **Không nhảy thẳng từ `OPEN` sang `CLOSED`** — phải qua `RESOLVED` kèm kết luận. Đóng mà
   không giải thích là mất dấu vết xử lý.

5. **Khách hàng KHÔNG đọc chi tiết sự cố.** Mô tả nội bộ có thể nêu tên nhân sự, lỗi vận
   hành và đánh giá trách nhiệm. Khách được biết chuyến gặp sự cố qua trạng thái đơn.

6. **Báo sự cố muộn về chuyến đã đóng không kéo ngược trạng thái.** `updateMany` kèm điều
   kiện `status notIn [COMPLETED, CANCELLED, FAILED]` — bản ghi sự cố vẫn tạo được để lưu hồ
   sơ, nhưng dữ liệu đã chốt không bị sửa.

### Lỗi thật nghiêm trọng phát hiện khi kiểm thử

**Chuyến chạy trễ khoá tài xế khỏi hệ thống** — `modules/auth/policy.ts`

`requireShipmentUpdateAccess` đòi assignment còn hiệu lực TẠI THỜI ĐIỂM HIỆN TẠI, tức là
`effectiveFrom <= now < effectiveTo`. Khi kiểm thử gặp chuyến `VT84ME5FJE3A` đang ở trạng
thái `IN_TRANSIT` — xe vẫn đang chạy — nhưng khung giờ phân công đã kết thúc 7 tiếng trước.
Kết quả: tài xế không đổi được trạng thái, không tải được ảnh, **không báo được sự cố**, và
không lập được biên bản giao hàng. Đúng lúc họ cần hệ thống nhất.

Chuyến chạy trễ hơn dự kiến là chuyện thường ngày trong vận tải, nên đây không phải trường
hợp hiếm mà là lỗi sẽ gặp gần như mỗi ngày.

Nguyên nhân gốc: dùng nhầm khung giờ làm ranh giới phân quyền. Khung giờ
`effectiveFrom`–`effectiveTo` là công cụ LẬP LỊCH để chống trùng xe và tài xế (§14.3).

Sửa: điều kiện cập nhật đổi thành **giữ phân công chưa bị gỡ** (`isActive`) **và chuyến chưa
khép lại**. Thu hồi quyền trở thành hành động rõ ràng — điều phối gỡ phân công, hoặc chuyến
đi tới trạng thái kết thúc — thay vì âm thầm hết hạn theo đồng hồ.

Quy tắc theo thời gian vẫn giữ nguyên ở chỗ nó đúng: khách chỉ xem được thông tin tài xế
trong cửa sổ chuyến hoạt động (§16.1) — đó là quy tắc RIÊNG TƯ, không phải phân quyền ghi.

Test cũ `requireShipmentUpdateAccess chặn tài xế có assignment đã hết hạn` chính là chỗ mã
hoá hành vi sai này. Đã thay bằng 5 test mới: chuyến trễ vẫn cập nhật được, tài xế bị gỡ thì
không, chuyến đã `COMPLETED`/`CANCELLED`/`FAILED` thì không, tài xế chuyến khác thì không.

### Kiểm chứng end-to-end trên trình duyệt thật

| Kiểm tra | Kết quả |
|---|---|
| Tài xế chọn loại sự cố và mô tả | ✅ tạo `SC2DYF27FN` |
| Xe hỏng (`HIGH`) KHÔNG tự dừng chuyến | ✅ vẫn `IN_TRANSIT` |
| Sự cố hiện trong hàng chờ, nhóm "Đang mở" | ✅ |
| Mức độ mặc định đúng theo loại | ✅ "Nghiêm trọng" |
| Ô kết luận bắt buộc khi chọn "Đã xử lý" | ✅ |
| Kết luận lưu và hiển thị lại | ✅ |
| Trang điều phối hiện khối sự cố của chuyến | ✅ |
| Khách thấy mô tả nội bộ sự cố | ✅ không |
| Khách mở thẳng `/quan-tri/su-co/[code]` | ✅ 404 |


**Hóa đơn và ghi nhận thanh toán (§20)** — `modules/invoices/`

| File | Vai trò |
|---|---|
| `totals.ts` | Tính tiền bằng Decimal. Module thuần, 19 test |
| `state-machine.ts` | 6 trạng thái, trạng thái suy ra từ số tiền. Module thuần, 29 test |
| `service.ts` | Lập, phát hành, hủy, ghi nhận và đối chiếu thanh toán |
| `/quan-tri/hoa-don` + `/moi` + `/[invoiceNumber]` | Danh sách, lập, chi tiết |
| `/tai-khoan/hoa-don` + `/[invoiceNumber]` | Khách xem hóa đơn của mình |

**PHẠM VI:** không có cổng thanh toán online, không lưu bất kỳ dữ liệu thẻ nào. Hệ thống ghi
nhận khoản đã nhận qua tiền mặt hoặc chuyển khoản để đối chiếu công nợ.

Quyết định đáng ghi lại:

1. **Trạng thái hóa đơn SUY RA TỪ SỐ TIỀN, không cho nhân viên tự đặt.** Trả đủ thì `PAID`,
   trả một phần thì `PARTIALLY_PAID`, quá hạn mà chưa đủ thì `OVERDUE`. Để nhân viên tự chọn
   là mở đường cho sổ sách lệch với thực tế thu tiền. Chỉ `DRAFT` và `VOID` là quyết định của
   con người.

2. **Hai bước tách bạch: GHI NHẬN rồi mới XÁC NHẬN.** Khoản mới ghi ở trạng thái `PENDING` —
   khách báo đã chuyển nhưng kế toán chưa đối chiếu sao kê. Công nợ chỉ giảm sau khi xác
   nhận. Nhờ vậy người nhập liệu và người đối chiếu có thể là hai người khác nhau.

3. **`paidAmount` và `balanceAmount` luôn TÍNH LẠI từ bảng `PaymentRecord`**, không cộng trừ
   tại chỗ. Cộng trừ tại chỗ là cách sổ sách lệch dần theo thời gian mà không ai biết từ lúc
   nào.

4. **Đảo khoản không xóa bản ghi** mà chuyển `REVERSED` kèm lý do. Khoản tiền đã từng được
   ghi nhận là sự kiện có thật; xóa đi làm mất dấu vết đối chiếu.

5. **Hóa đơn đã thu đủ tiền KHÔNG hủy được.** Cần điều chỉnh thì lập chứng từ hoàn tiền —
   hủy hóa đơn đã thanh toán sẽ làm mất dấu khoản tiền đã nhận.

6. **Trả thừa cho số dư ÂM**, không kẹp về 0 — kế toán phải nhìn thấy để xử lý.

7. **Giảm giá toàn hóa đơn phân bổ theo tỷ lệ vào phần chịu thuế của từng dòng.** Trừ thẳng
   vào tổng cuối sẽ khiến thuế tính trên số tiền khách không thực trả.

8. **Thông tin xuất hóa đơn là SNAPSHOT**, không tham chiếu hồ sơ khách. Khách đổi địa chỉ
   sau này thì hóa đơn cũ giữ nguyên địa chỉ đã in.

9. **Dòng chi phí mồi lấy từ BẢN BÁO GIÁ ĐÃ CHẤP NHẬN**, không phải bản mới nhất — khách đồng
   ý bản nào thì xuất hóa đơn theo bản đó (§13.3). Chỉ là gợi ý; kế toán xem lại và chịu
   trách nhiệm về con số.

10. **Xem trước tổng tiền trên giao diện dùng ĐÚNG module `totals.ts` mà server dùng.** Hai
    công thức ở hai phía là cách chắc chắn để sinh ra khiếu nại.

11. **Ghi nhận tiền đòi xác thực gần đây** (`requireFreshAuth`, §30.2).

12. **Cảnh báo "không phải hóa đơn điện tử hợp pháp"** hiện ở cả ba màn hình: danh sách, chi
    tiết cho kế toán, và chi tiết cho khách. Số chứng từ do hệ thống sinh chỉ để đối chiếu
    công nợ (§1, §20).

### Kiểm chứng end-to-end trên trình duyệt thật

Kế toán (`ketoan@local.test`) chạy trọn luồng trên chuyến đã hoàn tất:

| Kiểm tra | Kết quả |
|---|---|
| Mồi dòng chi phí từ báo giá đã chốt | ✅ 4.200.000 ₫ khớp báo giá |
| Xem trước tổng tiền trước khi lưu | ✅ khớp con số sau khi lưu |
| Hóa đơn lập ra ở trạng thái nháp | ✅ `HD2026-00001` |
| **Hóa đơn nháp chặn ghi nhận thanh toán** | ✅ không có nút, kèm giải thích |
| **Khách KHÔNG thấy hóa đơn nháp** | ✅ không trong danh sách, mở thẳng URL ra 404 |
| Sau phát hành mới hiện nút ghi nhận | ✅ |
| **Khoản mới ghi ở trạng thái chờ đối chiếu** | ✅ công nợ chưa giảm |
| Sau khi xác nhận, công nợ mới giảm | ✅ 4.200.000 − 1.000.000 = 3.200.000 |
| Trạng thái tự chuyển "Đã thanh toán một phần" | ✅ không ai đặt tay |
| Khách thấy hóa đơn đã phát hành + lịch sử thanh toán | ✅ |
| **Khách thấy ghi chú nội bộ** | ✅ không |
| Khách khác mở cùng hóa đơn | ✅ 404 |

### Hạn chế đã biết

`requireFreshAuth` với quyền `payment.record` đòi MFA cho vai trò quyền cao (ADMIN,
SUPER_ADMIN) theo §30.2, nhưng **MFA chưa được triển khai**. Hệ quả: ADMIN không ghi nhận
được thanh toán cho tới khi có MFA; ACCOUNTANT thì làm bình thường vì không thuộc nhóm quyền
cao. Đây là hành vi đúng thiết kế, nhưng cần MFA trước khi ADMIN cần thao tác trực tiếp.


### Kết quả kiểm tra tại thời điểm chốt Pha 8

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **758/758** (29 file) |
| `pnpm test:e2e` | ✅ **100 pass**, 16 skip |

### CÒN NỢ LẠI của Pha 8

Đều là phần bổ trợ, không chặn luồng nghiệp vụ chính:

1. Giao diện quản trị cho dead-letter — `listDeadLetters()` và `requeueDeadLetter()` đã có,
   chưa có màn hình gọi tới.
2. Đính kèm tệp vào phiếu hỗ trợ (`TicketAttachment`) và ảnh bằng chứng sự cố
   (`IncidentMedia`) — module `media` đã sẵn sàng, chưa nối.
3. Phân công người xử lý phiếu và sự cố — `assignTicket()` và `updateIncident()` đã có ở
   service, chưa có ô chọn người phụ trách trên giao diện.
4. MFA cho vai trò quyền cao — chặn ADMIN ghi nhận thanh toán (xem hạn chế ở trên).

---


## Pha 9 — Hoàn thiện ✅ XONG

### 9.1 — Header bảo mật (§30.1)

`src/lib/security-headers.ts` (module thuần), gắn ở `src/middleware.ts` cho trang và
`next.config.ts` cho `/api/*`.

Đặt đủ: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options`, `Cross-Origin-Opener-Policy`.

#### Vấn đề đã phát hiện và cách xử lý: CSP nonce làm trắng trang tĩnh

Bản cài đặt đầu tiên dùng một mức CSP nghiêm ngặt dựa trên nonce cho toàn site. Kiểm chứng
trên bản build production cho thấy nó **giết toàn bộ site public**:

```
/          21 thẻ script,  7 inline,  0 mang nonce
/tin-tuc/… 20 thẻ script,  9 inline,  0 mang nonce
/tra-cuu   20 thẻ script,  6 inline,  0 mang nonce
```

Nguyên nhân: nonce phải mới theo từng request, nhưng HTML của trang prerender được sinh
**lúc build**. Không có cách nào áp nonce lên HTML đã lưu sẵn.

Cách xử lý — CSP hai mức:

| Mức | Áp cho | `script-src` |
|---|---|---|
| `strict` | Khu vực đăng nhập + nhóm `(auth)` | nonce + `strict-dynamic`, không `unsafe-inline` |
| `static` | Trang public prerender | `'self' 'unsafe-inline'` |

Cả ba khu vực đăng nhập (`/tai-khoan`, `/tai-xe`, `/quan-tri`) vốn đã render động. Nhóm
`(auth)` được **ép** động qua `export const dynamic = "force-dynamic"` trong
`src/app/(auth)/layout.tsx` — trang đăng nhập là đích ngắm hàng đầu của XSS đánh cắp thông
tin đăng nhập, và các trang này vốn đã `Cache-Control: no-store` nên prerender không mang
lại gì.

Bất biến này được chốt bằng `tests/unit/csp-static-route-guard.test.ts`: test đọc
`.next/prerender-manifest.json` sau khi build và báo lỗi nếu có route tĩnh nào nằm dưới khu
vực riêng tư. Không có nó, ai đó thêm một trang tĩnh dưới `/tai-khoan` sẽ làm trang đó trắng
mà lint, typecheck lẫn test đơn vị đều không phát hiện.

#### Kiểm chứng thực tế

14/14 màn hình riêng tư (điều phối, kế toán, khách hàng, tài xế) hydrate sạch dưới CSP nonce,
không một vi phạm nào trong console.

### 9.2 — Health check (§25)

| Endpoint | Chạm database | Dùng để |
|---|---|---|
| `/api/health/live` | Không | Quyết định khởi động lại tiến trình |
| `/api/health/ready` | Có | Quyết định có gửi lưu lượng vào không |

`live` cố ý **không** chạm database: nếu nó phụ thuộc database, một sự cố database sẽ làm
restart hàng loạt ứng dụng vốn vẫn khoẻ mạnh.

`src/modules/health/readiness.ts` là module thuần nhận danh sách phép kiểm tra dưới dạng
hàm — kiểm thử được cả nhánh chậm và nhánh treo bằng đồng hồ giả. `degraded` trả `200` chứ
không `503`: database chậm vẫn tốt hơn không node nào phục vụ.

Phản hồi không chứa nội dung lỗi. Lỗi Prisma chứa host, cổng và tên người dùng database;
endpoint này thường để mở cho load balancer.

### 9.3 — Bộ lập lịch

Ba job trước đây phải gọi tay giờ tự chạy:

| Job | Chu kỳ |
|---|---|
| `outbox` | 60 giây |
| `purge-locations` | 6 giờ |
| `cleanup-media` | 6 giờ |

`cleanup-media` là **mới** — `src/modules/media/cleanup.ts` chưa từng tồn tại. Nó dọn intent
bỏ dở quá 24 giờ và bản ghi `REJECTED` quá 90 ngày. Xoá storage trước, database sau: làm
ngược lại thì storage lỗi sẽ để lại tệp mồ côi vĩnh viễn.

`src/modules/scheduler/schedule.ts` (thuần) quyết định "đến giờ chưa", `runner.ts` chạy.
Chống chạy chồng: job đang chạy dở thì bỏ lượt, không xếp hàng đợi.

Hai cách triển khai, chọn một:

- `SCHEDULER_ENABLED=true` — chạy trong tiến trình. Chỉ dùng khi triển khai MỘT tiến trình.
- `SCHEDULER_ENABLED=false` + cron ngoài gọi `POST /api/internal/scheduler/run`. Bắt buộc
  khi chạy nhiều instance hoặc trên nền serverless.

Mặc định là `false` — bật nhầm ở nhiều instance là nhân công việc lên theo số instance.

Trạng thái đặt trên `globalThis` chứ không ở phạm vi module: hot-reload của Next.js nạp lại
module liên tục, giữ ở module sẽ sinh hàng chục worker song song sau vài lần sửa file.

Việc dừng gọn theo `SIGTERM`/`SIGINT` nằm trong `runner.ts` chứ không trong
`src/instrumentation.ts` — file instrumentation cũng được bundle cho runtime Edge, và trình
đóng gói cảnh báo `process.once` không dùng được ở đó kể cả khi đã chặn theo `NEXT_RUNTIME`.

#### Kiểm chứng thực tế

```
job=purge-locations  durationMs=93   result=0
job=outbox           durationMs=114  result={claimed:5, sent:1, failed:1, skipped:3}
job=cleanup-media    durationMs=16   result={abandoned:0, rejectedPurged:0}
```

Cả ba chạy thật trên bản build production; outbox xử lý 5 bản ghi tồn đọng.

### 9.4 — Tài liệu (§35)

12 file mới:

| File | Nội dung |
|---|---|
| `architecture.md` | Phân tầng, mẫu outbox, ba lớp chống trùng lịch, và những gì cố tình không làm |
| `data-dictionary.md` | 74 model theo miền, kèm bảng "đã có nhưng chưa dùng" |
| `workflows.md` | Vòng đời 6 đối tượng, sơ đồ chuyển trạng thái |
| `api.md` | 14 endpoint, 17 mã lỗi |
| `security.md` | Mô hình bảo mật + danh sách chưa làm |
| `storage-media.md` | Luồng upload 8 bước, magic bytes, vì sao cấm SVG |
| `location-privacy.md` | Thời hạn lưu trữ, nghĩa vụ với tài xế |
| `notifications.md` | Outbox, backoff, dead letter |
| `deployment.md` | Triển khai + §8 "chưa đủ điều kiện chạy thật" |
| `backup-restore.md` | Chưa có backup nào — hướng dẫn dựng |
| `operations-runbook.md` | Sự cố thường gặp và cách xử lý |
| `content-guide.md` | Hướng dẫn biên tập, ràng buộc §1 |

### 9.5 — Nghiệm thu

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ **827/827** (33 file) |
| `pnpm test:e2e` | ✅ **132 pass**, 16 skip |
| `pnpm build` | ✅ 0 cảnh báo |
| `pnpm audit --prod` | ✅ Không có lỗ hổng đã biết |

Tăng so với Pha 8: +69 test đơn vị/tích hợp, +32 E2E.

`tests/e2e/security-headers.spec.ts` là bổ sung đáng chú ý: nó khẳng định **mọi** thẻ script
inline trên trang đăng nhập đều mang đúng nonce của response. Test đơn vị không bắt được điều
này vì nó chỉ kiểm chuỗi CSP dựng ra, không kiểm Next.js có thật sự nhúng nonce hay không —
và sai ở điểm đó là trang trắng.

---

## Còn nợ lại sau Pha 9

### Chặn vận hành thật

| Hạng mục | Trạng thái |
|---|---|
| **Quét mã độc** | `VIRUS_SCAN_PROVIDER=noop` — không quét gì. Chặn tiếp nhận tệp từ người ngoài |
| **MFA** | Chưa có. ADMIN không ghi nhận được thanh toán |
| Storage | `local` — mất máy chủ là mất ảnh bằng chứng giao hàng |
| Email / SMS | `console` — khách không nhận được gì |
| Backup | Chưa có |
| Giám sát lỗi | `ERROR_MONITORING_DSN` trống |

### Tính năng chưa làm

- Giao diện quản trị cho dead-letter
- `TicketAttachment` và `IncidentMedia` chưa nối vào giao diện
- Ô chọn người phụ trách cho phiếu hỗ trợ và sự cố
- Màn hình quản trị: `/quan-tri/don-hang`, `/bang-gia`, `/noi-dung`, `/tin-tuc`, `/lien-he`,
  `/thong-bao`, `/nguoi-dung`, `/nhat-ky`, `/cau-hinh`
- `/tai-khoan/ho-so` còn mock
- Form tạo tài xế
- Module `pricing`, `services`, `users` còn rỗng
- Idempotency-Key
- Job dọn `AuditLog` và `OutboxEvent` đã gửi
- Ảnh thu nhỏ, chuyển mã video
- Chữ ký điện tử cho bằng chứng giao hàng

### Hạn chế đã biết, không sửa

`notFound()` dưới `/tai-khoan` trả HTTP 200 thay vì 404 vì `loading.tsx` tạo một Suspense
boundary khiến shell được flush sớm. Trang 404 vẫn hiển thị đúng cho người dùng; chỉ mã
trạng thái sai, và các route này đều `noindex` + sau đăng nhập.
