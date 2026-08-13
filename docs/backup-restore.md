# Sao lưu và khôi phục

> **Trạng thái hiện tại: chưa có backup nào được cấu hình.** Tài liệu này mô tả cách dựng.
> Đọc xong mà không làm thì hệ thống vẫn không có backup.

---

## 1. Cần sao lưu những gì

| Đối tượng | Mất thì sao | Khôi phục được từ chỗ khác không |
|---|---|---|
| **PostgreSQL** | Mất toàn bộ đơn hàng, khách hàng, hoá đơn, nhật ký | Không |
| **Tệp media** | Mất ảnh và video bằng chứng giao hàng | Không |
| `.env` | Không đăng nhập lại được (mất `BETTER_AUTH_SECRET`) | Không |
| Mã nguồn | — | Có, từ git |
| `node_modules`, `.next` | — | Có, build lại |

Hai dòng đầu là thứ thật sự quan trọng. Ảnh bằng chứng giao hàng có giá trị pháp lý khi
tranh chấp với khách — mất là không có gì thay thế.

`.env` cần được cất riêng, **không** để chung với backup database. Mất
`BETTER_AUTH_SECRET` sẽ làm toàn bộ phiên đăng nhập hiện có mất hiệu lực; lộ nó thì người
khác giả mạo được phiên và gọi được endpoint nội bộ.

---

## 2. Sao lưu database

### Dump hằng ngày

```bash
#!/usr/bin/env bash
# /opt/vantai/bin/backup-db.sh
set -euo pipefail

BACKUP_DIR=/var/backups/vantai
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

# --format=custom cho phép khôi phục chọn lọc từng bảng và tự nén.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="$BACKUP_DIR/vantai-$STAMP.dump"

# Giữ 30 bản gần nhất.
ls -1t "$BACKUP_DIR"/vantai-*.dump | tail -n +31 | xargs -r rm --
```

```
# crontab
0 2 * * * /opt/vantai/bin/backup-db.sh >> /var/log/vantai-backup.log 2>&1
```

**Chép ra khỏi máy chủ.** Backup nằm cùng máy với database không bảo vệ được trước hỏng
đĩa hay mất máy chủ — đó lại chính là hai tình huống cần backup nhất.

```bash
rclone copy "$BACKUP_DIR" remote:vantai-backups --max-age 25h
```

### Point-in-time recovery

Dump hằng ngày nghĩa là trường hợp xấu nhất mất tới 24 giờ dữ liệu. Với hệ thống có hoá
đơn và bằng chứng giao hàng, con số đó thường không chấp nhận được.

Bật WAL archiving trong `postgresql.conf`:

```
wal_level = replica
archive_mode = on
archive_command = 'rclone copyto %p remote:vantai-wal/%f'
```

Cách này cho phép khôi phục về **bất kỳ thời điểm nào**, không chỉ về mốc dump gần nhất.
Đổi lại phải lưu trữ nhiều hơn và cấu hình phức tạp hơn.

---

## 3. Sao lưu tệp media

### Với `STORAGE_PROVIDER=local`

Tệp nằm trong thư mục storage của ứng dụng.

```bash
rclone sync /opt/vantai/.storage remote:vantai-media
```

`sync` phản chiếu cả việc xoá. Nếu muốn tệp đã xoá vẫn còn trong backup, dùng `copy` kèm
chính sách phiên bản ở phía lưu trữ đích.

### Với `STORAGE_PROVIDER=s3`

Bật versioning cho bucket và cấu hình sao chép chéo vùng. Đừng dựa vào bản thân S3 là đủ:
versioning bảo vệ trước xoá nhầm, không bảo vệ trước việc xoá cả bucket.

### Thứ tự quan trọng

Sao lưu **database trước, media sau**.

Database chứa bản ghi trỏ tới tệp. Nếu sao lưu media trước rồi database sau, một tệp được
tải lên giữa hai thời điểm đó sẽ có bản ghi trong database nhưng không có tệp trong backup
— màn hình bằng chứng giao hàng sẽ báo lỗi. Làm ngược lại thì trường hợp xấu nhất là có
tệp thừa không ai trỏ tới, và job `cleanup-media` sẽ dọn.

---

## 4. Kiểm tra backup khôi phục được

**Backup chưa từng khôi phục thử không phải là backup.** Làm việc này hằng tuần.

```bash
createdb vantai_test
pg_restore --dbname=vantai_test --no-owner /var/backups/vantai/vantai-YYYYMMDD-HHMMSS.dump

psql -d vantai_test -c 'SELECT count(*) FROM shipments;'
psql -d vantai_test -c 'SELECT count(*) FROM invoices;'
psql -d vantai_test -c 'SELECT max("createdAt") FROM audit_logs;'

dropdb vantai_test
```

Dòng cuối cho biết backup mới tới thời điểm nào. Nếu nó cũ hơn dự kiến, cron đã hỏng từ
trước mà không ai biết.

---

## 5. Khôi phục

### 5.1. Khôi phục toàn bộ

```bash
# 1. Dừng ứng dụng TRƯỚC. Khôi phục khi ứng dụng đang ghi sẽ ra dữ liệu lẫn lộn.
systemctl stop vantai

# 2. Giữ lại database hiện tại thay vì xoá — nó có thể còn dữ liệu cứu được.
psql -c 'ALTER DATABASE vantai RENAME TO vantai_hong;'
createdb vantai
psql -d vantai -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'

# 3. Khôi phục.
pg_restore --dbname=vantai --no-owner /var/backups/vantai/vantai-YYYYMMDD-HHMMSS.dump

# 4. Media.
rclone sync remote:vantai-media /opt/vantai/.storage

# 5. Áp migration mới hơn thời điểm backup, nếu có.
cd /opt/vantai && pnpm db:deploy

# 6. Chạy lại.
systemctl start vantai
curl -fsS https://tenmien.vn/api/health/ready
```

Bước 2 quan trọng: **đừng `dropdb`**. Database hỏng vẫn có thể chứa các giao dịch xảy ra
sau thời điểm backup, và đó có thể là những đơn hàng cần đối chiếu bằng tay.

Bước 5 cũng vậy — nếu có migration chạy sau thời điểm backup, schema trong bản dump sẽ cũ
hơn mã nguồn đang triển khai.

### 5.2. Khôi phục một bảng

Ví dụ khi ai đó xoá nhầm dữ liệu ở một bảng:

```bash
pg_restore --dbname=vantai --table=vehicles --data-only --no-owner backup.dump
```

Cẩn thận với khoá ngoại. `--data-only` không tắt ràng buộc, nên chèn lại dữ liệu tham chiếu
tới bản ghi không còn tồn tại sẽ thất bại. Trong trường hợp đó, khôi phục vào database tạm
rồi chép sang bằng SQL.

---

## 6. Thời gian chấp nhận được

Hai con số cần doanh nghiệp quyết định, và chúng quyết định luôn cách làm backup:

| Chỉ số | Câu hỏi | Cần doanh nghiệp cập nhật |
|---|---|---|
| RPO | Chấp nhận mất tối đa bao nhiêu dữ liệu? | — |
| RTO | Chấp nhận ngừng phục vụ tối đa bao lâu? | — |

Với cấu hình chỉ dump hằng ngày ở §2, RPO là **24 giờ** và RTO khoảng **30–60 phút** cho
database cỡ vừa. Nếu doanh nghiệp cần RPO ngắn hơn, phải bật WAL archiving.

Đừng ghi hai con số này vào hợp đồng hay cam kết dịch vụ trước khi đã đo bằng một lần khôi
phục thử thật.

---

## 7. Chưa làm

- Chưa có script backup nào được cài đặt trên máy chủ.
- Chưa bật WAL archiving.
- Chưa có nơi lưu trữ ngoài máy chủ.
- Chưa có lịch kiểm tra khôi phục.
- Chưa quyết định RPO/RTO.
- Chưa có quy trình cất giữ `BETTER_AUTH_SECRET` (nên dùng trình quản lý bí mật, không để
  trong backup thông thường).
