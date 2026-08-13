# Thử trên nhiều máy

Chạy hệ thống sao cho máy khác — laptop thứ hai, điện thoại — vào được, và **GPS hoạt động**.

Xem trước: [`testing-guide.md`](testing-guide.md) cho tài khoản và kịch bản.

---

## 1. Điều bắt buộc phải biết trước

### GPS chỉ chạy trên HTTPS

`navigator.geolocation` là **secure-context API**. Trình duyệt chỉ cho dùng khi trang được
phục vụ qua:

- `https://...` — bất kỳ domain nào
- `http://localhost` hoặc `http://127.0.0.1`

**`http://192.168.0.100:3000` KHÔNG nằm trong danh sách trên.** Mở bằng IP LAN thì mọi thứ
khác hoạt động bình thường — đăng nhập, xem đơn, điều phối — nhưng nút "Bật chia sẻ vị trí"
sẽ báo lỗi hoặc không xin được quyền. Chrome, Edge, Firefox và Safari đều như vậy.

Đây là quy định của trình duyệt, không phải thiếu sót của hệ thống. Không sửa bằng code
được.

### Hệ quả: chọn một trong ba

| Cách | GPS chạy | Máy khác vào được | Lộ ra Internet |
|---|---|---|---|
| **A. Tunnel HTTPS** | ✅ | ✅ mọi nơi | ⚠️ Có |
| **B. LAN + cờ Chrome** | ✅ chỉ máy đã bật cờ | ✅ cùng WiFi | ❌ Không |
| **C. Triển khai thật** | ✅ | ✅ mọi nơi | Có, nhưng có kiểm soát |

Muốn thử nhanh hôm nay, kể cả bằng điện thoại → **cách A**.
Không muốn hở ra Internet, chấp nhận chỉnh tay từng máy → **cách B**.

### Sẽ KHÔNG có bản đồ

`MAP_PROVIDER=none`. Khách hàng thấy vị trí dưới dạng **toạ độ số** (`10.850, 106.760`),
không phải chấm trên bản đồ. Chức năng theo dõi vị trí là thật và dữ liệu là thật; phần hiển
thị bản đồ chưa tích hợp.

---

## 2. Cách A — Cloudflare Tunnel (khuyến nghị)

Cho một URL `https://...` công khai trỏ về máy bạn. Không cần tài khoản, không cần mở cổng
router.

### ⚠️ Đọc trước khi chạy

Lệnh này **đưa ứng dụng đang chạy trên máy bạn ra Internet công khai**. Bất kỳ ai có URL đều
truy cập được, kể cả trang đăng nhập. Các tài khoản thử đều dùng **một mật khẩu ai cũng đoán
được** nếu họ đọc repo này.

Chỉ dùng để thử, và:

- **Tắt tunnel ngay sau khi thử xong** (`Ctrl+C`).
- **Đừng để chạy qua đêm.**
- **Đừng nhập dữ liệu thật** — khách hàng thật, số điện thoại thật, tiền thật.
- Cân nhắc đổi `SEED_DEMO_PASSWORD` sang chuỗi ngẫu nhiên rồi chạy lại
  `pnpm db:seed:accounts` trước khi mở tunnel.

### Bước 1 — cài

```bash
winget install --id Cloudflare.cloudflared
```

Mở terminal mới sau khi cài để `PATH` cập nhật.

### Bước 2 — chạy dev server

```bash
pnpm dev
```

### Bước 3 — mở tunnel (terminal thứ hai)

```bash
cloudflared tunnel --url http://localhost:3000
```

Nó in ra một URL dạng:

```
https://random-words-here.trycloudflare.com
```

Chép lại URL đó.

### Bước 4 — sửa `.env` cho khớp URL

**Bắt buộc.** Không làm bước này thì đăng nhập sẽ hỏng: Better Auth so origin của request
với `BETTER_AUTH_URL`, lệch nhau là từ chối.

```
BETTER_AUTH_URL="https://random-words-here.trycloudflare.com"
NEXT_PUBLIC_SITE_URL="https://random-words-here.trycloudflare.com"
```

Rồi **khởi động lại `pnpm dev`** (biến môi trường chỉ đọc lúc khởi động).

> URL quick tunnel **đổi mỗi lần chạy lại** `cloudflared`. Mỗi lần đổi phải sửa `.env` và
> khởi động lại. Muốn URL cố định thì cần tài khoản Cloudflare và named tunnel.

### Bước 5 — thử

Mở URL đó trên cả hai máy và trên điện thoại. Đăng nhập bình thường.

Khi trả về local, nhớ đổi `.env` lại:

```
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

---

## 3. Cách B — LAN, không hở ra Internet

Máy chủ: `192.168.0.100` (kiểm tra lại bằng `ipconfig` — IP có thể đổi khi cấp lại DHCP).

### Bước 1 — dev server đã lắng nghe sẵn trên mạng

`pnpm dev` in ra cả hai dòng:

```
- Local:    http://localhost:3000
- Network:  http://192.168.0.100:3000
```

Không cần cấu hình gì thêm.

### Bước 2 — mở tường lửa Windows

Chạy PowerShell **quyền quản trị**:

```powershell
New-NetFirewallRule -DisplayName "Next dev 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

`-Profile Private` giới hạn ở mạng riêng. Đừng dùng `Any` — nó mở cả ở mạng công cộng.

Xoá khi thử xong:

```powershell
Remove-NetFirewallRule -DisplayName "Next dev 3000"
```

### Bước 3 — sửa `.env`

```
BETTER_AUTH_URL="http://192.168.0.100:3000"
NEXT_PUBLIC_SITE_URL="http://192.168.0.100:3000"
```

Khởi động lại `pnpm dev`.

### Bước 4 — bật GPS trên máy khách (chỉ Chrome/Edge)

Trên **máy sẽ đóng vai tài xế**, mở `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
bật nó và điền vào ô:

```
http://192.168.0.100:3000
```

Khởi động lại trình duyệt. Sau đó geolocation hoạt động trên origin đó.

**Nhớ tắt cờ này sau khi thử xong** — nó hạ bảo mật của trình duyệt cho origin đã khai.

> Cờ này **không có trên iPhone/Safari**. Muốn thử bằng điện thoại thì phải dùng cách A.

---

## 4. Cách C — triển khai thật

Khi cần URL cố định và chạy lâu dài. Xem [`deployment.md`](deployment.md) cho bản đầy đủ.

Tóm tắt: cần một VPS có Node 22 + PostgreSQL 17 (kèm `btree_gist`), nginx làm reverse proxy
với chứng chỉ Let's Encrypt, và `pnpm build && pnpm start` chạy dưới systemd.

**Trước khi cho người ngoài dùng thật**, đọc `deployment.md` §8 — có hai điều kiện chặn:
quét mã độc đang là `noop` (không quét gì) và MFA chưa triển khai.

---

## 5. Kịch bản thử 2 máy

### Phân vai

| Thiết bị | Tài khoản | Vai trò |
|---|---|---|
| Máy 1 | `doanhnghiep@local.test` | Doanh nghiệp — điều phối, đội xe, hoá đơn |
| Máy 2 | `khach@local.test` | Khách hàng — xem đơn và vị trí |
| **Điện thoại** | `taixe@local.test` | **Tài xế — thiết bị gửi GPS** |

Mật khẩu cả ba: giá trị `SEED_DEMO_PASSWORD` trong `.env`.

> **Vì sao cần thiết bị thứ ba:** vị trí do **thiết bị tài xế** gửi lên. Chỉ có tài khoản
> doanh nghiệp và khách hàng thì không ai gửi toạ độ, và màn hình khách sẽ trống.
>
> Không có điện thoại thì mở thêm một **cửa sổ ẩn danh** trên máy 1 và đăng nhập tài xế ở
> đó. Vị trí sẽ là vị trí của máy 1 (ước lượng theo WiFi), nhưng luồng vẫn đúng.
>
> Dùng điện thoại thật sẽ tốt hơn hẳn: có GPS thật, và đi vòng quanh nhà là thấy toạ độ đổi.

### Các bước

**Trên điện thoại (tài xế):**

1. Mở URL, đăng nhập `taixe@local.test`
2. Menu trái → **Chuyển khu vực → Khu vực tài xế**
3. Chọn chuyến `VTTESTGPS01`
4. Bấm **"Bật chia sẻ vị trí"** → **Cho phép** khi trình duyệt hỏi
5. Để nguyên màn hình đó, đừng khoá máy

**Trên máy 2 (khách hàng):**

6. Đăng nhập `khach@local.test`
7. **Đơn hàng** → `VTTESTGPS01`
8. Chờ khoảng 60 giây rồi tải lại trang

Mục **"Vị trí xe"** hiện toạ độ, ví dụ `10.850, 106.760`.

**Trên máy 1 (doanh nghiệp):**

9. Đăng nhập `doanhnghiep@local.test` → **Điều phối**
10. Xem cùng chuyến đó — nhân viên thấy vị trí kể cả khi khách bị tắt chia sẻ

### Vì sao phải chờ 60 giây

Ứng dụng **không gửi từng điểm một**. Nó gom điểm trong bộ nhớ rồi gửi cả lô mỗi 60 giây —
tiết kiệm pin và chịu được vùng mất sóng. Hai điểm cách nhau dưới 20 giây bị server từ chối.

Không muốn chờ: mở Console trên trang tài xế và dán đoạn ở `testing-guide.md` §4.4 để đẩy
một điểm ngay.

### Nên thử thêm

| Việc | Kết quả đúng |
|---|---|
| Máy 2 mở `VTTESTGPS02` | **Không** thấy vị trí — chuyến này tắt chia sẻ |
| Máy 1 tắt chia sẻ trên `VTTESTGPS01`, máy 2 tải lại | Vị trí biến mất khỏi màn hình khách |
| Đăng nhập `khachhang2@local.test` rồi mở `VTTESTGPS01` | **404** — không phải đơn của họ |
| Tài xế tắt chia sẻ rồi tải lại trang | Không tự bật lại — phải bấm thủ công mỗi phiên |
| Điện thoại: đi bộ vài chục mét | Toạ độ đổi ở lần gửi lô kế tiếp |

---

## 6. Hỏng thì xem đây

| Triệu chứng | Nguyên nhân |
|---|---|
| Nút vị trí báo lỗi / không hỏi quyền | Đang mở bằng `http://` không phải `localhost`. Xem §1 |
| Đăng nhập xong bị đá về trang đăng nhập | `BETTER_AUTH_URL` không khớp URL đang mở |
| Máy khác không mở được trang | Tường lửa (§3 bước 2), hoặc khác mạng WiFi |
| Khách không thấy vị trí | Chuyến tắt `locationSharingEnabled`, hoặc chưa đủ 60 giây |
| Thấy toạ độ nhưng không có bản đồ | Đúng như thiết kế hiện tại — `MAP_PROVIDER=none` |
| Toạ độ sai cả chục km | Máy để bàn không có GPS, trình duyệt đoán theo IP/WiFi |
| Tài xế không thấy chuyến nào | Khung giờ phân công đã cũ — chạy lại `pnpm db:seed:testing` |
