# Bảo mật

Mô hình bảo mật của hệ thống: những gì đã làm, làm như thế nào, và những gì **chưa** làm.

Xem thêm: [`roles-permissions.md`](roles-permissions.md) cho bảng vai trò và quyền chi tiết,
[`location-privacy.md`](location-privacy.md) cho dữ liệu vị trí,
[`storage-media.md`](storage-media.md) cho tệp tải lên.

---

## 1. Nguyên tắc nền

**Phân quyền nằm ở tầng service, không ở giao diện.** Ẩn một nút bấm không phải là kiểm
soát truy cập. Mọi thao tác đọc và ghi đều đi qua một hàm kiểm tra quyền trong
`src/modules/auth/policy.ts` trước khi chạm database.

**Middleware không phải lớp bảo vệ.** `src/middleware.ts` chỉ kiểm tra sự **tồn tại** của
cookie phiên để chuyển hướng sớm, tránh chớp giao diện. Nó không xác minh chữ ký, không đọc
database, không biết vai trò. Ghi rõ trong chính file đó để không ai nhầm.

**Truy cập chéo trả `404`, không trả `403`.** Khách hàng A hỏi đơn hàng của khách hàng B sẽ
nhận `404`. `403` sẽ xác nhận rằng mã đó có tồn tại — đủ để dò ra danh sách mã vận đơn thật.

---

## 2. Xác thực

Dùng [Better Auth](https://better-auth.com) với phiên lưu bằng cookie.

| Cơ chế | Cấu hình |
|---|---|
| Cookie phiên | `httpOnly`, `sameSite=lax`, `secure` khi chạy HTTPS |
| Mật khẩu | Băm bằng scrypt (mặc định của Better Auth) |
| Xác minh email | Bắt buộc trước khi dùng khu vực khách hàng |
| Rate limit đăng nhập | Có, xem §6 |

`secure` phụ thuộc vào việc proxy có gửi `X-Forwarded-Proto` hay không. Thiếu header đó,
cookie phiên sẽ đi qua HTTP không mã hoá. Xem `deployment.md` §5.

### Chưa có: MFA

`REQUIRE_STAFF_MFA` tồn tại trong cấu hình nhưng **chưa có triển khai MFA nào**.

Hệ quả cụ thể: quy tắc yêu cầu xác thực lại cho thao tác nhạy cảm (`requireFreshAuth`) đòi
MFA với vai trò ADMIN và SUPER_ADMIN khi ghi nhận thanh toán. Vì MFA chưa tồn tại, **ADMIN
hiện không ghi nhận được thanh toán**. ACCOUNTANT không bị quy tắc này chặn nên hoạt động
bình thường.

Đây là hạn chế đã biết, không phải lỗi. Nhưng nó phải được xử lý trước khi vận hành thật.

---

## 3. Phân quyền

8 vai trò, 31 quyền có tiền tố theo miền (`shipment.update`, `invoice.manage`, …). Danh
sách đầy đủ trong `src/modules/auth/permissions.ts` và `roles-permissions.md`.

Quyền được nạp vào phiên một lần rồi kiểm tra bằng `Set.has()`. Không truy vấn database cho
mỗi lần kiểm tra.

### Quyền theo phạm vi dữ liệu

Có quyền chưa đủ — còn phải đúng phạm vi:

- **Khách hàng** chỉ thấy dữ liệu gắn với `userId` của mình.
- **Tài xế** chỉ thấy chuyến mình được phân công.
- **Nhân viên** có quyền `*.read_all` thì thấy toàn bộ.

### Trường hợp đáng chú ý: chuyến chạy trễ

Quyền cập nhật chuyến của tài xế **không** dựa vào khung giờ phân công.

Ban đầu nó có dựa. Kết quả là một chuyến còn đang `IN_TRANSIT` nhưng khung giờ đã kết thúc
sẽ khoá tài xế ra ngoài: không cập nhật được trạng thái, không tải được ảnh, không báo được
sự cố, không ghi được bằng chứng giao hàng. Chuyến chạy trễ là chuyện bình thường trong vận
tải, nên lỗi này sẽ xảy ra gần như hằng ngày.

Nguyên nhân gốc: dùng khung giờ **lập lịch** (vốn để chống trùng lịch) làm ranh giới **phân
quyền**. Hai thứ khác nhau.

Ranh giới đúng là **trạng thái chuyến**: tài xế cập nhật được chừng nào chuyến chưa khép
lại (`COMPLETED`, `CANCELLED`, `FAILED`). Xem `requireShipmentUpdateAccess` trong
`src/modules/auth/policy.ts`.

### Rò rỉ dữ liệu qua quan hệ Prisma

Truy vấn cho tài xế dùng danh sách cột **liệt kê tường minh**
(`DRIVER_SHIPMENT_SELECT` trong `src/modules/shipments/repository.ts`), không dùng
`include` hay select mặc định.

Lý do: `include` sẽ tự động kéo theo mọi cột mới được thêm vào model về sau. Đã từng có lỗi
kiểu này — mã báo giá lọt vào ghi chú trạng thái và hiện trên màn hình tài xế, dù DRIVER
không có quyền `quote.*` nào. Một integration test duyệt đệ quy cây select để khẳng định
không có `quote`, `totalAmount`, `internalNote`, `serviceRequest`, `user`, `invoices`.

---

## 4. Header bảo mật (§30.1)

Đặt trong `src/middleware.ts` cho trang, và trong `next.config.ts` cho `/api/*`.
Logic ở `src/lib/security-headers.ts`.

| Header | Giá trị | Chống gì |
|---|---|---|
| `Content-Security-Policy` | xem dưới | XSS, chèn script |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Hạ cấp xuống HTTP |
| `X-Content-Type-Options` | `nosniff` | Trình duyệt đoán nhầm kiểu tệp tải lên |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Rò đường dẫn nội bộ sang site khác |
| `Permissions-Policy` | chỉ mở `geolocation`, `camera` cho chính mình | Lạm dụng API trình duyệt |
| `X-Frame-Options` | `DENY` | Clickjacking (dự phòng cho `frame-ancestors`) |
| `Cross-Origin-Opener-Policy` | `same-origin` | Tấn công qua `window.opener` |

HSTS **chỉ** bật ở production. Bật ở local sẽ khiến trình duyệt ép HTTPS cho `localhost`
và người phát triển mất truy cập cho tới khi xoá thủ công trong `chrome://net-internals`.

`preload` chưa được thêm vào HSTS. Chỉ thêm khi doanh nghiệp thực sự đăng ký danh sách
preload của trình duyệt — thêm sớm là tự khoá mình vào HTTPS ở mức không gỡ nhanh được.

### CSP có hai mức

Đây là chi tiết dễ hiểu nhầm nhất trong hệ thống, nên ghi kỹ.

| Mức | Áp cho | `script-src` |
|---|---|---|
| `strict` | Khu vực đăng nhập, nhóm `(auth)` | nonce + `strict-dynamic`, **không** `unsafe-inline` |
| `static` | Trang public prerender | `'self' 'unsafe-inline'` |

Vì sao không dùng một mức nghiêm ngặt cho tất cả: nonce phải mới theo từng request, nhưng
HTML của trang prerender được sinh **lúc build**. Áp CSP nonce lên trang tĩnh thì các thẻ
script trong HTML đã lưu không mang nonce của request hiện tại, trình duyệt chặn script
khởi động của Next.js, và trang mất hoàn toàn tương tác.

Điều này đã được kiểm chứng bằng thực nghiệm, không phải suy đoán: trang chủ phục vụ 21 thẻ
script với 7 script inline, không thẻ nào có nonce.

Giải pháp là áp mức nghiêm ngặt cho đúng nơi có dữ liệu cần bảo vệ. Toàn bộ khu vực khách
hàng, tài xế và quản trị đều render động, nên dùng được mức `strict`. Nhóm `(auth)` được
**ép** render động (`src/app/(auth)/layout.tsx`) để cũng dùng được — trang đăng nhập là
đích ngắm hàng đầu của XSS đánh cắp thông tin đăng nhập, và các trang này vốn đã
`Cache-Control: no-store` nên prerender không mang lại lợi ích gì.

Trang public dùng mức `static`, vẫn giữ nguyên `frame-ancestors 'none'`, `object-src
'none'`, `form-action 'self'`, `base-uri 'self'`.

> ⚠️ **Thêm một trang TĨNH dưới `/tai-khoan`, `/tai-xe`, `/quan-tri` hoặc nhóm `(auth)` sẽ
> làm trang đó trắng.** Test `tests/unit/csp-static-route-guard.test.ts` đọc
> `.next/prerender-manifest.json` sau khi build và báo lỗi nếu điều này xảy ra.

`style-src` mở `'unsafe-inline'` ở cả hai mức. Next.js và Tailwind chèn style inline khi
hydrate, và React không truyền nonce vào thẻ style nó tự tạo. Đây là đánh đổi đã biết —
CSS inline không thực thi mã.

### Header cho `/api/*`

Middleware không chạm route API (matcher loại `api` ra để handler tự lo phần xác thực), nên
header API đặt trong `next.config.ts`. Chính sách chặt hơn vì phản hồi API không bao giờ là
tài liệu có script:

```
default-src 'none'; frame-ancestors 'none'; sandbox
```

`nosniff` ở đây quan trọng nhất với `/api/media/[id]`: route đó trả về tệp người dùng tải
lên. Không có `nosniff`, một tệp gắn mác ảnh vẫn có thể bị trình duyệt diễn giải thành HTML
và chạy script trong đó.

---

## 5. Tệp tải lên

Chi tiết trong [`storage-media.md`](storage-media.md). Tóm tắt phần bảo mật:

- **Nhận dạng bằng magic bytes**, không tin `Content-Type` client gửi.
- **Không chấp nhận SVG.** SVG là XML và chạy được script.
- **PDF ép `Content-Disposition: attachment`**, không cho hiển thị trong tab.
- **Object key do server sinh** (UUID), không dùng tên tệp người dùng — tên đó có thể chứa
  `../` hoặc ký tự điều khiển.
- **Quét mã độc: chưa có.** Xem §9.

---

## 6. Chống lạm dụng

Rate limit áp cho form công khai và đăng nhập. Cấu hình trong `src/lib/rate-limit.ts`.

Driver mặc định là `memory`: bộ đếm nằm trong RAM một tiến trình, mất khi khởi động lại, và
mỗi instance có bộ đếm riêng. Chấp nhận được với triển khai một tiến trình; nhiều instance
thì phải chuyển sang `redis`.

Captcha (`CAPTCHA_PROVIDER`) mặc định `none`.

---

## 7. Nhật ký kiểm toán

`AuditLog` là bảng **chỉ ghi thêm** — không sửa, không xoá qua ứng dụng. Ghi lại các thay
đổi nghiệp vụ: đổi trạng thái chuyến, phân công, ghi nhận thanh toán, sửa nội dung.

`redactSensitive()` (`src/modules/audit/`) lọc dữ liệu nhạy cảm trước khi ghi. Logger cũng
có danh sách `redact` riêng cho `password`, `token`, `otp`, `cookie`, `signedUrl` — lớp
bảo vệ cuối cùng, không thay thế việc chủ động không đưa dữ liệu nhạy cảm vào log.

Chưa có job dọn `AuditLog`. `AUDIT_RETENTION_DAYS` tồn tại nhưng chưa ai dùng nó.

---

## 8. PII trong URL

Endpoint tra cứu công khai dùng **POST**, không dùng GET, dù về mặt ngữ nghĩa nó là thao
tác đọc. Lý do: tra cứu cần số điện thoại, và tham số URL bị ghi vào access log của server,
log của proxy, lịch sử trình duyệt và header `Referer`.

Cùng lý do, chức năng tra cứu công khai trả **cùng một thông báo lỗi** cho sai mã vận đơn
và sai số điện thoại. Phân biệt hai trường hợp sẽ cho phép dò ra mã vận đơn nào có thật.

---

## 9. Những gì chưa làm

Danh sách này là điều kiện tiên quyết để vận hành thật, không phải danh sách mong muốn.

| Hạng mục | Trạng thái | Rủi ro nếu bỏ qua |
|---|---|---|
| **Quét mã độc** | `noop` — không quét gì | Tệp nhiễm mã độc đi trọn vòng từ tài xế tới khách |
| **MFA** | Chưa có | ADMIN không ghi nhận được thanh toán; tài khoản quyền cao chỉ có mật khẩu |
| Rà soát bảo mật độc lập | Chưa có | Chưa ai ngoài đội phát triển kiểm tra |
| Kiểm thử xâm nhập | Chưa có | — |
| Giám sát lỗi | `ERROR_MONITORING_DSN` trống | Không ai biết khi có sự cố |
| Rate limit phân tán | `memory` | Không hiệu quả khi chạy nhiều instance |
| Xoay vòng secret | Chưa có quy trình | — |
| Idempotency-Key | Bảng `IdempotencyRecord` có, chưa dùng | Người dùng bấm hai lần có thể tạo hai bản ghi |
| Dọn `AuditLog` | Chưa có job | Bảng chỉ tăng |

**Không mô tả hệ thống này là "đã bảo mật" hay "sẵn sàng production" chừng nào hai dòng in
đậm còn chưa xử lý.**

---

## 10. Báo lỗi bảo mật

Cần doanh nghiệp cập nhật: địa chỉ liên hệ nhận báo cáo lỗ hổng, và cam kết thời gian phản
hồi.
