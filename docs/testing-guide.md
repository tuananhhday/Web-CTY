# Hướng dẫn thử tay

Cách dựng môi trường và bấm thử từng luồng trên máy local.

> Đây là tài liệu cho **người phát triển thử tay**, khác với test tự động
> (`pnpm test`, `pnpm test:e2e`).

---

## 1. Khởi động

### Nếu bạn dùng VS Code

Không cần gõ lệnh. `Ctrl+Shift+P` → **Tasks: Run Task** → chọn theo thứ tự:

1. **1. Bật database**
2. **2. Nạp toàn bộ dữ liệu**
3. **3. Chạy dev server**

Lần mở dự án đầu tiên, VS Code sẽ hỏi cài extension đề xuất — bấm **Install**. Nếu không
thấy hộp thoại: `Ctrl+Shift+P` → **Extensions: Show Recommended Extensions**.

Gỡ lỗi: mở tab **Run and Debug** (`Ctrl+Shift+D`), chọn **Gỡ lỗi phía server** rồi `F5`.
Breakpoint trong Server Component, Server Action và service sẽ dừng được. Client Component
(`"use client"`) chạy trong trình duyệt nên cần cấu hình **Gỡ lỗi phía trình duyệt**.

### Hoặc gõ lệnh

```bash
pnpm db:up
```

Chờ PostgreSQL sẵn sàng, rồi nạp dữ liệu:

```bash
pnpm db:deploy && pnpm db:seed && pnpm db:seed:accounts && pnpm db:seed:testing
```

| Lệnh | Tạo ra gì |
|---|---|
| `db:deploy` | Áp migration |
| `db:seed` | Nội dung website: dịch vụ, FAQ, tin tức, trang chính sách |
| `db:seed:accounts` | 12 tài khoản đăng nhập |
| `db:seed:testing` | Xe, chuyến hàng và phân công để bấm thử |

Chạy server:

```bash
pnpm dev
```

Mở http://localhost:3000

> `db:seed:testing` **chạy lại được nhiều lần** — nó xoá dữ liệu thử cũ trước khi tạo mới.
> Chạy lại bất cứ khi nào bạn muốn khung giờ phân công tươi lại.

---

## 2. Tài khoản

Mật khẩu **giống nhau cho tất cả**: giá trị `SEED_DEMO_PASSWORD` trong `.env`
(mặc định `ThayDoiMatKhauNay123!`).

| Email | Vai trò | Vào được đâu |
|---|---|---|
| `superadmin@local.test` | SUPER_ADMIN | Toàn bộ |
| `admin@local.test` | ADMIN | Toàn bộ, **trừ ghi nhận thanh toán** (xem §7) |
| `dieuphoi@local.test` | DISPATCHER | `/quan-tri` — yêu cầu, báo giá, điều phối, đội xe, sự cố |
| `bientap@local.test` | EDITOR | Nội dung (chưa có giao diện) |
| `ketoan@local.test` | ACCOUNTANT | `/quan-tri/hoa-don` — lập và đối chiếu thanh toán |
| `taixe2@local.test` | DRIVER | `/tai-xe` |
| `khachhang1@local.test` | CUSTOMER | `/tai-khoan` |
| `khachhang2@local.test` | CUSTOMER | `/tai-khoan` — dùng để thử truy cập chéo |

Ba tài khoản đặt tên theo vai trò, dành cho kịch bản **thử trên nhiều máy**:

| Email | Vai trò | Ghi chú |
|---|---|---|
| `doanhnghiep@local.test` | DISPATCHER + ACCOUNTANT | Máy "doanh nghiệp". Không phải ADMIN — xem §7 |
| `khach@local.test` | CUSTOMER | Máy "khách hàng". **Chủ của mọi chuyến thử** |
| `taixe@local.test` | DRIVER | **Thiết bị gửi GPS.** Không có nó thì khách không thấy vị trí nào |

Chi tiết kịch bản 2 máy: [`testing-multi-device.md`](testing-multi-device.md).

Email đã được đánh dấu đã xác minh nên đăng nhập được ngay.

> Đăng nhập xong ai cũng đáp xuống `/tai-khoan`. Tài xế và nhân viên có thêm mục
> **"Chuyển khu vực"** ở cuối thanh điều hướng bên trái.

---

## 3. Chuyến hàng có sẵn

Tất cả thuộc về `khach@local.test`. Khung giờ được tính **theo lúc chạy seed**, không
phải ngày cố định.

| Mã | Trạng thái | Tài xế | Dùng để thử |
|---|---|---|---|
| `VTTESTGPS01` | IN_TRANSIT | taixe@ | **GPS** — đang chạy, khách xem được vị trí |
| `VTTESTGPS02` | AT_PICKUP | taixe2@ | GPS **tắt** — khách không xem được vị trí |
| `VTTESTLATE1` | IN_TRANSIT | taixe@ | Chuyến chạy trễ — tài xế **vẫn** cập nhật được |
| `VTTESTDONE1` | COMPLETED | taixe2@ | Đã khép lại — tài xế **không** cập nhật được nữa |

---

## 4. Thử GPS

Đây là phần bạn hỏi, nên ghi kỹ.

### 4.1. Cách hoạt động

- Tài xế phải **chủ động bấm bật**. Không có gì chạy trước đó, và tải lại trang thì tắt —
  đây là vị trí của chính họ, không tự bật lại (§17).
- Trình duyệt gọi `watchPosition`, điểm được **gom vào bộ nhớ**.
- Cứ **60 giây** gửi một lô lên `POST /api/driver/locations`.
- Hai điểm cách nhau dưới **20 giây** bị từ chối phía server (`MIN_INTERVAL_SECONDS`).
- Mất mạng thì điểm nằm lại trong bộ nhớ (tối đa 100 điểm) và đi cùng lô sau.

### 4.2. Các bước

1. Đăng nhập `taixe@local.test`.
2. Vào **Chuyển khu vực → Khu vực tài xế**, hoặc mở thẳng
   http://localhost:3000/tai-xe/chuyen/VTTESTGPS01
3. Bấm **"Bật chia sẻ vị trí"**.
4. Trình duyệt hỏi quyền truy cập vị trí → **Cho phép**.
5. Chờ 60 giây cho lô đầu tiên được gửi.

> `localhost` được coi là ngữ cảnh an toàn nên Geolocation hoạt động mà không cần HTTPS.
> Trên máy để bàn không có GPS, trình duyệt lấy vị trí ước lượng theo IP hoặc WiFi — sai số
> lớn nhưng vẫn đủ để thử luồng.
>
> ⚠️ **Mở bằng IP LAN (`http://192.168.x.x:3000`) thì GPS KHÔNG chạy.** Trình duyệt chỉ cho
> dùng Geolocation trên `https://` hoặc `localhost`. Muốn thử từ máy khác hoặc điện thoại,
> xem [`testing-multi-device.md`](testing-multi-device.md).

### 4.3. Giả lập di chuyển

Máy để bàn đứng yên nên vị trí không đổi. Dùng Chrome DevTools để giả lập:

1. `F12` → `Ctrl+Shift+P` → gõ **"Show Sensors"**
2. Mục **Location** → chọn một thành phố có sẵn, hoặc **Manage** để nhập toạ độ tay
3. Đổi toạ độ trong lúc đang chia sẻ → điểm mới sẽ được ghi nhận

Vài toạ độ tiện dùng:

| Nơi | Vĩ độ | Kinh độ |
|---|---|---|
| Bến Thành, Q1 | 10.7769 | 106.7009 |
| Thủ Đức | 10.8500 | 106.7600 |
| Biên Hoà | 10.9450 | 106.8240 |

DevTools còn có sẵn kịch bản **"Custom location"** và profile di chuyển để giả lập lộ trình.

### 4.4. Kiểm tra dữ liệu đã vào chưa

**Cách 1 — bằng mắt, phía khách hàng:**

Đăng nhập `khach@local.test`, mở
http://localhost:3000/tai-khoan/don-hang/VTTESTGPS01

Vị trí hiện dưới dạng **toạ độ số**, không phải bản đồ — `MAP_PROVIDER=none`, chưa tích hợp
nhà cung cấp bản đồ nào.

**Cách 2 — trong database:**

```bash
docker exec vantai_postgres psql -U vantai -d vantai -c 'SELECT "recordedAt", "receivedAt", latitude, longitude, "accuracyM" FROM location_pings ORDER BY "recordedAt" DESC LIMIT 10;'
```

**Cách 3 — không chờ 60 giây:** mở Console của DevTools trên trang tài xế và dán:

```js
await fetch("/api/driver/locations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    trackingCode: "VTTESTGPS01",
    pings: [{ latitude: 10.85, longitude: 106.76, accuracyM: 15, recordedAt: new Date().toISOString() }],
  }),
}).then((r) => r.json());
```

Trả về `{"accepted":1,"rejected":[]}` là đã ghi.

### 4.5. Những giới hạn nên thử luôn

| Thử gì | Kết quả đúng |
|---|---|
| Mở `VTTESTGPS02` bằng `khach@local.test`, xem vị trí | **Không thấy** — `locationSharingEnabled = false` |
| Xem `VTTESTGPS01` bằng `khachhang2@local.test` | **404**, không phải 403 |
| Đăng nhập `taixe2@local.test` rồi mở `/tai-xe/chuyen/VTTESTGPS01` | **404** — không phải chuyến của họ |
| Gửi hai điểm cách nhau 5 giây | Điểm thứ hai vào mảng `rejected` |
| Xem thông tin tài xế trên `VTTESTDONE1` | **Bị ẩn** — khung giờ đã hết (§16.1) |

---

## 5. Thử các luồng khác

### 5.1. Chuyến chạy trễ

`VTTESTLATE1` có khung giờ phân công đã kết thúc từ hôm qua, nhưng trạng thái vẫn
`IN_TRANSIT`.

Đăng nhập `taixe@local.test` và mở nó: bạn **vẫn cập nhật được** trạng thái, tải ảnh, báo sự cố.

Đây là hành vi đúng và có chủ đích. Chuyến chạy trễ là chuyện thường trong vận tải; nếu
khoá theo khung giờ thì tài xế sẽ bị chặn khỏi chính chuyến họ đang chạy. Ranh giới là
**trạng thái chuyến**, không phải giờ giấc.

So sánh với `VTTESTDONE1` (`COMPLETED`): ở đó bạn sẽ nhận thông báo
*"Chuyến đã khép lại. Liên hệ điều phối nếu cần bổ sung thông tin."*

### 5.2. Chống trùng lịch

Đăng nhập `dieuphoi@local.test` → `/quan-tri/dieu-phoi`.

Thử phân công `taixe@local.test` cho một chuyến có khung giờ chồng với `VTTESTGPS01`. Hệ thống chặn ở
ba lớp; lớp cuối là ràng buộc ở database nên không lách được.

### 5.3. Tải ảnh bằng chứng

Trên màn hình tài xế, thử tải lên:

| Tệp | Kết quả đúng |
|---|---|
| Ảnh JPEG/PNG/HEIC thật | Nhận |
| File `.svg` | **Từ chối** — SVG chạy được JavaScript |
| Đổi tên `.svg` thành `.png` | **Vẫn từ chối** — kiểm bằng magic bytes, không tin đuôi tệp |
| Ảnh trên 15 MB | Từ chối |

⚠️ **Không có quét mã độc.** `VIRUS_SCAN_PROVIDER=noop` luôn trả "sạch".

### 5.4. Hoá đơn

Đăng nhập `ketoan@local.test` → `/quan-tri/hoa-don`.

Điểm đáng thử: ghi nhận thanh toán **không** làm giảm công nợ ngay. Nó tạo bản ghi
`PENDING`; phải bấm xác nhận (bước hai) thì số dư mới đổi.

### 5.5. Tra cứu công khai

http://localhost:3000/tra-cuu — nhập mã `VTTESTGPS01` và **4 số cuối** là `0012`.

Chỉ bốn số chứ không phải cả số điện thoại: đủ để chứng minh có liên quan, không đủ để lộ
thêm nếu ai đó đoán trúng mã.

Thử nhập sai bốn số: thông báo lỗi **giống hệt** khi nhập sai mã vận đơn. Cố ý — phân biệt
hai trường hợp sẽ cho phép dò ra mã nào có thật.

Kiểm nhanh bằng dòng lệnh:

```bash
curl -s -X POST http://localhost:3000/api/public/tracking -H "content-type: application/json" -d '{"trackingCode":"VTTESTGPS01","phoneSuffix":"0012"}'
```

### 5.6. Header bảo mật

```bash
curl -sI http://localhost:3000/ | grep -i content-security
curl -sI http://localhost:3000/dang-nhap | grep -i content-security
```

Trang public có `'unsafe-inline'`, trang đăng nhập có `'nonce-...'`. Khác nhau là đúng —
xem `security.md` §4.

### 5.7. Health check

```bash
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
```

Thử tắt database (`pnpm db:down`) rồi gọi lại `ready`: phải trả **503** và **không** lộ
host hay cổng.

---

## 6. Thông báo, job định kỳ

Mặc định `SCHEDULER_ENABLED=false` nên job không tự chạy. Bật bằng cách sửa `.env` rồi khởi
động lại, hoặc gọi tay:

```bash
curl -X POST http://localhost:3000/api/internal/scheduler/run \
  -H "x-internal-key: $(grep '^BETTER_AUTH_SECRET' .env | cut -d= -f2- | tr -d '\"')" \
  -H "content-type: application/json" -d '{"job":"outbox"}'
```

Email **không được gửi đi đâu** — `EMAIL_PROVIDER=console` in ra log của `pnpm dev`. Xem
nội dung email ngay trong terminal.

---

## 7. Những thứ sẽ KHÔNG hoạt động

Ghi ra trước để bạn không mất thời gian tìm lỗi không tồn tại.

| Thứ | Vì sao |
|---|---|
| **Bản đồ** | `MAP_PROVIDER=none` — vị trí hiện dạng toạ độ số |
| **Email, SMS** | `console` — chỉ in ra log terminal |
| **ADMIN ghi nhận thanh toán** | Cần MFA, mà MFA chưa triển khai. Dùng `ketoan@local.test` |
| **Quét mã độc** | `noop` — luôn báo sạch |
| `/quan-tri/don-hang`, `/bang-gia`, `/noi-dung`, `/tin-tuc`, `/nguoi-dung`, `/nhat-ky`, `/cau-hinh` | Chưa xây. Đã ẩn khỏi menu |
| `/tai-khoan/ho-so` | Còn dữ liệu giả |
| Ảnh thu nhỏ | Chưa có — danh sách tải ảnh gốc |

---

## 8. Dọn dẹp và làm lại

Xoá riêng dữ liệu thử (giữ nguyên nội dung website và tài khoản):

```bash
pnpm db:seed:testing
```

Làm lại từ đầu — **xoá sạch database**:

```bash
pnpm db:reset && pnpm db:seed && pnpm db:seed:accounts && pnpm db:seed:testing
```
