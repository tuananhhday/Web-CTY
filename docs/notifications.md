# Thông báo

Cách hệ thống gửi email và SMS cho khách hàng và tài xế.

---

## 1. Vấn đề cần giải

Đổi trạng thái chuyến hàng, rồi gửi email cho khách. Hai cách làm ngây thơ đều sai:

**Gửi trong cùng transaction** — SMTP chậm sẽ giữ transaction mở, và SMTP lỗi sẽ rollback
cả việc đổi trạng thái. Chuyến hàng thật sự đã giao xong nhưng hệ thống ghi là chưa, chỉ vì
máy chủ mail hắt hơi.

**Gửi ngay sau khi commit** — tiến trình chết giữa hai bước là mất thông báo, không dấu vết.

## 2. Cách giải: mẫu outbox

```
┌─ Transaction ──────────────────────────────────┐
│  UPDATE shipments SET status = 'COMPLETED'     │
│  INSERT INTO audit_logs   …                    │
│  INSERT INTO outbox_events …                   │
└────────────────────────────────────────────────┘
                      │
                      ▼  (worker, mỗi 60 giây)
        claim → dựng nội dung → gửi → SENT
                      │
                      └── lỗi → phân loại → backoff → thử lại → DEAD_LETTER
```

Sự kiện được ghi **cùng transaction** với thay đổi nghiệp vụ. Hoặc cả hai cùng thành công,
hoặc cả hai cùng không. Không có khe hở.

Bảng `OutboxEvent` đóng vai hàng đợi. Không cần RabbitMQ hay SQS ở quy mô này — PostgreSQL
đã có sẵn transaction, và đó chính là thứ cần.

---

## 3. Trạng thái của một sự kiện

| Trạng thái | Nghĩa | Tự chuyển tiếp |
|---|---|---|
| `PENDING` | Chờ tới lượt | Có |
| `PROCESSING` | Worker đang xử lý | Có — kẹt quá 15 phút được thả về `PENDING` |
| `SENT` | Đã gửi | Trạng thái cuối |
| `FAILED` | Lỗi tạm thời, còn lượt thử | Có, sau `nextAttemptAt` |
| `DEAD_LETTER` | Hết lượt thử | **Không** — cần người can thiệp |

`PROCESSING` kẹt quá 15 phút được thả ra để xử lý trường hợp tiến trình chết giữa lúc đang
gửi. Không có cơ chế này, một lần restart không đúng lúc sẽ khiến sự kiện đó kẹt vĩnh viễn.

---

## 4. Claim: chống gửi trùng

Worker lấy việc bằng `updateMany` kèm điều kiện trạng thái, không phải `findMany` rồi
`update`:

```ts
await db.outboxEvent.updateMany({
  where: { id: { in: candidateIds }, status: "PENDING" },  // ← điều kiện quan trọng
  data: { status: "PROCESSING" },
});
```

`status: "PENDING"` trong `where` là điểm mấu chốt. Hai worker cùng nhắm một bản ghi thì
chỉ một cái `updateMany` khớp; cái kia trả về `count: 0` và bỏ qua.

Nhờ vậy chạy nhiều instance vẫn an toàn, dù không khuyến khích — xem
[`operations-runbook.md`](operations-runbook.md) §2.

---

## 5. Thử lại

`src/modules/notifications/retry.ts` — module thuần, không chạm database.

### Giãn cách luỹ thừa có nhiễu

```
Lần thử 1 lỗi → chờ ~30 giây
Lần thử 2 lỗi → chờ ~60 giây
Lần thử 3 lỗi → chờ ~2 phút
Lần thử 4 lỗi → chờ ~4 phút
…
                 trần 1 giờ
```

Trần 1 giờ vì thông báo chờ lâu hơn thế thì mất hết giá trị thời sự — báo cho khách rằng
hàng "sắp tới nơi" sau khi đã tới nơi hai tiếng là vô nghĩa.

Nhiễu ±20% để nhiều sự kiện cùng lỗi một lúc (SMTP sập) không thử lại đồng loạt, tạo thành
đợt tải dồn khi dịch vụ vừa hồi phục.

### Lỗi tạm thời và lỗi vĩnh viễn

`classifyFailure()` phân biệt hai loại. Gửi lại email tới một địa chỉ sai định dạng 5 lần
thì cũng sai 5 lần — chỉ tốn thời gian và che khuất lỗi thật.

Danh sách lỗi vĩnh viễn là **allowlist**: chỉ những mẫu chắc chắn không tự khỏi. Mọi lỗi
khác mặc định coi là tạm thời. Thà thử lại thừa còn hơn vứt bỏ một thông báo đáng lẽ gửi
được.

### Dead letter

Hết lượt thử thì chuyển `DEAD_LETTER` và **dừng hẳn**. Đây là thông báo đã mất: khách sẽ
không nhận được, và hệ thống sẽ không tự thử lại nữa.

Cách xử lý: [`operations-runbook.md`](operations-runbook.md) §6.

> Chưa có giao diện quản trị cho dead letter. `listDeadLetters()` và `requeueDeadLetter()`
> đã có trong `src/modules/notifications/worker.ts` nhưng chưa nối vào màn hình nào. Hiện
> phải thao tác bằng SQL.

---

## 6. Danh mục nội dung

`src/modules/notifications/catalog.ts` ánh xạ từ khoá sự kiện sang nội dung thật.

Khoá sự kiện hiện có:

| Nhóm | Khoá |
|---|---|
| Yêu cầu | `request.submitted` |
| Báo giá | `quote.sent`, `quote.revised`, `quote.expiring`, `quote.accepted`, `quote.declined` |
| Chuyến | `shipment.created`, `shipment.confirmed`, `shipment.completed`, `shipment.incident`, `shipment.failed`, `shipment.cancelled` |
| Hỗ trợ | `ticket.replied`, `ticket.resolved` |

`buildNotification()` **ném lỗi** `UnknownEventError` với khoá không có trong danh mục,
thay vì gửi một email trống. Sự kiện chưa khai báo là lỗi lập trình, phải lộ ra ngay.

Vài khoá trả về `null` có chủ đích (`quote.accepted`, `quote.declined`) — chúng được ghi
vào outbox để phục vụ nhật ký nhưng không sinh thông báo nào gửi đi.

---

## 7. Liên kết theo đối tượng nhận

Một sự kiện có thể gửi cho nhiều nhóm người. Cùng một chuyến hàng, nhưng khách và tài xế
phải được dẫn tới **hai màn hình khác nhau**:

```ts
linkUrl: {
  CUSTOMER: `/tai-khoan/don-hang/${code}`,
  DRIVER:   `/tai-xe/chuyen/${code}`,
}
```

Trước khi có cấu trúc này, tài xế nhận thông báo "Đã phân công tài xế" kèm liên kết tới
`/tai-khoan/don-hang/...` — một màn hình họ không có quyền vào. Bấm vào là 403 hoặc 404.

Kiểu là `Partial<Record<Audience, string>>`: sự kiện chỉ gửi cho khách thì chỉ khai báo
`CUSTOMER`. Worker giữ nguyên `audience` của từng người nhận khi dựng nội dung.

Hai nhóm nhận hiện có: `CUSTOMER` và `DRIVER`. Nhân viên nội bộ dùng màn hình quản trị,
không nhận thông báo qua email.

---

## 8. Kênh gửi

| Kênh | Interface | Mặc định | Bản thật |
|---|---|---|---|
| Email | `EmailProvider` | `console` — in ra log | `smtp` |
| SMS | `SmsProvider` | `console` | `http` |
| Zalo OA | — | `none` | Chưa triển khai |

> **`console` không gửi gì cả.** Đây là mặc định lúc phát triển. Với cấu hình này, khách
> hàng sẽ không nhận được email xác minh, không đặt lại được mật khẩu, và không nhận được
> thông báo trạng thái nào. Xem [`deployment.md`](deployment.md) §8.3.

---

## 9. Chạy worker

Tự động, nếu `SCHEDULER_ENABLED=true` — mỗi 60 giây.

Chạy tay:

```bash
curl -X POST https://tenmien.vn/api/internal/outbox/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET"
```

```json
{ "claimed": 5, "sent": 4, "failed": 1, "deadLettered": 0, "skipped": 0 }
```

| Trường | Nghĩa |
|---|---|
| `claimed` | Số bản ghi lấy được trong lượt này |
| `sent` | Gửi thành công |
| `failed` | Lỗi tạm thời, sẽ thử lại |
| `deadLettered` | Hết lượt thử |
| `skipped` | Có trong danh sách nhưng worker khác đã claim |

---

## 10. Chưa có

- Giao diện quản trị cho dead letter.
- Thông báo trong ứng dụng cho nhân viên (chỉ có email/SMS cho khách và tài xế).
- Zalo OA.
- Cho phép người dùng tự chọn nhận hay không nhận từng loại thông báo.
- Dọn `OutboxEvent` đã `SENT`. Bảng này chỉ tăng.
