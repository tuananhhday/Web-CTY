# Triển khai

Hướng dẫn đưa hệ thống lên máy chủ thật.

> **Đọc trước:** hệ thống hiện **chưa sẵn sàng production**. Phần
> [Chưa đủ điều kiện chạy thật](#chưa-đủ-điều-kiện-chạy-thật) liệt kê những gì còn thiếu.
> Tài liệu này mô tả cách triển khai đúng kỹ thuật, không phải lời khẳng định hệ thống đã
> sẵn sàng phục vụ khách hàng thật.

---

## 1. Yêu cầu hạ tầng

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 22 LTS trở lên | Next.js 16 yêu cầu ≥ 20.9, nhưng 22 LTS được hỗ trợ dài hơn |
| pnpm | 11 | Dự án khoá bằng `pnpm-lock.yaml`; dùng npm/yarn sẽ ra cây phụ thuộc khác |
| PostgreSQL | 17 | Bắt buộc có extension `btree_gist` (xem §3) |
| RAM | tối thiểu 2 GB | Bản build Next.js cần ~1 GB lúc `pnpm build` |
| Đĩa | tuỳ lượng media | Adapter `local` ghi vào thư mục của ứng dụng; xem `storage-media.md` |

Chỉ cần **một** tiến trình Node. Hệ thống không có worker riêng — job định kỳ chạy trong
cùng tiến trình web (xem §6).

---

## 2. Biến môi trường

Chép `.env.example` thành `.env` rồi điền. File đó có chú thích cho từng biến.

**Bắt buộc, không có giá trị mặc định — thiếu là ứng dụng không khởi động:**

```
DATABASE_URL           postgresql://user:pass@host:5432/dbname
BETTER_AUTH_SECRET     chuỗi ngẫu nhiên ≥ 32 ký tự
BETTER_AUTH_URL        https://tenmien.vn
NEXT_PUBLIC_SITE_URL   https://tenmien.vn
```

Sinh secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`src/lib/env.ts` kiểm tra toàn bộ biến bằng Zod ngay khi tiến trình khởi động. Sai kiểu
hoặc thiếu biến bắt buộc thì dừng ngay với thông báo rõ ràng, thay vì chạy được rồi hỏng
giữa chừng.

**Biến chọn nhà cung cấp** — mặc định đều là bản giả lập dành cho phát triển:

| Biến | Mặc định | Ý nghĩa của mặc định |
|---|---|---|
| `STORAGE_PROVIDER` | `local` | Ghi file vào đĩa của chính máy chủ ứng dụng |
| `VIRUS_SCAN_PROVIDER` | `noop` | **Không quét gì cả** — xem cảnh báo ở §8 |
| `EMAIL_PROVIDER` | `console` | In email ra log thay vì gửi |
| `SMS_PROVIDER` | `console` | In SMS ra log thay vì gửi |
| `MAP_PROVIDER` | `none` | Không có bản đồ, chỉ hiện toạ độ dạng số |
| `RATE_LIMIT_DRIVER` | `memory` | Bộ đếm trong RAM, mất khi khởi động lại |
| `CAPTCHA_PROVIDER` | `none` | Form công khai không có captcha |

---

## 3. Chuẩn bị database

```bash
createdb vantai
psql -d vantai -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
```

`btree_gist` là **bắt buộc**, không phải tuỳ chọn. Ràng buộc exclusion chống trùng lịch xe
và tài xế (`docs/workflows.md`, phần điều phối) dựa vào nó. Thiếu extension thì migration
sẽ dừng.

Chạy migration:

```bash
pnpm db:deploy
```

Dùng `db:deploy` chứ **không** dùng `db:migrate` trên máy chủ thật. `db:migrate` là lệnh
dành cho phát triển: nó có thể sinh migration mới và, trong một số trường hợp, đề nghị
reset database.

Nạp nội dung khởi tạo (trang tĩnh, danh mục dịch vụ):

```bash
pnpm db:seed
```

> `pnpm db:seed:accounts` tạo 9 tài khoản mẫu với mật khẩu chung. **Không chạy trên máy chủ
> thật.** Nó chỉ hoạt động khi có `SEED_DEMO_PASSWORD`, nhưng đừng đặt biến đó ở production.

---

## 4. Build và chạy

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`postinstall` tự chạy `prisma generate`. Nếu bỏ qua bước cài đặt mà chỉ build, Prisma
client sẽ cũ so với schema và typecheck sẽ báo lỗi thiếu thuộc tính.

Chạy dưới systemd:

```ini
# /etc/systemd/system/vantai.service
[Unit]
Description=Nen tang van tai
After=network.target postgresql.service

[Service]
Type=simple
User=vantai
WorkingDirectory=/opt/vantai
EnvironmentFile=/opt/vantai/.env
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
# Cho ứng dụng kịp dừng job đang chạy dở.
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

`TimeoutStopSec=30` không phải con số tuỳ tiện: khi nhận `SIGTERM`, bộ lập lịch dừng nhận
việc mới nhưng job đang chạy vẫn chạy nốt. Cắt quá sớm có thể ngắt một lượt outbox giữa
chừng.

---

## 5. Reverse proxy

Ứng dụng nghe HTTP trên cổng 3000 và **không tự xử lý TLS**. Đặt sau nginx/Caddy.

```nginx
server {
    listen 443 ssl http2;
    server_name tenmien.vn;

    # Ảnh và video bằng chứng giao hàng có thể lớn.
    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`X-Forwarded-Proto` là bắt buộc. Thiếu nó, Better Auth sẽ tưởng đang chạy trên HTTP và
không đặt cờ `Secure` cho cookie phiên.

**Không thêm header bảo mật ở tầng nginx.** Ứng dụng đã tự đặt CSP, HSTS,
`X-Content-Type-Options`, `Permissions-Policy` và `Referrer-Policy` (xem `security.md`).
Đặt trùng ở proxy sẽ sinh hai giá trị cho cùng một header, và với CSP thì trình duyệt áp
**giao** của cả hai — kết quả là chính sách chặt hơn dự kiến và giao diện hỏng theo cách
rất khó lần ra.

---

## 6. Job định kỳ

Ba việc chạy nền: gửi thông báo trong outbox, xoá điểm vị trí quá hạn, dọn tệp tải lên bỏ
dở. Có hai cách chạy, chọn **một**.

**Cách A — một tiến trình duy nhất (khuyến nghị cho VPS):**

```
SCHEDULER_ENABLED="true"
```

Ứng dụng tự chạy. Không cần cấu hình gì thêm.

**Cách B — nhiều instance hoặc nền serverless:**

```
SCHEDULER_ENABLED="false"
```

rồi gọi từ cron bên ngoài:

```bash
* * * * * curl -fsS -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" -d '{"job":"outbox"}'

0 */6 * * * curl -fsS -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" -d '{"job":"cleanup-media"}'
```

Bật cách A khi chạy nhiều instance là **nhân công việc lên theo số instance**. Chi tiết
trong `operations-runbook.md`.

---

## 7. Health check

| Endpoint | Dùng để | Chạm database |
|---|---|---|
| `GET /api/health/live` | Quyết định khởi động lại tiến trình | Không |
| `GET /api/health/ready` | Quyết định có đưa lưu lượng vào không | Có |

`ready` trả `503` khi database không truy cập được, `200` khi ổn hoặc chỉ chậm.

Cấu hình cho load balancer: probe `ready`, không probe `live`. Dùng `live` cho probe khởi
động lại. Đảo hai cái này sẽ khiến một sự cố database tạm thời làm restart toàn bộ ứng
dụng trong khi bản thân nó vẫn khoẻ.

---

## 8. Chưa đủ điều kiện chạy thật

Những mục sau **phải** xử lý trước khi phục vụ khách hàng thật.

### 8.1. Quét mã độc — chặn tiếp nhận tệp công khai

`VIRUS_SCAN_PROVIDER=noop` nghĩa là **không quét gì**. Adapter `noop` luôn trả về "sạch".

Hệ thống cho tài xế tải ảnh và video lên, rồi cho nhân viên và khách hàng tải về. Với
adapter `noop`, một tệp nhiễm mã độc sẽ đi trọn vòng đó mà không gặp cản trở nào.

Kiểm tra định dạng bằng magic bytes (`src/modules/media/file-types.ts`) chặn được tệp giả
mạo đuôi, nhưng **không** phát hiện được mã độc trong một tệp JPEG hợp lệ về mặt cấu trúc.

Chuyển sang `VIRUS_SCAN_PROVIDER=http` và trỏ tới dịch vụ quét thật trước khi mở tính năng
tải tệp cho người dùng ngoài.

### 8.2. Lưu trữ tệp

`STORAGE_PROVIDER=local` ghi vào đĩa của chính máy chủ ứng dụng. Hệ quả: không chia sẻ
được giữa nhiều instance, và mất máy chủ là mất toàn bộ ảnh bằng chứng giao hàng. Chuyển
sang `s3` với backup riêng cho bucket.

### 8.3. Email và SMS

`console` chỉ in ra log. Khách hàng sẽ không nhận được email xác minh, không đặt lại được
mật khẩu, không nhận thông báo trạng thái chuyến. Cấu hình SMTP thật và nhà cung cấp SMS.

### 8.4. Rate limit

`memory` đếm trong RAM của một tiến trình: khởi động lại là mất, và nhiều instance thì mỗi
instance có bộ đếm riêng. Với hệ thống một tiến trình thì tạm chấp nhận được; nhiều
instance thì phải chuyển sang `redis`.

### 8.5. MFA cho vai trò quyền cao

`REQUIRE_STAFF_MFA` tồn tại nhưng **chưa có triển khai MFA**. Hiện tại tài khoản ADMIN và
SUPER_ADMIN không ghi nhận được thanh toán do quy tắc yêu cầu xác thực lại (`§30.2`).
ACCOUNTANT hoạt động bình thường. Xem `security.md`.

### 8.6. Backup

Chưa có gì tự động. Xem `backup-restore.md` và dựng trước khi có dữ liệu thật.

### 8.7. Giám sát

`ERROR_MONITORING_DSN` để trống. Không có cảnh báo khi hệ thống lỗi — sự cố chỉ được phát
hiện khi có người báo.

---

## 9. Kiểm tra sau khi triển khai

```bash
curl -fsS https://tenmien.vn/api/health/ready          # {"status":"ok",...}
curl -sI  https://tenmien.vn | grep -i strict-transport # phải có HSTS
curl -sI  https://tenmien.vn | grep -i content-security # phải có CSP
```

Rồi kiểm bằng trình duyệt:

1. Trang chủ hiện đúng, mở DevTools Console không có lỗi CSP.
2. Đăng nhập được bằng một tài khoản thật.
3. Gửi thử một yêu cầu báo giá từ form công khai, kiểm tra nó xuất hiện trong
   `/quan-tri/yeu-cau`.
4. Tra cứu một mã vận đơn ở `/tra-cuu`.

Nếu bước 1 báo lỗi CSP, gần như chắc chắn nguyên nhân là proxy đang đặt trùng header — xem
§5.
