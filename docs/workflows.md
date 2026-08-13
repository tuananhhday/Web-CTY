# Quy trình nghiệp vụ

Vòng đời của từng đối tượng trong hệ thống, và quy tắc chuyển trạng thái.

Mỗi quy trình có một file `state-machine.ts` là nguồn duy nhất. Các file đó không import
gì — không Prisma, không React — nên đọc được như một bản đặc tả và kiểm thử được đầy đủ.

---

## 1. Từ yêu cầu tới hoá đơn — nhìn tổng thể

```
Khách gửi form          Nhân viên lập        Khách chấp nhận      Điều phối phân xe
 ServiceRequest    →       Quote        →        Quote        →      Shipment
                                                                        │
                                             Tài xế thực hiện ──────────┤
                                                                        │
                                        Bằng chứng giao hàng ───────────┤
                                                                        ▼
                                                                     Invoice
```

Không bước nào bị bỏ qua được. Không tạo được `Shipment` nếu không có `Quote` đã chốt;
không tạo được `Quote` nếu không có `ServiceRequest`.

---

## 2. Yêu cầu dịch vụ

`src/modules/service-requests/state-machine.ts` — 11 trạng thái.

```
        DRAFT
          │
          ▼
      SUBMITTED ──────────────► CANCELLED   (khách tự huỷ)
          │
          ▼
     UNDER_REVIEW ◄──┐
       │    │        │
       │    ▼        │
       │  NEED_MORE_INFO   (thiếu thông tin, chờ khách bổ sung)
       │
       ├──► REJECTED       (không nhận đơn)
       ├──► EXPIRED        (quá hạn không phản hồi)
       │
       ▼
      QUOTED ──► NEGOTIATING ──► ACCEPTED ──► CONVERTED_TO_SHIPMENT
```

Yêu cầu từ form công khai bắt đầu ở `SUBMITTED`, không phải `DRAFT`. `DRAFT` dành cho
trường hợp nhân viên nhập hộ qua điện thoại.

---

## 3. Báo giá

`src/modules/quotes/state-machine.ts` — 9 trạng thái.

```
      DRAFT
        │
        ├──────────────────┐
        ▼                  │  (dưới ngưỡng, không cần duyệt)
  PENDING_APPROVAL         │
        │                  │
        ▼                  ▼
       SENT ◄──────────────┘
        │
        ▼
      VIEWED ──► NEGOTIATING
        │              │
        ├──────────────┤
        ▼              ▼
    ACCEPTED       DECLINED
                   EXPIRED
                   CANCELLED
```

### Ngưỡng duyệt

Báo giá vượt ngưỡng giá trị hoặc vượt mức chiết khấu cho phép phải qua `PENDING_APPROVAL`.
Ngưỡng nằm trong `src/modules/quotes/thresholds.ts`.

Người lập báo giá **không** tự duyệt được báo giá của mình. Cần quyền `quote.approve`.

### Tính tiền

`src/modules/quotes/pricing.ts`, dùng `Decimal.js`. Không dùng `Number` ở bất kỳ đâu trong
đường đi của tiền — xem [`architecture.md`](architecture.md) §8.

### `ACCEPTED` là điểm không quay lại

Khách chấp nhận rồi thì báo giá không sửa được nữa. Cần thay đổi thì lập báo giá mới.

---

## 4. Chuyến hàng

`src/modules/shipments/state-machine.ts` — **19 trạng thái**. Nhiều, vì nghiệp vụ chuyển
nhà có nhiều mốc mà khách thực sự hỏi tới ("đã đóng gói xong chưa?").

### Luồng chính

```
CREATED → CONFIRMED → SCHEDULED → DRIVER_ASSIGNED
                                        │
                                        ▼
                             EN_ROUTE_TO_PICKUP
                                        │
                                        ▼
                                   AT_PICKUP
                                        │
                                        ▼
                             PICKUP_INSPECTION      (kiểm đếm, chụp ảnh)
                                        │
                                        ▼
                                    PACKING          (chỉ với chuyển nhà)
                                        │
                                        ▼
                                    LOADING
                                        │
                                        ▼
                              SECURED_ON_VEHICLE     (chốt hàng đã cố định)
                                        │
                                        ▼
                                   IN_TRANSIT
                                        │
                                        ▼
                                  AT_DELIVERY
                                        │
                                        ▼
                                   UNLOADING
                                        │
                                        ▼
                    DELIVERED_PENDING_CONFIRMATION   (chờ khách xác nhận)
                                        │
                                        ▼
                                   COMPLETED
```

### Trạng thái rẽ nhánh

| Trạng thái | Vào từ đâu | Ra được không |
|---|---|---|
| `ON_HOLD` | Gần như bất kỳ đâu | Có, quay lại trạng thái trước |
| `INCIDENT` | Khi có sự cố nghiêm trọng | Có, sau khi xử lý |
| `FAILED` | Giao không thành | Không — trạng thái cuối |
| `CANCELLED` | Trước khi bắt đầu | Không — trạng thái cuối |

### Điều kiện bắt buộc trước khi chuyển

`checkStatusPreconditions()` chặn một số chuyển tiếp nếu chưa đủ dữ liệu. Ví dụ: không
chuyển sang `COMPLETED` nếu chưa có bằng chứng giao hàng.

Một số trạng thái bắt buộc phải có **mã lý do** — xem `REASON_CODE_REQUIRED_STATUSES`.
Không cho phép chuyển sang `FAILED` mà không nói vì sao.

### Ai đổi được trạng thái

| Người | Được làm gì |
|---|---|
| Điều phối viên | Mọi chuyển tiếp |
| Tài xế | Chỉ các mốc trong hành trình của mình, và chỉ khi chuyến **chưa khép lại** |
| Khách hàng | Không đổi trạng thái. Chỉ xác nhận đã nhận hàng. |

> Quyền của tài xế **không** phụ thuộc khung giờ phân công — chuyến chạy trễ là bình
> thường. Ranh giới là trạng thái chuyến. Xem [`security.md`](security.md) §3.

---

## 5. Phân công xe và tài xế

Một `Assignment` gắn một chuyến với một xe, một tài xế chính và (tuỳ chọn) một tài xế phụ,
trong một khoảng thời gian.

### Chống trùng lịch — ba lớp

| Lớp | Cơ chế | Chặn được gì |
|---|---|---|
| Giao diện | `previewConflictsAction` gọi trước khi gửi | Cảnh báo sớm, không phải rào chắn |
| Ứng dụng | `findConflicts()` | Phần lớn trường hợp |
| Database | Ràng buộc exclusion, `btree_gist` | Cả trường hợp hai người bấm cùng lúc |

Lớp database là lớp duy nhất không lách được. Hai lớp trên tồn tại vì thông báo lỗi của
PostgreSQL không đọc được với người dùng.

### Phân công lại

Khi sửa một phân công đã có (ví dụ kéo dài khung giờ), hệ thống **loại chính chuyến đó ra**
khỏi phép kiểm tra trùng lịch (`excludeShipmentId`).

Trước khi có tham số này, điều phối viên kéo dài khung giờ sẽ bị báo là trùng với chính
mình, buộc phải tích "ghi đè" — và hệ thống ghi vào `AuditLog` một lần ghi đè không có
thật. Nhật ký kiểm toán ghi sai còn tệ hơn không ghi.

### Ghi đè có chủ đích

Điều phối viên **có** quyền ghi đè cảnh báo trùng lịch thật (ví dụ hai chuyến ngắn gần
nhau). Khi đó bắt buộc nhập lý do, và việc ghi đè được ghi vào `AuditLog`.

---

## 6. Bằng chứng giao hàng

`src/modules/proof-of-delivery/`

```
Tài xế tới nơi
      │
      ├── Chụp ảnh hàng đã giao        → ShipmentMedia
      ├── Ghi tên người nhận
      └── Xác thực bằng OTP
              │
              ▼
      Hệ thống gửi OTP tới số điện thoại người nhận
              │
              ▼
      Người nhận đọc mã, tài xế nhập
              │
              ▼
      ProofOfDelivery được tạo
              │
              ▼
      Chuyến chuyển sang DELIVERED_PENDING_CONFIRMATION
```

### OTP

`src/modules/proof-of-delivery/otp.ts`:

- Sinh bằng `crypto.randomInt`, không phải `Math.random`.
- Lưu dưới dạng băm SHA-256 có muối theo `shipmentId`. Không lưu mã gốc.
- Khi kiểm tra, **xét trạng thái đã dùng và hạn dùng TRƯỚC** khi so mã, và dùng phép so
  sánh chống đo thời gian.

### Chuỗi đính chính

Bằng chứng giao hàng ghi sai (nhầm tên người nhận, ảnh mờ) **không được sửa đè**. Thay vào
đó tạo một bản ghi mới trỏ về bản cũ qua `correctionOfId`, và bản cũ được đánh dấu
`supersededAt`.

Database đảm bảo mỗi chuyến chỉ có **một** bằng chứng đang hiệu lực:

```sql
CREATE UNIQUE INDEX "proof_of_deliveries_one_active_per_shipment"
  ON "proof_of_deliveries" ("shipmentId")
  WHERE "supersededAt" IS NULL;
```

và không cho một bản ghi tự đính chính chính nó:

```sql
CHECK ("correctionOfId" IS NULL OR "correctionOfId" <> "id")
```

Giữ nguyên bản gốc vì bằng chứng giao hàng là tài liệu có giá trị khi tranh chấp. Sửa đè sẽ
xoá mất chính thứ đang cần chứng minh.

---

## 7. Phiếu hỗ trợ

`src/modules/support/state-machine.ts` — 5 trạng thái.

```
   OPEN
     │
     ├──► WAITING_FOR_STAFF      (khách vừa nhắn)
     ├──► WAITING_FOR_CUSTOMER   (nhân viên vừa trả lời)
     │
     ▼
  RESOLVED ──► CLOSED
```

Trạng thái **suy ra từ hành động**, không phải người dùng tự chọn: khách gửi tin thì thành
`WAITING_FOR_STAFF`, nhân viên trả lời thì thành `WAITING_FOR_CUSTOMER`. Xem
`statusAfterMessage()`.

### Ghi chú nội bộ

Tin nhắn có `visibility`: `CUSTOMER_VISIBLE` hoặc nội bộ. Ghi chú nội bộ **không** làm đổi
trạng thái phiếu — nhân viên trao đổi với nhau không phải là đã trả lời khách.

Bộ lọc `visibility` nằm **trong câu truy vấn Prisma**, không lọc sau khi lấy về:

```ts
where: party === "STAFF" ? {} : { visibility: "CUSTOMER_VISIBLE" }
```

Lọc trong bộ nhớ nghĩa là dữ liệu nội bộ đã rời khỏi database và có thể lọt vào HTML của
trang, log, hoặc payload gỡ lỗi.

---

## 8. Sự cố

`src/modules/incidents/state-machine.ts` — 5 trạng thái.

```
   OPEN → INVESTIGATING → ACTION_REQUIRED → RESOLVED → CLOSED
```

### Mức nghiêm trọng tự suy

`defaultSeverityFor()` gán mức nghiêm trọng theo loại sự cố. Tai nạn (`ACCIDENT`) và mất
hàng (`LOSS`) **luôn** là `CRITICAL` — không để người báo tự hạ mức.

### Giữ chuyến

`shouldHoldShipment()` quyết định sự cố có làm chuyến chuyển sang `ON_HOLD` hay không. Hư
hỏng nhẹ thì không cần dừng cả chuyến; tai nạn thì có.

---

## 9. Hoá đơn và thanh toán

`src/modules/invoices/` — 6 trạng thái hoá đơn.

```
  DRAFT ──► ISSUED ──► PARTIALLY_PAID ──► PAID
              │              │
              ├──────────────┴──► OVERDUE
              │
              └──► VOID
```

### Trạng thái suy ra từ số tiền

`deriveStatus()` tính trạng thái từ số đã thu và số còn lại, chứ không để người dùng tự
đặt. Chỉ `DRAFT` và `VOID` là quyết định của con người.

**Hoá đơn đã `PAID` không huỷ được.** Muốn đảo thì phát hành hoá đơn điều chỉnh.

### Ghi nhận thanh toán hai bước

```
   recordPayment()  →  PaymentRecord ở trạng thái PENDING
                              │
                              ▼
   confirmPayment() →  CONFIRMED — số dư hoá đơn mới thay đổi
```

Tách hai bước vì người nhận tiền và người đối chiếu sao kê thường là hai người khác nhau.
**Chỉ thanh toán `CONFIRMED` mới được tính vào số đã thu.**

`recalculate()` luôn tính lại số đã thu và số dư từ các bản ghi `PaymentRecord`, không tin
vào giá trị đã lưu. Số dư âm nghĩa là khách trả thừa — không bị làm tròn về 0.

### Chiết khấu toàn hoá đơn

Chiết khấu áp cho cả hoá đơn được **phân bổ theo tỷ lệ** vào từng dòng chịu thuế, không trừ
thẳng vào tổng cuối. Trừ thẳng sẽ ra số thuế sai. Xem
`calculateInvoiceTotals()` trong `src/modules/invoices/totals.ts`.

### Không có cổng thanh toán

Hệ thống **không** tích hợp cổng thanh toán online và **không** lưu bất kỳ dữ liệu thẻ nào.
Thanh toán được ghi nhận thủ công bởi kế toán sau khi tiền về.

> Hiện ADMIN không ghi nhận được thanh toán vì quy tắc yêu cầu MFA mà MFA chưa có.
> ACCOUNTANT hoạt động bình thường. Xem [`security.md`](security.md) §2.

---

## 10. Thông báo

Mọi chuyển trạng thái đáng chú ý ghi một `OutboxEvent` **trong cùng transaction** với thay
đổi. Worker gửi sau. Chi tiết: [`notifications.md`](notifications.md).
