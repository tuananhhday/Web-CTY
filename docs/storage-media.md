# Lưu trữ và tệp tải lên

Ảnh và video bằng chứng giao hàng đi qua đâu, và vì sao luồng lại nhiều bước như vậy.

---

## 1. Luồng 8 bước

Tài xế bấm "chụp ảnh" và thấy một thao tác. Bên dưới là tám bước.

```
 1. Client xin phép         POST /api/uploads/intent
 2. Server kiểm quyền       tài xế có được phân chuyến này không
 3. Server sinh object key  UUID, KHÔNG dùng tên tệp người dùng
                            → tạo bản ghi ShipmentMedia ở trạng thái QUARANTINED
                            → trả về URL tải lên ngắn hạn
 4. Client PUT nội dung     thẳng lên storage
 5. Client xác nhận         POST /api/uploads/confirm
 6. Server xác minh         tồn tại → kích thước → magic bytes → checksum → quét mã độc
 7. Đạt → READY             chỉ media READY mới hiển thị
 8. Xem/tải                 GET /api/media/[id], có kiểm quyền
```

### Vì sao không nhận tệp thẳng vào server

Tải qua server nghĩa là một video 200 MB đi qua tiến trình Node, chiếm bộ nhớ và giữ một
kết nối trong nhiều phút. Với adapter S3, client tải thẳng lên bucket; server chỉ ký URL.

### Vì sao tạo bản ghi ở bước 3, trước khi có nội dung

Đây là chi tiết dễ bị làm ngược.

Nếu tạo bản ghi **sau** khi tải xong, thì tệp đã nằm trong storage mà client mất sóng trước
khi gọi confirm sẽ thành **tệp mồ côi**: không có gì trong database trỏ tới nó, không ai
biết nó tồn tại, và nó nằm đó vĩnh viễn.

Tạo trước thì trường hợp xấu nhất là một bản ghi `QUARANTINED` không bao giờ chuyển sang
`READY` — và job `cleanup-media` biết cách dọn.

---

## 2. Trạng thái của một tệp

| Trạng thái | Nghĩa | Hiển thị được |
|---|---|---|
| `QUARANTINED` | Đã cấp phép, chưa xác minh xong | Không |
| `READY` | Đã qua toàn bộ kiểm tra | Có |
| `REJECTED` | Không đạt, kèm lý do | Không |

Tệp `REJECTED` **không bị xoá bản ghi** — giữ lại lý do vì sao bị loại. Nhưng nội dung bị
xoá khỏi storage ngay lúc từ chối; chỉ còn metadata.

---

## 3. Kiểm tra định dạng

`src/modules/media/file-types.ts`

### Nhận dạng bằng magic bytes

Server đọc 16 byte đầu của tệp và so với chữ ký đã biết. **Không tin `Content-Type` client
gửi** — client tự khai, và đổi được.

Danh sách được phép:

| MIME | Loại | Chữ ký |
|---|---|---|
| `image/jpeg` | Ảnh | `FF D8 FF` |
| `image/png` | Ảnh | `89 50 4E 47 0D 0A 1A 0A` |
| `image/webp` | Ảnh | `RIFF` ở offset 0 + `WEBP` ở offset 8 |
| `image/heic` | Ảnh | `ftyp` ở offset 4 + brand `heic`/`heix`/`hevc`/`mif1` |
| `video/mp4` | Video | `ftyp` + brand `isom`/`iso2`/`mp41`/`mp42`/`avc1` |
| `video/quicktime` | Video | `ftyp` + brand `qt  ` |
| `application/pdf` | Tài liệu | `%PDF-` |

HEIC có trong danh sách vì iPhone chụp mặc định ra HEIC. Từ chối nó nghĩa là tài xế dùng
iPhone không tải được ảnh nào.

Các định dạng họ ISO-BMFF (HEIC, MP4, MOV) dùng chung chữ ký `ftyp`, nên phải kiểm tra thêm
brand ở offset 8 để phân biệt.

### SVG bị cấm hoàn toàn

SVG là XML và **chạy được JavaScript**. Một tệp `.svg` chứa `<script>` được phục vụ từ cùng
origin với ứng dụng là XSS đầy đủ quyền, đọc được cookie phiên của người xem.

Không có cách nào lọc SVG an toàn tuyệt đối, nên cách xử lý là không nhận.

### PDF ép tải xuống

`contentDispositionFor()` trả `inline` cho ảnh và video, `attachment` cho mọi thứ khác — kể
cả PDF.

PDF mở inline chạy được JavaScript trong một số trình duyệt. Nội dung do người dùng tải lên
không nên chạy trong cùng origin với ứng dụng.

### Giới hạn kích thước

| Loại | Tối đa |
|---|---|
| Ảnh | 15 MB |
| Video | 200 MB |
| Tài liệu | 20 MB |

Tối đa **20 tệp mỗi giai đoạn** của một chuyến (`MAX_MEDIA_PER_STAGE`).

---

## 4. Object key

Server sinh, không dùng tên tệp người dùng:

```
shipments/{shipmentId}/{stage}/{uuid}.{ext}
```

Tên tệp người dùng có thể chứa `../`, ký tự điều khiển, hoặc trùng nhau giữa các chuyến.
UUID thì không. Thư mục theo chuyến và giai đoạn để dọn dẹp và soát lại dễ hơn.

Adapter `local` còn kiểm tra đường dẫn đã resolve có nằm trong thư mục gốc hay không — lớp
phòng thủ thứ hai cho path traversal.

---

## 5. Giai đoạn và mức hiển thị

`MediaStage` — 10 giá trị, gắn tệp với mốc trong hành trình:

```
BEFORE_PICKUP · PICKUP_INSPECTION · PACKING · LOADING · SECURING
IN_TRANSIT · UNLOADING · DELIVERY · DAMAGE_EVIDENCE · PROOF_OF_DELIVERY
```

`MediaVisibility` — hai giá trị:

| Giá trị | Ai xem được |
|---|---|
| `INTERNAL` | Chỉ nhân viên và tài xế |
| `CUSTOMER` | Khách hàng của chuyến đó cũng xem được |

Mặc định là `INTERNAL`. Phải chủ động mở cho khách, không phải chủ động đóng.

Ảnh hư hỏng hàng hoá (`DAMAGE_EVIDENCE`) thường để `INTERNAL` cho tới khi bộ phận xử lý sự
cố quyết định chia sẻ.

---

## 6. Truy cập tệp

`GET /api/media/[id]` là **proxy có kiểm quyền**, không phải chuyển hướng tới storage.

Lý do: URL ký sẵn của S3 dùng lại được cho tới khi hết hạn, và chia sẻ được. Proxy cho phép
kiểm tra quyền ở **mỗi lần tải**, và ghi lại ai đã xem gì.

Phản hồi mang:

```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox
X-Content-Type-Options: nosniff
```

`nosniff` quan trọng nhất ở đây. Không có nó, một tệp gắn mác `image/png` nhưng chứa HTML
vẫn có thể bị trình duyệt diễn giải thành trang web và chạy script trong đó.

Khách hàng hỏi một `mediaId` không thuộc chuyến của mình nhận `404`, không phải `403`.

---

## 7. Nhà cung cấp lưu trữ

### `local` (mặc định)

Ghi ra đĩa của chính máy chủ ứng dụng. URL tải lên được ký bằng HMAC và có hạn.

Đủ để chạy và kiểm thử toàn bộ luồng 8 bước mà không cần tài khoản S3.

**Không dùng ở production:**

- Tệp nằm trên đĩa một instance — không chia sẻ được giữa nhiều instance.
- Không nhân bản. Mất máy chủ là mất toàn bộ ảnh bằng chứng giao hàng.
- Không CDN, không lifecycle policy.

### `s3`

Chưa triển khai. Chọn `STORAGE_PROVIDER=s3` sẽ **báo lỗi rõ ràng ngay lúc khởi tạo**, thay
vì âm thầm ghi vào đĩa và làm người vận hành tưởng đã dùng object storage thật.

Gói `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner` đã có trong phụ thuộc, chờ nối
vào.

---

## 8. ⚠️ Quét mã độc — chưa có

`VIRUS_SCAN_PROVIDER=noop` là mặc định, và adapter `noop` **luôn trả về "sạch"**.

Vì sao đây là vấn đề nghiêm trọng ở hệ thống này cụ thể: tài xế tải tệp lên, rồi nhân viên
và **khách hàng** tải về. Đó là một đường dẫn hoàn chỉnh từ thiết bị ngoài tầm kiểm soát tới
máy của khách.

Kiểm tra magic bytes chặn được tệp giả mạo đuôi, nhưng **không** phát hiện được mã độc nằm
trong một tệp JPEG hợp lệ về cấu trúc.

Chuyển sang `VIRUS_SCAN_PROVIDER=http` và trỏ tới dịch vụ quét thật **trước khi** mở tính
năng tải tệp cho người dùng ngoài.

---

## 9. Dọn dẹp

`src/modules/media/cleanup.ts`, chạy mỗi 6 giờ qua bộ lập lịch.

| Đối tượng | Ngưỡng | Xử lý |
|---|---|---|
| `QUARANTINED` bỏ dở | 24 giờ | Xoá tệp khỏi storage, rồi xoá bản ghi |
| `REJECTED` quá hạn | 90 ngày | Xoá bản ghi (tệp đã xoá từ lúc từ chối) |

24 giờ chứ không phải 15 phút, dù URL tải lên chỉ sống vài phút: tài xế ở vùng sóng yếu có
thể tải một video 100 MB rất lâu, và xoá nhầm một tệp bằng chứng đang tải dở thì không lấy
lại được. Rác nằm thêm một ngày rẻ hơn nhiều so với mất bằng chứng.

### Thứ tự xoá

**Storage trước, database sau.**

Xoá bản ghi trước rồi storage lỗi → tệp mồ côi vĩnh viễn, không còn gì trỏ tới. Làm đúng
thứ tự thì trường hợp xấu nhất là bản ghi còn nằm đó và lượt sau thử lại.

`storageFailures > 0` trong kết quả nghĩa là có tệp không xoá được — thường do quyền thư
mục. Xem [`operations-runbook.md`](operations-runbook.md) §7.

> **Không xoá tệp trong thư mục storage bằng tay.** Bản ghi database sẽ trỏ tới tệp không
> còn tồn tại và màn hình bằng chứng giao hàng báo lỗi thay vì hiện ảnh.

---

## 10. Chưa có

- Quét mã độc thật (§8) — **chặn tiếp nhận tệp từ người dùng ngoài**.
- Adapter S3.
- Tạo ảnh thu nhỏ. Danh sách ảnh tải nguyên bản, tốn băng thông trên mạng di động.
- Chuyển mã video. Video của tài xế được phục vụ nguyên định dạng gốc.
- Trích xuất EXIF (thời gian chụp, toạ độ) — hiện `capturedAt` do client khai.
- Xoá metadata EXIF trước khi cho khách xem.
