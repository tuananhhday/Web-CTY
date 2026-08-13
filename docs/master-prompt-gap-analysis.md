# Đối chiếu tiến độ với Master Prompt gốc

> Nguồn: `C:\Users\ADMIN\Downloads\Đã dán markdown (1).md` (39 mục, phiên bản rà soát 10/08/2026).
> Tài liệu này đối chiếu TỪNG MỤC với trạng thái thật của repo tại thời điểm cập nhật.
> Đọc file này TRƯỚC khi tiếp tục — nó trả lời "còn thiếu đúng cái gì so với yêu cầu gốc",
> khác với `implementation-status.md` vốn kể theo trình tự pha đã làm.

**Cập nhật:** 13/08/2026 — Pha 1–9 xong. Toàn bộ lộ trình §37 đã hoàn thành.
**Trạng thái build:** lint sạch, typecheck sạch, build 0 cảnh báo, 827 unit/integration
test pass, 132 E2E test pass, `pnpm audit --prod` không có lỗ hổng.

> **Hoàn thành lộ trình KHÔNG có nghĩa là sẵn sàng production.** Hai điều kiện chặn vẫn
> còn: quét mã độc là adapter `noop` (không quét gì) và MFA chưa triển khai. Xem
> `deployment.md` §8.

> **Đính chính bản 11/08:** bản trước ghi "chỉ có 1 link chết". Kiểm tra thực tế phát hiện
> **7 link chết** — `AdminNav` trỏ tới 6 trang chưa tồn tại (`/quan-tri/don-hang`,
> `/bang-gia`, `/hoa-don`, `/noi-dung`, `/nguoi-dung`, `/nhat-ky`) cộng với
> `/quan-tri/dieu-phoi/[code]`. Đã sửa hết: trang điều phối chi tiết được xây, các mục
> chưa có trang bị ẩn khỏi nav cho tới khi làm xong.

---

## Cách đọc bảng dưới

- ✅ Xong — khớp yêu cầu, có test hoặc đã kiểm chứng thủ công
- 🟡 Dở — có khung sườn (schema/route rỗng) nhưng chưa hoạt động đầy đủ
- ⬜ Chưa làm — chưa có gì

## §1 — Nguyên tắc không được vi phạm

| Yêu cầu | Trạng thái |
|---|---|
| Không bịa số liệu doanh nghiệp | ✅ `CompanyProfile` seed rỗng, `pendingFields` đánh dấu |
| Không tự bịa bảng giá | ✅ `PriceCatalogVersion` seed rỗng, `isReferenceOnly=true` |
| Không tạo route/UI cho "Tìm hàng Facebook" | ✅ Không có gì trong code, chỉ ghi ở `future-features.md` |
| Không tạo route/UI cho AI ước tính giá | ✅ Đã gỡ hoàn toàn ở Pha 1 (từng có ở bản demo ban đầu, đã xóa) |

## §2 — Mục tiêu sản phẩm (4 nhóm người dùng)

| Nhóm | Trạng thái |
|---|---|
| 1. Khách chưa đăng nhập | ✅ Đầy đủ — trang chủ, dịch vụ, bảng giá, tra cứu cơ bản |
| 2. Khách đã đăng nhập | 🟡 Đầy đủ trừ hồ sơ và sổ địa chỉ vẫn còn mock |
| 3. Tài xế | ✅ `/tai-xe/*` đầy đủ: chuyến, đổi trạng thái, ảnh, biên bản giao hàng |
| 4. Nhân viên | 🟡 Yêu cầu, báo giá, điều phối, hỗ trợ, sự cố, hóa đơn đã có. Nội dung, bảng giá, người dùng, nhật ký **chưa có UI** |

## §3 — Phạm vi bắt buộc

### §3.1 Public — 18 route yêu cầu

| Route | Trạng thái |
|---|---|
| `/` | ✅ |
| `/gioi-thieu` | ✅ |
| `/dich-vu`, `/dich-vu/[slug]` | ✅ |
| `/chuyen-nha` | ✅ (kèm `/chuyen-nha/yeu-cau`) |
| `/doi-xe` | ✅ |
| `/khu-vuc-phuc-vu` | ✅ |
| `/bang-gia`, `/bang-gia/boc-xep` | ✅ |
| `/bao-gia` (form vận chuyển) | ✅ form thật, gọi API thật |
| Form chuyển nhà/văn phòng | ✅ `/chuyen-nha/yeu-cau` |
| `/tra-cuu` | ✅ Nối API thật, hai mức công khai/riêng tư theo §16.1 |
| `/tin-tuc`, `/tin-tuc/[slug]` | ✅ |
| `/faq` | ✅ |
| `/lien-he` | ✅ Lưu `ContactInquiry` thật, rate limit + honeypot |
| `/chinh-sach/*` (4 trang) | ✅ Bản nháp có cảnh báo chưa duyệt |

### §3.2 Customer — 13 mục yêu cầu

| Mục | Trạng thái |
|---|---|
| Đăng ký/đăng nhập/đăng xuất | ✅ Better Auth thật |
| Xác minh email/SĐT | ✅ Email qua Better Auth. SĐT **chưa** (cần plugin `phoneNumber`) |
| Quên/đặt lại/đổi mật khẩu | ✅ |
| Hồ sơ và sổ địa chỉ | 🟡 `/tai-khoan/ho-so` là UI cũ (mock), **chưa nối `UserProfile`/`UserAddress` thật** |
| Quản lý yêu cầu dịch vụ | ✅ `/tai-khoan/yeu-cau` đầy đủ |
| Xem/phản hồi/chấp nhận/từ chối báo giá | ✅ `/tai-khoan/bao-gia` đầy đủ, có khóa revision |
| Theo dõi đơn hàng chi tiết | ✅ `/tai-khoan/don-hang` nối `Shipment` thật, tiến trình 5 mốc |
| Xem ảnh/video theo giai đoạn | ✅ Chỉ thấy tệp đánh dấu `CUSTOMER`, gom theo giai đoạn |
| Xem thông tin tài xế khi chuyến hoạt động | ✅ Chỉ hiện trong cửa sổ thời gian chuyến hoạt động |
| Xem vị trí xe | ✅ Chỉ khi doanh nghiệp bật chia sẻ, toạ độ làm thô ~100m |
| Xem bằng chứng giao hàng | 🟡 Dữ liệu có; chưa hiện trên màn hình khách |
| Hóa đơn và thanh toán | ✅ `/tai-khoan/hoa-don`, chỉ thấy hóa đơn đã phát hành của mình |
| Tạo/theo dõi yêu cầu hỗ trợ | ✅ `/tai-khoan/ho-tro`, không đọc được ghi chú nội bộ |
| Tùy chọn thông báo, quyền riêng tư | ⬜ Chưa có UI |

### §3.3 Driver

| Mục | Trạng thái |
|---|---|
| `/tai-xe`, `/tai-xe/chuyen/[code]` | ✅ Mobile-first, `requireDriver` chặn người ngoài |
| Danh sách chuyến, chi tiết, gọi điện | ✅ Gom Hôm nay/Sắp tới/Đã xong, nút gọi và dẫn đường |
| Cập nhật trạng thái theo state machine | ✅ Một nút CTA duy nhất, xác nhận hai bước |
| Lập biên bản sự cố | ✅ Tạo bản ghi `Incident` theo dõi được. Chưa gắn ảnh bằng chứng |
| Tải ảnh/video từng giai đoạn | ✅ Gợi ý giai đoạn theo trạng thái, chọn được chia sẻ cho khách |
| Gửi vị trí | ✅ Opt-in, gom lô, chịu được mất sóng, tự tắt khi rời trang |
| Tạo POD (OTP/chữ ký/ảnh) | ✅ OTP xong; chữ ký điện tử chưa có |

### §3.4 Staff/Admin — 18 route yêu cầu

| Route | Trạng thái |
|---|---|
| `/quan-tri` (tổng quan) | ✅ |
| `/quan-tri/yeu-cau` | ✅ |
| `/quan-tri/bao-gia` | ✅ |
| `/quan-tri/don-hang` | ⬜ Chưa tồn tại (khác với `/quan-tri/dieu-phoi`) |
| `/quan-tri/dieu-phoi` | ✅ Danh sách + trang chi tiết `[code]` đầy đủ |
| `/quan-tri/xe` | ✅ Đọc + thêm (`/moi`) + sửa (`/[id]/sua`) |
| `/quan-tri/tai-xe` | ✅ Đọc + sửa (`/[id]/sua`). **Chưa tạo mới được** (cần module người dùng) |
| `/quan-tri/bang-gia` | ⬜ Chưa có UI quản lý (chỉ seed rỗng qua code) |
| `/quan-tri/hoa-don` | ✅ Danh sách, lập từ chuyến, ghi nhận và đối chiếu thanh toán |
| `/quan-tri/ho-tro` | ✅ Hàng chờ gom theo quá hạn/chờ xử lý, kèm hộp thư liên hệ |
| `/quan-tri/su-co` | ✅ Hàng chờ + trang xử lý, bắt buộc kết luận khi khép lại |
| `/quan-tri/noi-dung` | ⬜ CMS chỉnh qua database trực tiếp, chưa có UI |
| `/quan-tri/tin-tuc` | ⬜ |
| `/quan-tri/lien-he` | ⬜ |
| `/quan-tri/thong-bao` | ⬜ |
| `/quan-tri/nguoi-dung` | ⬜ |
| `/quan-tri/nhat-ky` | ⬜ AuditLog có ghi, **chưa có UI xem** |
| `/quan-tri/cau-hinh` | ⬜ |

## §4 — Công nghệ và kiến trúc

✅ Khớp gần như tuyệt đối: Next.js App Router + TS strict, Tailwind, Prisma + PostgreSQL,
Better Auth, Zod, React Hook Form, Vitest, Playwright, Docker Compose, pnpm.

Khác biệt có chủ đích (đã giải thích lý do trong `implementation-status.md`):
- Redis: chưa triển khai adapter thật, đang dùng in-memory (đúng theo §4 cho phép khi 1 instance)
- StorageProvider/MapProvider/EmailProvider/SmsProvider: có interface, **đa số vẫn là mock/console**
- VirusScanProvider: chưa có gì (noop)

18 module theo §4 → xem bảng riêng bên dưới.

## Danh sách 18 module (§4)

| Module | Trạng thái | Ghi chú |
|---|---|---|
| auth | ✅ | Đầy đủ theo Pha 2 |
| users | ⬜ | Chỉ có README, chưa có service riêng (dùng chung qua auth) |
| cms | ✅ | Đọc xong (Pha 3). Ghi/quản trị UI chưa có |
| services | ⬜ | Đọc qua `cms/repository.ts`, chưa tách module riêng như đề xuất |
| service-requests | ✅ | Đầy đủ (Pha 4) |
| pricing | ⬜ | Logic tính nằm trong `quotes/pricing.ts`, chưa tách bảng giá riêng |
| quotes | ✅ | Đầy đủ (Pha 5) |
| fleet | ✅ | Đọc, ghi, chống double-booking. Thiếu tạo tài xế và lịch bận |
| shipments | ✅ | Tạo đơn, phân công, đổi trạng thái, timeline |
| tracking | ✅ | Che dữ liệu công khai, tra cứu hai mức. 24 test |
| media | ✅ | Upload 8 bước, magic bytes, proxy xác thực. 30 test |
| locations | ✅ | 7 luật lọc ping, làm thô toạ độ, retention. 25 test |
| proof-of-delivery | ✅ | OTP hash, chuỗi điều chỉnh bất biến. 22 unit + 7 integration test |
| incidents | ✅ | 5 trạng thái, mức độ theo loại, tự dừng chuyến khi nghiêm trọng. 19 test |
| support | ✅ | Phiếu hỗ trợ 2 mức hiển thị, liên hệ công khai. 27 unit + 6 integration test |
| invoices | ✅ | Decimal, trạng thái suy ra từ số tiền, ghi nhận 2 bước. 48 test |
| notifications | ✅ | Worker outbox có backoff/dead-letter, trung tâm thông báo. 82 test. Chưa gửi email/SMS |
| audit | ✅ | Ghi xong, UI xem log chưa có |

## §5–§10 — Kiến trúc, thiết kế, route, quyền, auth, CMS

✅ Xong hoàn toàn — đây là nền móng, đã kiểm chứng kỹ ở Pha 1–3:
- Modular monolith đúng cấu trúc §5
- Design system §6 đúng token, palette, responsive 5 breakpoint
- RBAC 8 vai trò đúng §8, có test IDOR
- Auth đúng §9: cookie HttpOnly, rate limit, chống enumeration
- CMS đúng §10: sanitize 2 lớp, draft/published, revision qua `updatedAt`

## §11–§12 — Yêu cầu báo giá và chuyển nhà

✅ Xong theo Pha 4. Còn thiếu so với §11 chi tiết:
- Magic link cho khách vãng lai: đã sinh token, **API xác thực bằng token chưa có**
- Upload ảnh hàng hóa trong form: **chưa có** (phụ thuộc module `media`)
- Lưu bản nháp: state `DRAFT` có trong state machine, **UI luôn gửi thẳng, chưa cho lưu nháp**

## §13 — Bảng giá và báo giá

🟡 Phần **báo giá riêng (§13.3)** xong hoàn toàn — đây là phần khó nhất, đã làm kỹ (Pha 5).

Phần **bảng giá công khai (§13.1) và giá bốc xếp (§13.2)**: có schema và trang public đọc
được, nhưng:
- ⬜ Chưa có UI quản trị để nhân viên NHẬP giá — hiện chỉ sửa được qua Prisma Studio/SQL
- ⬜ Chưa tự động áp giá từ `VehicleRate` vào báo giá — nhân viên gõ tay đơn giá

## §14 — Đội xe, tài xế, điều phối

✅ Phần khó nhất (§14.3 chống double-booking) xong và kiểm chứng bằng 14 integration test
chạm database thật, cộng kiểm chứng giao diện end-to-end bằng Playwright: cảnh báo trùng
lịch nêu đúng mã đơn, nút bị khoá tới khi tick bỏ qua, override được ghi nhật ký.

✅ Thêm/sửa xe (`/quan-tri/xe/moi`, `/[id]/sua`), sửa hồ sơ tài xế (`/quan-tri/tai-xe/[id]/sua`),
trang chi tiết điều phối `/quan-tri/dieu-phoi/[code]`.

Còn thiếu:
- ⬜ Form **tạo mới** tài xế — `DriverProfile` bắt buộc gắn `User`, cần module quản lý
  người dùng (§3.4) trước
- ⬜ Upload giấy tờ xe/tài xế (`VehicleDocument`/`DriverDocument`) — phụ thuộc module `media`
- ⬜ UI quản lý `AvailabilityBlock` (lịch bảo trì/nghỉ phép) — hiện chỉ nhập qua database

## §15 — State machine vận chuyển

✅ Bảng chuyển 19 trạng thái, 4 ràng buộc cứng đều có test (74 test).
✅ `changeShipmentStatus` trong `modules/shipments/service.ts` nối vào giao diện thật,
ghi `ShipmentStatusEvent` + `OutboxEvent` + `AuditLog` trong một transaction, chống race
bằng điều kiện `status: from`.
✅ Chặn `COMPLETED` khi chưa có `ProofOfDelivery`, bắt buộc mã lý do khi hủy/thất bại —
tách thành hàm thuần `checkStatusPreconditions` nên test được không cần database.

## §16–§19 — Media, vị trí, POD, sự cố/hỗ trợ

**§16.1 Hai mức tra cứu** ✅ Xong. `modules/tracking/` với `masking.ts` là module thuần
quyết định cái gì được công khai (24 test). Tra cứu công khai cần mã vận đơn + 4 số cuối
điện thoại, rate limit 10 lượt/5 phút, mọi thất bại trả cùng một thông báo để chống dò mã.
Đã kiểm chứng trên trình duyệt thật: không lộ địa chỉ, tên, tài xế hay biển số.

Khách đăng nhập xem đầy đủ đơn của mình tại `/tai-khoan/don-hang/[code]`. Thông tin tài xế
chỉ hiện trong cửa sổ thời gian chuyến hoạt động.

**§16.2 + §16.3 Media** ✅ Xong. Đủ 8 bước, 10 giai đoạn theo đúng danh sách §16.2, phân biệt
`INTERNAL`/`CUSTOMER`, trạng thái `QUARANTINED`→`PROCESSING`→`READY`/`REJECTED`.

Nhận dạng bằng magic bytes chứ không tin `Content-Type` client gửi. Kiểm chứng thật: SVG
chứa `<script>` khai man là `image/png` bị chặn ở bước confirm; khai đúng MIME thì bị chặn
ngay ở intent. Khách mở thẳng URL ảnh nội bộ của chính đơn mình cũng nhận 404.

Xem tệp qua proxy đã xác thực (`/api/media/[id]`) thay vì signed URL — kiểm tra quyền ở
từng lần gọi thay vì phát ra một URL ai cầm cũng xem được.

⬜ Còn thiếu: thumbnail và transcode video, job dọn tệp `QUARANTINED` bị bỏ dở.

**§17 Vị trí** ✅ Xong. Server tự quyết định điểm nào đáng ghi qua 7 luật lọc (module thuần,
25 test): toạ độ ngoài biên kể cả `(0,0)`, quá cũ, timestamp tương lai, sai thứ tự, sai số
quá lớn, tốc độ suy ra vô lý, gửi quá dày. Một điểm sai không làm hỏng cả lô.

Opt-in thật: không có gì chạy tới khi tài xế bấm bật, không tự bật lại khi tải lại trang.
Gửi theo lô, chịu được mất sóng. Chỉ nhận khi chuyến đang chạy và assignment còn hiệu lực.

Khách xem qua ba lớp chặn: doanh nghiệp phải bật chia sẻ cho chuyến đó (mặc định TẮT),
chuyến phải đang trên đường, toạ độ làm thô về ~100m. Khách thấy 20 điểm gần nhất, nhân
viên 200.

Không nhúng bản đồ — hiển thị toạ độ dạng văn bản kèm link mở app ngoài, nên trang không
hỏng khi thiếu API key. Ngôn từ nói rõ đây là *vị trí xe*, không phải GPS từng kiện hàng.

⬜ Còn thiếu: `ConsentRecord` riêng cho việc chia sẻ vị trí, bộ lập lịch cho
`purgeExpiredLocations()` (hiện phải gọi thủ công).

**§18 POD** ✅ Xong. OTP hash SHA-256 muối bằng `shipmentId`, hết hạn 15 phút, tối đa 5 lần
thử, dùng một lần. So sánh hash bằng `timingSafeEqual`; hết hạn và đã dùng xét trước khi
so mã để thời gian phản hồi không để lộ mã đúng.

Snapshot bất biến làm đúng nghĩa: **phải sửa schema** vì `shipmentId` vốn `@unique` khiến
mỗi chuyến chỉ lưu được một biên bản, tức là "điều chỉnh" chỉ có thể ghi đè — phá huỷ chính
bằng chứng cần bảo toàn. Migration `pod_correction_chain` bỏ unique, thêm `supersededAt`, và
thêm **partial unique index** `UNIQUE (shipmentId) WHERE supersededAt IS NULL`. Đã kiểm
chứng: ép ghi biên bản thứ hai thẳng vào database bị PostgreSQL từ chối.

Chỉ điều phối lập được biên bản điều chỉnh; tài xế bị chặn. Khách không xem được lịch sử
điều chỉnh.

⬜ Còn thiếu: chữ ký điện tử, giao diện điều phối cho biên bản điều chỉnh, khách tải biên
nhận đã làm sạch dữ liệu, giao diện `ProofOfPickup` (service đã xong).

⬜ **§19 Incident và SupportTicket** — chưa làm. Tài xế đã báo được sự cố qua chuyển trạng
thái `INCIDENT` kèm lý do, nhưng chưa có bản ghi `Incident` riêng và chưa có ticket.

Schema cho tất cả các bảng này ĐÃ CÓ trong `prisma/schema.prisma` (Pha 1).

## §20–§23 — Hóa đơn, thông báo, tin tức/SEO, liên hệ

| Mục | Trạng thái |
|---|---|
| Invoice/PaymentRecord | ✅ Đủ 6 trạng thái hóa đơn, 3 trạng thái thanh toán. Không có cổng online, không lưu dữ liệu thẻ |
| Notification + Outbox worker | ✅ Worker có backoff, jitter, dead-letter, chống nhận trùng. Kiểm chứng trên 42 sự kiện thật. Chưa gửi email/SMS và chưa có bộ lập lịch |
| Tin tức + SEO | ✅ Xong (Pha 3): sitemap, robots, JSON-LD Article/FAQPage/BreadcrumbList |
| Liên hệ | 🟡 UI có, chưa lưu `ContactInquiry`, chưa có honeypot/rate-limit riêng cho form này |

## §24 — Database

✅ **74/72 model đã tạo** (vượt yêu cầu — gộp thêm vài bảng phụ trợ). Toàn bộ 8 nhóm theo
§24.1–§24.8 đều có schema. Quy tắc §24.9 tuân thủ đầy đủ: Decimal cho tiền, UUID/cuid,
composite index, check constraint, **exclusion constraint chống double-booking** (điểm
nhấn kỹ thuật quan trọng nhất của dự án, đã kiểm chứng bằng test race condition thật).

## §25 — API

🟡 Có 3 route thật (`/api/auth/*`, `/api/public/quote-requests`, `/api/public/moving-requests`).
So với ~40 nhóm endpoint liệt kê trong §25: **phần lớn còn lại đi qua Server Action thay
vì REST route** (`quan-tri/*/actions.ts`, `tai-khoan/*/actions.ts`) — vẫn tuân thủ yêu cầu
validation/auth/audit như API, nhưng chưa có route REST riêng.
⬜ Idempotency-Key: có `IdempotencyRecord` schema, chưa áp dụng.
✅ `/api/health/live`, `/api/health/ready` — live không chạm database (tránh restart hàng
loạt khi database sự cố), ready kiểm database thật và không rò thông tin nội bộ.
✅ `/api/internal/scheduler/run` cho cron ngoài, xác thực bằng khoá so sánh chống đo thời gian.
⬜ OpenAPI: chưa có tài liệu API sinh tự động.
✅ Toàn bộ 14 endpoint được mô tả trong `docs/api.md`.

## §26 — Dashboard

| Dashboard | Trạng thái |
|---|---|
| Customer §26.1 | 🟡 Yêu cầu, báo giá, chuyến, tài xế, ảnh, vị trí xong. Hóa đơn và hỗ trợ **chưa** |
| Driver §26.2 | ✅ Danh sách + chi tiết + nút CTA đơn nhất. Thiếu media, vị trí, POD |
| Admin §26.3 | 🟡 Widget yêu cầu/báo giá/điều phối có. Bulk action, CSV export **chưa có** |

## §27–§29 — Ảnh, SEO, Accessibility

✅ Xong theo Pha 3. `next/image` với remotePatterns đúng, `/nguon-hinh-anh` có, sitemap/
robots/JSON-LD đủ 3 loại yêu cầu, axe 0 vi phạm trên 12 route cốt lõi, focus visible có test.

## §30 — Bảo mật

🟡 Phần đã làm rất kỹ:
- ✅ Auth, RBAC, CSRF (SameSite cookie), XSS (sanitize 2 lớp), rate limit, honeypot
- ✅ Không `dangerouslySetInnerHTML` ngoài 1 chỗ duy nhất đã sanitize
- ✅ AuditLog append-only, redact 22 nhóm trường nhạy cảm

Bổ sung ở Pha 9:
- ✅ CSP thực tế — **hai mức**. Mức `strict` dựa trên nonce cho khu vực đăng nhập và nhóm
  `(auth)`; mức `static` cho trang public prerender. Áp một mức nonce cho toàn site đã được
  kiểm chứng là **làm trắng toàn bộ site public** (HTML prerender sinh lúc build không mang
  được nonce của request). Bất biến được chốt bằng test đọc `prerender-manifest.json`.
- ✅ HSTS (chỉ production, chưa `preload`), `X-Content-Type-Options`, `Permissions-Policy`,
  `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`.
- ✅ Header riêng cho `/api/*` qua `next.config.ts` — middleware không chạm nhánh này.
  `default-src 'none'; sandbox`, quan trọng nhất với `/api/media/[id]`.
- ✅ `pnpm audit --prod` — không có lỗ hổng đã biết.

Chưa làm theo §30:
- ⬜ CAPTCHA (chỉ có honeypot, chưa có CAPTCHA thật dù đã có `CAPTCHA_PROVIDER` env)
- ⬜ MFA — `REQUIRE_STAFF_MFA` có, triển khai chưa có. Chặn ADMIN ghi nhận thanh toán
- ✅ Upload security (§30.4) — magic bytes, allowlist, `X-Content-Type-Options: nosniff`,
  `Content-Disposition` theo loại, object key do server sinh, chống path traversal.
  **Nhưng quét mã độc vẫn là adapter `noop`** — bắt buộc thay trước khi nhận file từ ngoài
- 🟡 Dependency audit: đã chạy sạch ở Pha 9, nhưng chưa tự động hoá theo lịch

## §31–§33 — Quyền riêng tư, hiệu năng, seed

| Mục | Trạng thái |
|---|---|
| ConsentRecord, DataSubjectRequest | ⬜ Schema có, chưa có luồng thu thập consent thật |
| Data inventory document | 🟡 `location-privacy.md` phủ dữ liệu vị trí và nghĩa vụ với tài xế; `data-dictionary.md` phủ toàn bộ 74 model. Chưa có bản kiểm kê PII riêng |
| Cache/revalidate CMS | ✅ Dùng `cache()` của React, `force-dynamic` cho trang riêng tư |
| Seed dữ liệu mẫu | ✅ Đầy đủ theo §33, idempotent, có test |

## §34 — Kiểm thử

| Loại | Yêu cầu | Hiện có |
|---|---|---|
| Unit | Tính giá, state machine, chuẩn hóa, tracking code | ✅ Tổng 827 unit + integration |
| Integration | Double-booking, upload, POD... | 🟡 Double-booking (14), bất biến POD (7), lộ dữ liệu tài xế (3). Upload kiểm chứng thủ công, chưa thành test thường trực |
| Security | IDOR, enumeration, CSRF, mass assignment | ✅ IDOR + enumeration có test. CSRF/mass assignment chưa có test riêng |
| E2E | 10 bước từ gửi yêu cầu tới ticket | 🟡 132 test: public, điều hướng, và **32 test header bảo mật + health check** mới ở Pha 9. Luồng đầy đủ tới POD vẫn chạy bằng script Playwright rời, **chưa thành test thường trực** (thiếu fixture đăng nhập) |
| UI quality | Responsive, keyboard, axe | ✅ Đầy đủ |

`pnpm lint/typecheck/test/build` đều pass, build không còn cảnh báo nào. `pnpm test:e2e`
pass 132. Vẫn chưa có test E2E thường trực cho luồng đầy đủ sau shipment.

Bổ sung đáng chú ý ở Pha 9: `tests/e2e/security-headers.spec.ts` khẳng định **mọi** thẻ
script inline trên trang đăng nhập mang đúng nonce của response. Test đơn vị không bắt được
điều này — nó chỉ kiểm chuỗi CSP dựng ra, không kiểm Next.js có thật sự nhúng nonce hay
không, và sai ở điểm đó là trang trắng.

## §35 — Tài liệu

| File yêu cầu | Trạng thái |
|---|---|
| README.md | ✅ |
| docs/architecture.md | ✅ |
| docs/erd.md | 🟡 Có `database-plan.md` với Mermaid ERD từ Pha 1, tên file khác yêu cầu |
| docs/data-dictionary.md | ✅ |
| docs/roles-permissions.md | ✅ |
| docs/workflows.md | ✅ |
| docs/api.md | ✅ |
| docs/security.md | ✅ |
| docs/storage-media.md | ✅ |
| docs/location-privacy.md | ✅ |
| docs/notifications.md | ✅ |
| docs/deployment.md | ✅ |
| docs/backup-restore.md | ✅ |
| docs/operations-runbook.md | ✅ |
| docs/content-guide.md | ✅ |
| docs/image-sources.md | ✅ |
| docs/future-features.md | ✅ |
| .env.example | ✅ |

## §36 — Roadmap (không triển khai)

✅ Đúng yêu cầu — `future-features.md` ghi rõ 2 tính năng bị cấm và điều kiện trước khi làm,
không có route/model/API/CTA nào cho chúng trong code.

## §37 — Trình tự triển khai

✅ Đã làm đúng Pha 0–6 theo thứ tự đề xuất (Pha 0 khảo sát → nền tảng → auth → CMS →
service request → pricing → fleet/dispatch). Mỗi pha đều chạy lint/typecheck/test/build
trước khi báo cáo, đúng yêu cầu "giữ ứng dụng luôn build được".

## §38 — Tiêu chí nghiệm thu

| Tiêu chí | Đạt? |
|---|---|
| Route chính tồn tại, không link chết | ✅ Đã quét toàn bộ `href` tĩnh, không còn link chết |
| Public lấy từ CMS, không hardcode | ✅ |
| Đăng ký/đăng nhập/quên mật khẩu hoạt động | ✅ |
| RBAC + object-level auth có test | ✅ |
| Khách tạo được request vận chuyển + chuyển nhà | ✅ |
| Nhân viên lập/duyệt/gửi/revision báo giá | ✅ |
| Khách chấp nhận đúng revision | ✅ |
| Dispatcher tạo/phân công không trùng | ✅ |
| Driver chỉ thao tác chuyến được gán | ✅ Kiểm chứng: tài xế khác mở cùng chuyến thấy 404 |
| Timeline/media/POD an toàn | ✅ Vị trí GPS chưa làm |
| Public tracking không lộ PII | ✅ Kiểm chứng trên trình duyệt thật, không lộ địa chỉ/tên/tài xế/biển số |
| Bảng giá có version + audit | 🟡 Có version, chưa có UI quản trị |
| Đổi trạng thái đơn theo state machine, có audit | ✅ |
| Ticket/sự cố/hóa đơn/thanh toán | ✅ Đủ cả bốn |
| Notification có outbox + retry | ✅ Backoff mũ, jitter, dead-letter. Thiếu bộ lập lịch tự chạy |
| Upload private + validate nhiều lớp | ✅ Kiểm chứng 9 kịch bản gồm SVG đội lốt ảnh |
| SEO/sitemap/robots/structured data | ✅ |
| WCAG 2.2 AA | ✅ |
| Responsive | ✅ |
| Migration/seed trên DB trống | ✅ |
| Lint/typecheck/test/build | ✅ |
| README đủ để chạy | ✅ |
| Không secret/TODO giả | ✅ |
| Không có Facebook/AI module | ✅ |

**Kết luận theo §38: chưa đạt nghiệm thu đầy đủ** — thiếu driver, media, tracking chi tiết,
POD, incident/support, invoice. Đây chính xác là nội dung Pha 7–9.

---

## Tóm tắt việc cần làm tiếp, theo thứ tự ưu tiên

### ~~Ưu tiên 1 — Vá ngay~~ ✅ XONG 12/08/2026
1. ~~Trang `/quan-tri/dieu-phoi/[code]`~~ — đã xây, kèm form phân công và đổi trạng thái
2. ~~Service `changeShipmentStatus`~~ — xong, có kiểm tra POD và mã lý do
3. ~~Form thêm/sửa xe và tài xế~~ — xong (trừ TẠO tài xế, chờ module người dùng)
4. Phát sinh: vá 6 link chết trong `AdminNav`, sửa lỗi không lập nổi báo giá khi bỏ trống
   trường tùy chọn, sửa lỗi phân công lại báo trùng với chính chuyến đó

### ~~Ưu tiên 2 — Pha 7: Tracking~~ ✅ XONG 12/08/2026

- ~~`/tra-cuu` nối API thật với 2 mức công khai/riêng tư (§16.1)~~ ✅
- ~~Toàn bộ giao diện `/tai-xe/*` (Driver dashboard §26.2)~~ ✅
- ~~Nối `/tai-khoan/don-hang` và `/tai-khoan` vào dữ liệu thật~~ ✅
- ~~Module `media`: luồng upload 8 bước theo §16.3~~ ✅ kèm giao diện tải và xem ảnh
- ~~Module `proof-of-delivery`: POD với OTP hash theo §18~~ ✅ kèm chuỗi điều chỉnh bất biến
- ~~Module `locations`: LocationPing + chính sách hiển thị theo §17~~ ✅
- Phát sinh: sửa rò rỉ mã báo giá sang màn hình tài xế (§8); sửa schema POD để chuỗi điều
  chỉnh khả thi (migration `pod_correction_chain`)

Nợ lại, gom vào Pha 9: chữ ký điện tử trong POD, xuất PDF biên nhận, giao diện điều phối cho
biên bản điều chỉnh, giao diện `ProofOfPickup`, thumbnail/transcode, job dọn dữ liệu định kỳ.

### ~~Ưu tiên 3 — Pha 8: Support & Finance~~ ✅ XONG 13/08/2026

- ~~Notification worker xử lý OutboxEvent thật~~ ✅ kèm trung tâm thông báo cho khách

- ~~Module `support` (§19) — ticket + message 2 mức hiển thị~~ ✅
- ~~`/lien-he` nối `ContactInquiry` thật (§23)~~ ✅
- ~~Module `incidents` (§19)~~ ✅
- Phát sinh: sửa lỗi chuyến chạy trễ khoá tài xế khỏi hệ thống (`policy.ts`)

- ~~Module `invoices` (§20)~~ ✅ kèm ghi nhận và đối chiếu thanh toán

Còn nợ lại, đều là phần bổ trợ:
1. Giao diện quản trị cho dead-letter
2. Gắn ảnh bằng chứng vào sự cố và tệp đính kèm vào phiếu hỗ trợ
3. Ô chọn người phụ trách cho phiếu và sự cố
4. MFA cho vai trò quyền cao — chặn ADMIN ghi nhận thanh toán

### ~~Ưu tiên 4 — Pha 9: Hoàn thiện~~ ✅ XONG 13/08/2026

- ~~CSP, HSTS, security headers (§30.1)~~ ✅ CSP hai mức, đã kiểm chứng trên build production
- ~~12 file tài liệu §35~~ ✅
- ~~`/api/health/*`~~ ✅ live + ready
- ~~Bộ lập lịch cho ba job định kỳ~~ ✅ kèm job dọn media hoàn toàn mới

Còn nợ lại:
1. Idempotency-Key — schema và mã lỗi đã có, chưa endpoint nào đọc header
2. UI quản trị: bảng giá, nội dung, người dùng, nhật ký, cấu hình (§3.4)
3. Data inventory riêng cho PII, consent flow (§31)

### Điều kiện chặn vận hành thật

Không thuộc lộ trình §37 nhưng phải xử lý trước khi phục vụ khách hàng thật:

| Hạng mục | Trạng thái |
|---|---|
| **Quét mã độc** | `noop` — không quét gì. Tệp đi trọn vòng từ tài xế tới khách |
| **MFA** | Chưa có. ADMIN không ghi nhận được thanh toán |
| Storage | `local` — mất máy chủ là mất ảnh bằng chứng giao hàng |
| Email / SMS | `console` — khách không nhận được gì |
| Backup | Chưa có. `backup-restore.md` hướng dẫn dựng |
| Giám sát lỗi | `ERROR_MONITORING_DSN` trống |
