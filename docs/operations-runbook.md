# Sổ tay vận hành

Việc cần làm khi hệ thống đang chạy — và khi nó không chạy.

Xem thêm: [`deployment.md`](deployment.md) để đưa lên máy chủ,
[`backup-restore.md`](backup-restore.md) khi cần khôi phục dữ liệu.

---

## 1. Kiểm tra nhanh tình trạng

```bash
curl -fsS https://tenmien.vn/api/health/ready
```

| Phản hồi | Nghĩa là | Làm gì |
|---|---|---|
| `200 {"status":"ok"}` | Bình thường | Không |
| `200 {"status":"degraded"}` | Có phụ thuộc chậm hoặc phụ trợ hỏng | Xem §5 |
| `503 {"status":"down"}` | Database không truy cập được | Xem §4 |
| Không phản hồi | Tiến trình chết hoặc proxy hỏng | Xem §3 |

Trường `checks[].durationMs` cho biết truy vấn database mất bao lâu. Bình thường dưới
50 ms. Trên 1000 ms sẽ tự chuyển sang `degraded`.

---

## 2. Job định kỳ

Ba job, định nghĩa trong `src/modules/scheduler/schedule.ts`:

| Job | Chu kỳ | Làm gì | Hậu quả nếu ngừng chạy |
|---|---|---|---|
| `outbox` | 60 giây | Gửi email/SMS đang chờ | Khách không nhận được thông báo nào |
| `purge-locations` | 6 giờ | Xoá điểm vị trí quá hạn lưu trữ | Vi phạm cam kết lưu trữ dữ liệu vị trí |
| `cleanup-media` | 6 giờ | Dọn tệp tải lên bỏ dở | Đĩa đầy dần |

### Kiểm tra bộ lập lịch có đang chạy không

```bash
journalctl -u vantai --since "10 minutes ago" | grep '"Job xong"'
```

Không thấy dòng nào trong 10 phút là **bất thường** — `outbox` phải chạy mỗi phút.

Nguyên nhân thường gặp, theo thứ tự xác suất:

1. `SCHEDULER_ENABLED` không phải `"true"`. Kiểm tra bằng cách tìm dòng log lúc khởi động:
   `SCHEDULER_ENABLED=false — job định kỳ không tự chạy`.
2. Đang dùng cron bên ngoài và cron đó hỏng. Kiểm tra `journalctl -u cron`.
3. Job trước treo. Nếu một job chạy quá lâu, lượt sau bị bỏ qua có chủ đích để không chạy
   chồng. Tìm dòng `Bỏ lượt: job trước chưa xong`.

### Chạy tay một job

```bash
curl -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" \
  -H "content-type: application/json" \
  -d '{"job":"outbox"}'
```

Tên job hợp lệ: `outbox`, `purge-locations`, `cleanup-media`. Bỏ `-d` để chạy tất cả job
đã đến hạn.

### ⚠️ Chạy nhiều instance

Nếu chạy nhiều instance sau cân bằng tải, `SCHEDULER_ENABLED` phải là `false` ở **tất cả**.
Bật ở nhiều instance nghĩa là mỗi instance chạy job riêng. Worker outbox có cơ chế claim
bằng `updateMany` nên khách sẽ không nhận thông báo trùng, nhưng các job dọn dẹp sẽ chạy
song song và phí kết nối database.

---

## 3. Ứng dụng không phản hồi

```bash
systemctl status vantai
journalctl -u vantai -n 200 --no-pager
```

**Tiến trình đã chết:**

```bash
systemctl restart vantai
```

Rồi tìm nguyên nhân trong log ngay trước thời điểm chết. Hai nguyên nhân hay gặp:

- `Thiếu biến môi trường` — có người sửa `.env` rồi restart. Đối chiếu với `.env.example`.
- Hết bộ nhớ. `dmesg | grep -i "killed process"` sẽ thấy nếu là OOM killer.

**Tiến trình còn sống nhưng không trả lời:** kiểm tra ứng dụng trực tiếp, bỏ qua proxy:

```bash
curl -fsS http://127.0.0.1:3000/api/health/live
```

Trả lời được nghĩa là lỗi nằm ở nginx, không phải ở ứng dụng.

---

## 4. Database không truy cập được

`/api/health/ready` trả `503` với `checks[0].status === "down"`.

> Endpoint này **không** trả nội dung lỗi — có chủ đích, vì thông báo lỗi của Prisma chứa
> host, cổng và tên người dùng database. Chi tiết nằm trong log máy chủ.

```bash
journalctl -u vantai -n 100 | grep -i "readiness probe"
systemctl status postgresql
psql "$DATABASE_URL" -c 'SELECT 1'
```

**PostgreSQL đã dừng:** `systemctl restart postgresql`.

**PostgreSQL chạy nhưng từ chối kết nối:** thường là hết connection slot.

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
SHOW max_connections;
```

Nếu `idle` chiếm phần lớn, nguyên nhân là ứng dụng khởi động lại nhiều lần và kết nối cũ
chưa đóng. Restart ứng dụng sẽ giải phóng.

---

## 5. Thông báo không đến tay khách

Đây là sự cố hay gặp nhất trong vận hành hằng ngày. Kiểm tra theo thứ tự — dừng ở bước đầu
tiên sai.

### Bước 1 — nhà cung cấp email có phải là bản giả không?

```bash
grep EMAIL_PROVIDER .env
```

`console` nghĩa là email chỉ được **in ra log**, không gửi đi đâu. Đây là mặc định lúc
phát triển. Xem `deployment.md` §8.3.

### Bước 2 — outbox có đang chạy không?

Xem §2.

### Bước 3 — bản ghi đang ở trạng thái nào?

```sql
SELECT status, count(*) FROM outbox_events GROUP BY status;
```

| Trạng thái | Nghĩa | Xử lý |
|---|---|---|
| `PENDING` | Chờ tới lượt | Bình thường nếu số lượng nhỏ |
| `PROCESSING` | Đang gửi | Kẹt quá 15 phút sẽ tự được thả ra |
| `SENT` | Xong | — |
| `FAILED` | Lỗi tạm thời, sẽ thử lại | Xem `attempts` và `nextAttemptAt` |
| `DEAD_LETTER` | Hết số lần thử | Cần người xem, xem §6 |

`PENDING` tăng liên tục nghĩa là worker không chạy. `FAILED` tăng liên tục nghĩa là worker
chạy nhưng nhà cung cấp từ chối — kiểm tra thông tin đăng nhập SMTP.

---

## 6. Xử lý dead letter

Bản ghi vào `DEAD_LETTER` sau khi hết số lần thử lại. Đây là **thông báo đã mất**: khách
sẽ không nhận được, và hệ thống sẽ không tự thử lại nữa.

```sql
SELECT id, "eventKey", attempts, "lastError", "createdAt"
FROM outbox_events
WHERE status = 'DEAD_LETTER'
ORDER BY "createdAt" DESC
LIMIT 20;
```

> Chưa có giao diện quản trị cho dead letter. Hàm `listDeadLetters()` và
> `requeueDeadLetter()` đã có trong `src/modules/notifications/worker.ts` nhưng chưa được
> nối vào màn hình nào. Hiện phải thao tác bằng SQL.

Đưa lại vào hàng đợi sau khi đã sửa nguyên nhân:

```sql
UPDATE outbox_events
SET status = 'PENDING', attempts = 0, "nextAttemptAt" = now()
WHERE id = '...';
```

Chỉ làm việc này **sau khi** đã sửa nguyên nhân gốc. Đưa lại vào hàng đợi khi SMTP vẫn
hỏng chỉ làm nó rơi vào dead letter lần nữa.

---

## 7. Đĩa đầy

```bash
df -h
du -sh /opt/vantai/.storage/*    # với STORAGE_PROVIDER=local
```

Chạy dọn media trước khi xoá tay bất cứ thứ gì:

```bash
curl -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" \
  -d '{"job":"cleanup-media"}'
```

Phản hồi cho biết đã dọn được bao nhiêu. `storageFailures > 0` nghĩa là có tệp không xoá
được — thường do quyền thư mục.

**Không xoá tệp trong thư mục storage bằng tay.** Bản ghi trong database sẽ trỏ tới tệp
không còn tồn tại, và màn hình bằng chứng giao hàng sẽ báo lỗi thay vì hiện ảnh.

---

## 8. Có người báo không truy cập được màn hình của mình

Trước khi coi là lỗi phân quyền, kiểm tra ba thứ theo thứ tự:

1. **Tài khoản có đúng vai trò không?** Xem `roles-permissions.md`.
2. **Tài xế có đang được phân công chuyến đó không?** Tài xế chỉ thấy chuyến mình được
   phân. Không phải lỗi.
3. **Chuyến đã kết thúc chưa?** Chuyến ở trạng thái `COMPLETED`, `CANCELLED` hoặc `FAILED`
   thì tài xế không cập nhật được nữa, kể cả khi vẫn là người được phân công. Thông báo là
   *"Chuyến đã khép lại. Liên hệ điều phối nếu cần bổ sung thông tin."* Đây là hành vi
   đúng theo thiết kế; điều phối viên xử lý phần bổ sung.

Nếu khách hàng nhận `404` cho một mã vận đơn có thật, đó cũng là hành vi đúng: hệ thống trả
`404` thay vì `403` khi truy cập chéo giữa các khách hàng, để không xác nhận mã đó tồn tại.

---

## 9. Việc định kỳ của người vận hành

| Tần suất | Việc |
|---|---|
| Hằng ngày | Xem `SELECT count(*) FROM outbox_events WHERE status = 'DEAD_LETTER'` |
| Hằng tuần | Kiểm tra backup khôi phục được (`backup-restore.md` §4) |
| Hằng tuần | `df -h` — dung lượng đĩa |
| Hằng tháng | `pnpm audit` — lỗ hổng phụ thuộc |
| Hằng quý | Rà soát danh sách tài khoản nhân viên, khoá tài khoản người đã nghỉ |

---

## 10. Những gì hệ thống **không** tự làm

Ghi ra để không ai tưởng nhầm là có:

- **Không có cảnh báo.** `ERROR_MONITORING_DSN` để trống. Không ai được báo khi hệ thống
  lỗi — trừ khi có người ngồi xem log.
- **Không có backup tự động.** Xem `backup-restore.md`.
- **Không tự dọn `AuditLog`.** `AUDIT_RETENTION_DAYS` tồn tại nhưng chưa có job dọn. Bảng
  này chỉ tăng.
- **Không có metric.** Không có Prometheus endpoint, không có dashboard.
- **Không tự khởi động lại khi treo.** `Restart=always` của systemd chỉ xử lý trường hợp
  tiến trình chết, không xử lý trường hợp tiến trình còn sống nhưng không phản hồi.
