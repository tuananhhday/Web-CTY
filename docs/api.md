# API

Toàn bộ HTTP endpoint của hệ thống.

> **Phạm vi:** đây **không** phải API công khai cho bên thứ ba. Các endpoint dưới đây phục
> vụ chính giao diện của hệ thống (form công khai, ứng dụng tài xế, tải tệp) và bộ lập lịch.
> Không có API key, không có versioning, không có cam kết tương thích ngược cho bên ngoài.
>
> Phần lớn thao tác đọc/ghi của người đã đăng nhập **không** đi qua HTTP API mà qua Server
> Component và Server Action. Xem [`architecture.md`](architecture.md) §4.

---

## 1. Quy ước chung

### Định dạng phản hồi

Thành công trả thẳng dữ liệu:

```json
{ "trackingCode": "VT84ME5FJE3A", "status": "IN_TRANSIT" }
```

Lỗi luôn có cùng một hình dạng:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Số điện thoại không hợp lệ.",
    "fields": [{ "path": "phone", "message": "Số điện thoại không hợp lệ." }],
    "requestId": "req_01HX..."
  }
}
```

- `code` — mã ổn định, **không đổi khi refactor**. Client nên xử lý theo mã này.
- `message` — tiếng Việt, an toàn để hiển thị trực tiếp. Không chứa tên bảng, câu SQL,
  đường dẫn tệp hay stack trace.
- `fields` — chỉ có với `VALIDATION_ERROR`.
- `requestId` — dùng để đối chiếu với log máy chủ khi báo lỗi.

Lỗi không lường trước luôn bị quy về `INTERNAL_ERROR`. Chi tiết chỉ nằm trong log.

### Mã lỗi

| Mã | HTTP | Nghĩa |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Dữ liệu vào không hợp lệ |
| `INVALID_STATE_TRANSITION` | 400 | Chuyển trạng thái không được phép |
| `IDEMPOTENCY_CONFLICT` | 400 | Cùng khoá, khác nội dung |
| `UNAUTHENTICATED` | 401 | Chưa đăng nhập |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `MFA_REQUIRED` | 403 | Cần xác thực hai lớp (**chưa triển khai**) |
| `REAUTH_REQUIRED` | 403 | Cần đăng nhập lại cho thao tác nhạy cảm |
| `NOT_FOUND` | 404 | Không tồn tại — **hoặc tồn tại nhưng không thuộc về bạn** |
| `CONFLICT` | 409 | Xung đột chung |
| `RESOURCE_LOCKED` | 409 | Bản ghi đã khép lại, không sửa được |
| `DOUBLE_BOOKING` | 409 | Xe hoặc tài xế đã có chuyến chồng giờ |
| `STALE_VERSION` | 409 | Có người khác vừa sửa |
| `PAYLOAD_TOO_LARGE` | 413 | Tệp quá lớn |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Định dạng tệp không được hỗ trợ |
| `RATE_LIMITED` | 429 | Gửi quá nhanh |
| `INTERNAL_ERROR` | 500 | Lỗi không lường trước |
| `PROVIDER_UNAVAILABLE` | 503 | Dịch vụ ngoài không phản hồi |

> `NOT_FOUND` được dùng cả cho trường hợp bản ghi tồn tại nhưng thuộc về người khác. Trả
> `403` sẽ xác nhận bản ghi đó có thật — đủ để dò ra danh sách mã vận đơn.

### Phương thức

Endpoint chỉ nhận `POST` sẽ trả `404` (không phải `405`) cho `GET`. Không xác nhận sự tồn
tại của endpoint với người dò quét bằng phương thức sai.

### Xác thực

| Nhóm | Cách xác thực |
|---|---|
| `/api/public/*` | Không cần. Có rate limit. |
| `/api/driver/*`, `/api/uploads/*`, `/api/media/*` | Cookie phiên |
| `/api/internal/*` | Header `x-internal-key` |
| `/api/health/*` | Không cần |

---

## 2. Endpoint công khai

Tất cả đều có rate limit theo IP.

### `POST /api/public/tracking`

Tra cứu chuyến hàng bằng mã vận đơn và **4 số cuối** điện thoại.

```json
{ "trackingCode": "VT84ME5FJE3A", "phoneSuffix": "4567" }
```

Chỉ bốn số chứ không phải cả số điện thoại: đủ để chứng minh người tra cứu có liên quan tới
đơn hàng, không đủ để lộ thêm thông tin nếu người khác đoán trúng mã.

Số được đối chiếu là `ServiceRequest.contactPhoneNormalized` của yêu cầu dịch vụ sinh ra
chuyến này — không phải số trên hồ sơ tài khoản. Chuyến tạo tay không kèm yêu cầu dịch vụ sẽ
luôn trả `NOT_FOUND` ở endpoint này.

Trả về bản đã **che bớt** — chỉ những trường được khai báo tường minh trong
`src/modules/tracking/masking.ts`. Trường mới thêm vào model sẽ không tự lọt ra.

> **Vì sao là POST cho một thao tác đọc:** tham số URL bị ghi vào access log của máy chủ,
> log của proxy, lịch sử trình duyệt và header `Referer`. Số điện thoại không được nằm ở
> đó.
>
> **Chống dò:** sai mã vận đơn và sai số điện thoại trả về **cùng một thông báo lỗi**.
> Phân biệt hai trường hợp sẽ cho phép dò ra mã nào có thật.

### `POST /api/public/quote-requests`

Nhận yêu cầu báo giá vận chuyển hàng hoá từ form công khai.

### `POST /api/public/moving-requests`

Nhận yêu cầu chuyển nhà / chuyển văn phòng.

### `POST /api/public/contact`

Nhận liên hệ chung. Tạo một phiếu hỗ trợ.

Schema chi tiết của ba endpoint trên: `src/modules/service-requests/schema.ts` và
`src/modules/support/schema.ts`. Chúng dùng chung Zod schema với form phía client nên định
nghĩa chỉ tồn tại một chỗ.

---

## 3. Endpoint cho tài xế

### `POST /api/driver/locations`

Gửi một lô điểm vị trí. Nhận lô thay vì từng điểm để ứng dụng tài xế gom lại khi mất sóng
rồi gửi bù.

```json
{
  "trackingCode": "VT84ME5FJE3A",
  "points": [
    { "latitude": 10.762, "longitude": 106.660, "recordedAt": "2026-08-13T08:00:00Z", "accuracy": 12 }
  ]
}
```

Chỉ tài xế đang được phân công chuyến đó mới gửi được. Điểm vị trí có thời hạn lưu trữ và
bị xoá tự động — xem [`location-privacy.md`](location-privacy.md).

---

## 4. Tệp

Luồng tải lên có ba bước. Chi tiết và lý do: [`storage-media.md`](storage-media.md).

### `POST /api/uploads/intent`

Xin phép tải lên. Trả về `mediaId` và một đích tải lên ngắn hạn.

```json
{ "trackingCode": "…", "stage": "DELIVERY", "mimeType": "image/jpeg",
  "sizeBytes": 2048576, "visibility": "CUSTOMER" }
```

```json
{ "mediaId": "clx…",
  "upload": { "url": "…", "method": "PUT", "headers": {}, "expiresAt": "…" } }
```

Bản ghi được tạo ngay ở bước này với trạng thái `QUARANTINED`, **trước** khi có nội dung.
Nhờ vậy tệp tải lên nhưng không được xác nhận vẫn còn dấu vết để dọn.

### `PUT` tới `upload.url`

Client tải nội dung thẳng lên storage. Với adapter `local`, đích là
`/api/uploads/local` kèm chữ ký HMAC.

### `POST /api/uploads/confirm`

Xác nhận đã tải xong. Server kiểm tra kích thước, magic bytes, checksum và quét mã độc.
Chỉ sau bước này tệp mới chuyển sang `READY` và hiển thị được.

Tệp không đạt chuyển sang `REJECTED` kèm lý do, và nội dung bị xoá khỏi storage ngay.

### `GET /api/media/[id]`

Proxy tải tệp, có kiểm tra quyền. Không trả URL trực tiếp tới storage.

Phản hồi mang `Content-Security-Policy: default-src 'none'; sandbox` và
`X-Content-Type-Options: nosniff`. PDF bị ép `Content-Disposition: attachment`.

---

## 5. Endpoint nội bộ

Xác thực bằng header `x-internal-key`, so sánh với `BETTER_AUTH_SECRET` bằng phép so sánh
chống đo thời gian. Không dùng phiên đăng nhập — cron không có người ngồi sau.

Thiếu khoá và sai khoá đều trả `403` với cùng thông báo.

### `POST /api/internal/scheduler/run`

Chạy job định kỳ đã đến hạn.

```bash
curl -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" \
  -H "content-type: application/json" \
  -d '{"job":"outbox"}'
```

Body rỗng: chạy mọi job đến hạn. `{"job":"..."}`: ép chạy đúng một job, bỏ qua kiểm tra
đến hạn. Tên hợp lệ: `outbox`, `purge-locations`, `cleanup-media`.

```json
{ "ran": ["outbox"] }
```

### `POST /api/internal/outbox/run`

Chạy một lượt worker outbox. Tương đương `{"job":"outbox"}` ở trên; giữ lại vì đã có từ
trước.

```json
{ "claimed": 5, "sent": 4, "failed": 1, "deadLettered": 0, "skipped": 0 }
```

---

## 6. Health check

### `GET /api/health/live`

Tiến trình còn nhận request được không. **Không chạm database.**

```json
{ "status": "ok" }
```

Dùng cho probe quyết định **khởi động lại**. Nếu probe này phụ thuộc database, một sự cố
database sẽ làm restart hàng loạt ứng dụng vốn vẫn khoẻ mạnh.

### `GET /api/health/ready`

Có sẵn sàng nhận lưu lượng không. **Có** chạm database.

```json
{
  "status": "ok",
  "checks": [{ "name": "database", "status": "ok", "durationMs": 8 }],
  "durationMs": 8
}
```

| `status` | HTTP | Nghĩa |
|---|---|---|
| `ok` | 200 | Bình thường |
| `degraded` | 200 | Chậm hoặc phụ thuộc phụ trợ hỏng — vẫn nhận lưu lượng |
| `down` | 503 | Phụ thuộc bắt buộc hỏng — rút khỏi cân bằng tải |

`degraded` cố ý trả `200`: một database chậm vẫn tốt hơn không node nào phục vụ.

Phản hồi **không** chứa thông báo lỗi. Lỗi Prisma chứa host, cổng và tên người dùng
database — endpoint này thường để mở cho load balancer.

### `GET /api/auth/[...all]`

Do Better Auth quản lý: đăng nhập, đăng ký, đăng xuất, xác minh email, đặt lại mật khẩu.
Không tự thêm route vào nhánh này.

---

## 7. Chưa có

- **Idempotency-Key.** Bảng `IdempotencyRecord` và mã lỗi `IDEMPOTENCY_CONFLICT` đã có,
  nhưng chưa endpoint nào đọc header này. Bấm gửi hai lần vẫn có thể tạo hai bản ghi.
- **Versioning.** Không có `/v1/`. Chưa cần vì chưa có client bên ngoài.
- **Phân trang chuẩn hoá.** Mỗi màn hình tự xử lý.
- **OpenAPI.** Không có file đặc tả máy đọc được.
