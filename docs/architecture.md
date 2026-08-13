# Kiến trúc

Cách hệ thống được tổ chức và **vì sao** tổ chức như vậy.

---

## 1. Tổng quan

Một ứng dụng Next.js App Router duy nhất, một database PostgreSQL. Không có microservice,
không có service worker riêng, không có hàng đợi bên ngoài.

```
Trình duyệt
    │
    ▼
nginx / Caddy  ── TLS
    │
    ▼
Next.js (một tiến trình Node)
    ├── Server Component  ── đọc dữ liệu
    ├── Server Action     ── ghi dữ liệu
    ├── Route Handler     ── API cho form công khai, tài xế, tệp, endpoint nội bộ
    └── Bộ lập lịch       ── ba job định kỳ, cùng tiến trình
    │
    ▼
PostgreSQL 17 (+ btree_gist)
    │
    ▼
Storage tệp (local hoặc S3)
```

Lựa chọn "một tiến trình" là có chủ đích. Quy mô nghiệp vụ ở đây là hàng chục đến hàng
trăm chuyến mỗi ngày. Tách service ra sẽ thêm chi phí vận hành mà không giải quyết vấn đề
nào đang có.

---

## 2. Phân tầng

Bốn tầng, chiều phụ thuộc chỉ đi xuống.

```
  Trang và component      src/app, src/components
          │  gọi
          ▼
  Service                 src/modules/*/service.ts
          │  gọi                    │  gọi
          ▼                         ▼
  Repository              Module thuần
  src/modules/*/          state-machine.ts, totals.ts, pricing.ts, …
  repository.ts
          │
          ▼
  Prisma → PostgreSQL
```

**Component không bao giờ import Prisma.** `src/lib/db.ts` gắn `server-only` và chỉ được
import từ repository/service. Truy vấn rải rác trong component là cách chắc chắn nhất để
một màn hình nào đó quên kiểm tra quyền.

### Vì sao tách "module thuần" ra riêng

Đây là quyết định kiến trúc quan trọng nhất trong dự án.

State machine, tính tiền, che dữ liệu, logic thử lại, tổng hoá đơn — tất cả nằm trong các
file **không import gì**: không Prisma, không React, không `server-only`.

Lợi ích cụ thể:

- Kiểm thử được toàn bộ trường hợp biên mà không cần database. Chuyển trạng thái sai, tiền
  âm, thanh toán vượt, backoff sau 7 lần lỗi — tất cả là hàm nhận vào, trả ra.
- Chạy nhanh. 33 file test chạy trong vài giây thay vì vài phút.
- Quy tắc nghiệp vụ nằm một chỗ, đọc được mà không phải lần theo truy vấn.

Ví dụ: `src/modules/invoices/totals.ts` biết cách phân bổ chiết khấu toàn hoá đơn theo tỷ
lệ vào từng dòng chịu thuế. Nó không biết hoá đơn được lưu ở đâu.

---

## 3. Cấu trúc module

Mỗi module trong `src/modules/` có tối đa năm loại file. Không phải module nào cũng có đủ.

| File | Vai trò | Import được gì |
|---|---|---|
| `state-machine.ts` | Trạng thái hợp lệ và chuyển tiếp hợp lệ | Không gì |
| `schema.ts` | Zod schema, dùng chung client và server | Chỉ `zod` |
| `totals.ts` / `pricing.ts` | Tính toán | Chỉ `decimal.js` |
| `repository.ts` | Truy vấn Prisma, danh sách cột | `db` |
| `service.ts` | Điều phối: kiểm quyền → gọi module thuần → ghi → audit | Tất cả |

Thứ tự trong `service.ts` luôn giống nhau:

1. Kiểm tra quyền (`src/modules/auth/policy.ts`)
2. Kiểm tra dữ liệu vào (Zod)
3. Kiểm tra quy tắc nghiệp vụ (state machine)
4. Ghi trong transaction, kèm `AuditLog` và `OutboxEvent`
5. Trả về

Bước 4 quan trọng: bản ghi audit và sự kiện thông báo nằm **trong cùng transaction** với
thay đổi nghiệp vụ. Không có chuyện đơn hàng đổi trạng thái mà nhật ký không ghi được.

---

## 4. Đọc và ghi

| Việc | Cơ chế | Ví dụ |
|---|---|---|
| Đọc, có phiên | Server Component gọi service | `/tai-khoan/don-hang` |
| Ghi, có phiên | Server Action | Điều phối viên phân công xe |
| Ghi, không phiên | Route Handler | Form báo giá công khai |
| Tài xế gửi vị trí | Route Handler | `POST /api/driver/locations` |
| Tệp | Route Handler | `/api/uploads/*`, `/api/media/[id]` |

Server Action được ưu tiên khi đã có phiên: không phải tự viết endpoint, tự parse JSON, tự
xử lý CSRF. Route Handler dùng khi client không phải là form React của chính hệ thống.

---

## 5. Nhà cung cấp bên ngoài

`src/lib/providers/` bọc mọi phụ thuộc ngoài sau một interface, chọn bằng biến môi trường.

| Interface | Bản mặc định | Bản thật |
|---|---|---|
| `StorageProvider` | `local` — ghi ra đĩa | `s3` |
| `EmailProvider` | `console` — in ra log | `smtp` |
| `SmsProvider` | `console` | `http` |
| `VirusScanProvider` | `noop` — **không quét** | `http` |

Mọi bản mặc định đều là bản giả lập cho phát triển. `deployment.md` §8 liệt kê cái nào bắt
buộc phải thay trước khi chạy thật.

Mỗi provider có cờ `isProductionReady`. Nó tồn tại để mã nguồn tự khai báo giới hạn của
mình, thay vì để người triển khai đoán.

---

## 6. Thông báo — mẫu outbox

Vấn đề: đổi trạng thái chuyến rồi gửi email. Nếu gửi email trong cùng transaction, một lỗi
SMTP sẽ rollback cả việc đổi trạng thái. Nếu gửi sau khi commit, tiến trình chết giữa
chừng là mất thông báo.

Cách giải: transaction ghi một dòng vào `OutboxEvent` cùng lúc với thay đổi nghiệp vụ. Một
worker riêng đọc bảng đó và gửi.

```
Transaction:  cập nhật Shipment  +  ghi AuditLog  +  ghi OutboxEvent
                                                          │
Worker (mỗi 60 giây): claim → gửi → đánh dấu SENT ────────┘
                              │
                              └── lỗi → backoff luỹ thừa + jitter → thử lại → DEAD_LETTER
```

Worker claim bản ghi bằng `updateMany` kèm điều kiện trạng thái, nên hai worker chạy song
song không lấy trùng một bản ghi. Bản ghi kẹt ở `PROCESSING` quá 15 phút được thả ra —
xử lý trường hợp tiến trình chết giữa lúc đang gửi.

Chi tiết: [`notifications.md`](notifications.md).

---

## 7. Chống trùng lịch — ba lớp

Một xe hoặc một tài xế không được nhận hai chuyến chồng giờ. Việc này được chặn ở ba nơi
độc lập:

1. **Giao diện** — form phân công gọi trước một hàm xem thử và hiện cảnh báo. Chỉ là gợi ý.
2. **Ứng dụng** — `findConflicts()` truy vấn các phân công giao nhau. Chặn thật, nhưng có
   khe hở khi hai người bấm cùng lúc.
3. **Database** — ràng buộc exclusion dùng `btree_gist` trên khoảng thời gian. Đây là lớp
   duy nhất không thể lách, kể cả khi hai transaction chạy đồng thời.

Lớp 1 và 2 tồn tại vì lớp 3 cho thông báo lỗi khó hiểu với người dùng. Lớp 3 tồn tại vì lớp
1 và 2 có thể sai.

---

## 8. Tiền

Tất cả tiền dùng `Decimal.js`, lưu dưới dạng `Decimal` của Prisma. **Không dùng `Float`
hay `Number` ở bất kỳ đâu trong đường đi của tiền.**

Lý do quen thuộc nhưng vẫn phải nhắc: `0.1 + 0.2 !== 0.3` trong số thực dấu phẩy động. Với
VND và các phép cộng dồn thuế, chiết khấu, phụ phí, sai số sẽ tích tụ tới mức hoá đơn lệch
vài đồng — đủ để kế toán không đối chiếu được.

---

## 9. Kiểm thử

```
tests/
├── unit/          Module thuần. Không database. Chạy song song.
├── integration/   Service thật + PostgreSQL thật. Chạy tuần tự.
├── e2e/           Playwright trên bản build production.
├── fixtures/      Dữ liệu dùng chung
└── stubs/         Bản giả cho provider
```

Vitest tách hai project vì integration test dùng chung một database và không chạy song song
được. Unit test thì chạy song song thoải mái.

E2E chạy trên bản build **production**, không phải dev server. Nhiều lỗi chỉ xuất hiện ở
production build: render tĩnh, CSP, tối ưu bundle.

---

## 10. Những gì cố tình **không** làm

| Không có | Vì sao |
|---|---|
| Microservice | Quy mô không cần; thêm chi phí vận hành |
| GraphQL | Server Component đã giải quyết vấn đề over-fetching |
| Redis (mặc định) | Rate limit trong RAM đủ cho một tiến trình |
| Hàng đợi ngoài (RabbitMQ, SQS) | Bảng outbox trong PostgreSQL đủ ở quy mô này |
| Máy chủ WebSocket | Không có tính năng nào cần cập nhật thời gian thực |
| Docker cho ứng dụng | Chỉ dùng Docker cho PostgreSQL lúc phát triển |

Mỗi dòng đều là lựa chọn có thể đảo lại khi quy mô đổi. Ghi ra để lần sau ai đó hỏi "sao
không dùng X" thì có câu trả lời, thay vì tưởng là bỏ sót.

### Tính năng bị cấm ở giai đoạn này

Hai tính năng bị cấm hoàn toàn: **tìm hàng hoá từ Facebook** và **AI ước tính giá từ ảnh**.
Không có route, menu, bảng database, quyền, giao diện hay dữ liệu mẫu nào cho chúng. Chỉ
được mô tả trong [`future-features.md`](future-features.md).
