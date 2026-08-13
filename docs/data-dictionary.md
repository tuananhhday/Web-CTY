# Từ điển dữ liệu

74 model, nhóm theo miền nghiệp vụ. Đây là tài liệu **định hướng**: mô tả vai trò của từng
bảng và những ràng buộc không đọc được từ tên cột.

Nguồn chính xác luôn là [`prisma/schema.prisma`](../prisma/schema.prisma). Sơ đồ quan hệ:
[`database-plan.md`](database-plan.md).

---

## Quy ước chung

| Quy ước | Chi tiết |
|---|---|
| Khoá chính | `cuid()`, kiểu `String` |
| Tên bảng | `snake_case` số nhiều qua `@@map` |
| Tiền | `Decimal(18, 0)` — VND không có phần thập phân |
| Thời gian | `DateTime`, lưu UTC |
| Xoá | Phần lớn dùng trạng thái, không xoá thật |

### Vì sao `Decimal` chứ không `Float`

`0.1 + 0.2 !== 0.3` trong số thực dấu phẩy động. Với các phép cộng dồn thuế, chiết khấu và
phụ phí, sai số tích tụ tới mức hoá đơn lệch vài đồng — đủ để kế toán không đối chiếu được.

`Decimal(18, 0)`: 18 chữ số, 0 thập phân. Đủ cho mọi giá trị VND thực tế.

### Vì sao ít khi xoá thật

Đơn hàng, báo giá, hoá đơn là chứng từ. Xoá một chuyến đã giao là xoá bằng chứng. Thay vào
đó dùng trạng thái `CANCELLED`, `VOID`, `RETIRED`, `INACTIVE`.

Ngoại lệ: `LocationPing` bị **xoá thật** khi hết hạn lưu trữ — xem
[`location-privacy.md`](location-privacy.md).

---

## 1. Người dùng và xác thực

| Model | Vai trò |
|---|---|
| `User` | Tài khoản. Các trường `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` **do Better Auth quản lý** — không đổi tên |
| `UserRoleAssignment` | Gán vai trò. Một người có nhiều vai trò |
| `Account` | Better Auth: thông tin đăng nhập |
| `Session` | Better Auth: phiên |
| `Verification` | Better Auth: token xác minh email, đặt lại mật khẩu |
| `MfaCredential` | Bảng đã có, **chưa dùng** — MFA chưa triển khai |
| `UserProfile` | Thông tin bổ sung |
| `UserAddress` | Sổ địa chỉ |

Vai trò lưu ở bảng riêng chứ không phải cột trên `User`: một người vừa là tài xế vừa là
điều phối viên là chuyện có thật ở doanh nghiệp nhỏ.

Danh sách 8 vai trò và 31 quyền: [`roles-permissions.md`](roles-permissions.md).

---

## 2. Nội dung website (CMS)

| Model | Vai trò |
|---|---|
| `CompanyProfile` | Thông tin doanh nghiệp. **Mọi trường mặc định rỗng** — xem §11 |
| `Office` | Văn phòng, kho bãi |
| `ContactChannel` | Kênh liên hệ: điện thoại, email, Zalo, Facebook |
| `Service` | Danh mục dịch vụ |
| `ServiceArea` | Khu vực phục vụ |
| `Faq` | Câu hỏi thường gặp |
| `StaticPage` | Trang tĩnh: giới thiệu, chính sách |
| `SiteSection` | Khối nội dung trên trang chủ |
| `MediaAsset` | Ảnh dùng cho nội dung (khác `ShipmentMedia`) |
| `NewsCategory`, `NewsTag`, `NewsPost` | Tin tức |

Nội dung rich text đi qua `src/lib/sanitize.ts` trước khi lưu. Không tin nội dung do người
biên tập nhập — tài khoản biên tập cũng có thể bị chiếm.

---

## 3. Yêu cầu dịch vụ

| Model | Vai trò |
|---|---|
| `ServiceRequest` | Yêu cầu từ khách. 11 trạng thái |
| `RequestStop` | Điểm lấy và giao |
| `CargoItem` | Hàng hoá cần vận chuyển |
| `MovingRequestDetail` | Thông tin riêng cho chuyển nhà: tầng, thang máy, khoảng cách khiêng |
| `MovingInventoryItem` | Danh mục đồ đạc |
| `RequestAttachment` | Tệp khách gửi kèm |
| `RequestStatusEvent` | Lịch sử đổi trạng thái |

`MovingRequestDetail` tách riêng vì chuyển nhà cần thông tin mà vận chuyển hàng hoá không
có. Nhồi chung vào `ServiceRequest` sẽ tạo hàng chục cột `null` cho mọi đơn hàng thường.

---

## 4. Báo giá

| Model | Vai trò |
|---|---|
| `Quote` | Báo giá. 9 trạng thái |
| `QuoteRevision` | Ảnh chụp một phiên bản báo giá |
| `QuoteLineItem` | Dòng chi tiết |
| `QuoteMessage` | Trao đổi với khách trong quá trình thương lượng |
| `QuoteActivity` | Nhật ký: đã gửi, khách đã xem |

`QuoteRevision` giữ **ảnh chụp đầy đủ**, không phải diff. Khi khách hỏi "lần trước báo bao
nhiêu", câu trả lời phải chính xác kể cả sau khi bảng giá đã thay đổi.

---

## 5. Bảng giá

| Model | Vai trò |
|---|---|
| `PriceCatalog` | Bảng giá |
| `PriceCatalogVersion` | Phiên bản có hiệu lực theo thời gian |
| `VehicleRate` | Giá theo loại xe |
| `RouteRate` | Giá theo tuyến |
| `LaborRate` | Giá nhân công bốc xếp |
| `SurchargeRule` | Phụ phí: ngoài giờ, tầng cao, không thang máy |
| `PriceZone`, `PriceZoneArea` | Vùng giá |

Có phiên bản vì báo giá đã gửi phải giữ nguyên giá tại thời điểm gửi. Đổi bảng giá không
được làm thay đổi báo giá cũ.

> Module `pricing` hiện **rỗng**. Các bảng này đã có trong schema nhưng chưa có mã nghiệp vụ
> và chưa có giao diện quản trị.

---

## 6. Đội xe

| Model | Vai trò |
|---|---|
| `VehicleType` | Loại xe: tải 1.5 tấn, xe thùng… |
| `Vehicle` | Xe cụ thể |
| `VehicleDocument` | Đăng kiểm, bảo hiểm — có hạn |
| `VehicleMaintenance` | Lịch sử bảo dưỡng |
| `DriverProfile` | Hồ sơ tài xế, liên kết `User` |
| `DriverDocument` | Bằng lái, giấy khám sức khoẻ |
| `AvailabilityBlock` | Khoảng thời gian xe/tài xế không nhận việc |

Xe và tài xế **không xoá được**, chỉ chuyển `RETIRED` / `INACTIVE`. Xoá một xe là xoá lịch
sử mọi chuyến nó từng chạy.

---

## 7. Chuyến hàng

| Model | Vai trò |
|---|---|
| `Shipment` | Chuyến. **19 trạng thái** |
| `ShipmentStop` | Điểm dừng |
| `ShipmentAssignment` | Phân công xe + tài xế trong một khung giờ |
| `ShipmentStatusEvent` | Lịch sử đổi trạng thái |
| `ShipmentMedia` | Ảnh, video bằng chứng |
| `LocationPing` | Điểm vị trí |
| `ProofOfPickup` | Bằng chứng nhận hàng |
| `ProofOfDelivery` | Bằng chứng giao hàng |
| `DeliveryOtp` | OTP xác nhận người nhận |
| `Incident` | Sự cố |
| `IncidentMedia` | Ảnh sự cố — **bảng đã có, chưa nối vào giao diện** |

### `ShipmentAssignment` — ràng buộc exclusion

Bảng này mang ràng buộc exclusion dùng `btree_gist`, chặn hai phân công chồng giờ cho cùng
một xe hoặc cùng một tài xế **ở tầng database**.

Đây là lớp duy nhất không lách được khi hai người bấm cùng lúc. Extension `btree_gist` là
**bắt buộc** — thiếu nó migration sẽ dừng.

### `Shipment.version` — optimistic concurrency

Cột `version` chặn ghi đè khi hai người sửa cùng lúc. Xung đột trả `STALE_VERSION`.

### `ShipmentMedia` — không có `updatedAt`

Bảng dùng `uploadedAt`. Job dọn dẹp tính tuổi bản ghi `REJECTED` theo cột này; sai lệch
không đáng kể vì việc từ chối xảy ra ngay trong lần gọi `confirmUpload`.

### `ProofOfDelivery` — chuỗi đính chính

Không sửa đè. Bản ghi mới trỏ về bản cũ qua `correctionOfId`, bản cũ được đánh
`supersededAt`. Hai ràng buộc viết tay trong migration:

```sql
CREATE UNIQUE INDEX "proof_of_deliveries_one_active_per_shipment"
  ON "proof_of_deliveries" ("shipmentId") WHERE "supersededAt" IS NULL;

CHECK ("correctionOfId" IS NULL OR "correctionOfId" <> "id")
```

### `DeliveryOtp`

Lưu **băm SHA-256 có muối** theo `shipmentId`, không lưu mã gốc.

---

## 8. Hỗ trợ

| Model | Vai trò |
|---|---|
| `ContactInquiry` | Liên hệ từ form công khai |
| `SupportTicket` | Phiếu hỗ trợ. 5 trạng thái |
| `TicketMessage` | Tin nhắn, có `visibility` |
| `TicketAttachment` | Tệp đính kèm — **bảng đã có, chưa nối vào giao diện** |

`TicketMessage.visibility` phân biệt tin nhắn khách thấy được với ghi chú nội bộ. Bộ lọc
này nằm **trong câu truy vấn Prisma**, không lọc sau khi lấy về — xem
[`workflows.md`](workflows.md) §7.

---

## 9. Tài chính

| Model | Vai trò |
|---|---|
| `Invoice` | Hoá đơn. 6 trạng thái |
| `InvoiceLine` | Dòng hoá đơn |
| `PaymentRecord` | Ghi nhận thanh toán. 3 trạng thái |

`PaymentRecord` có trạng thái riêng vì việc ghi nhận và việc đối chiếu là hai bước, thường
do hai người khác nhau làm. **Chỉ thanh toán `CONFIRMED` mới tính vào số đã thu.**

Không có bảng nào lưu dữ liệu thẻ. Hệ thống không tích hợp cổng thanh toán online.

---

## 10. Hệ thống

| Model | Vai trò |
|---|---|
| `Notification` | Thông báo trong ứng dụng |
| `NotificationPreference` | Tuỳ chọn nhận thông báo — **chưa dùng** |
| `NotificationTemplate` | Mẫu nội dung — **chưa dùng**, nội dung hiện nằm trong mã |
| `OutboxEvent` | Hàng đợi thông báo. Xem [`notifications.md`](notifications.md) |
| `AuditLog` | Nhật ký kiểm toán. **Chỉ ghi thêm** |
| `IdempotencyRecord` | Chống gửi trùng — **bảng đã có, chưa endpoint nào dùng** |
| `ConsentRecord` | Ghi nhận đồng ý — **chưa dùng** |
| `DataSubjectRequest` | Yêu cầu của chủ thể dữ liệu — **chưa dùng** |
| `SystemSetting` | Cấu hình chỉnh được lúc chạy |

`AuditLog` không có đường sửa hay xoá qua ứng dụng. Nhật ký sửa được thì không còn là nhật
ký. Chưa có job dọn theo `AUDIT_RETENTION_DAYS`; bảng này chỉ tăng.

---

## 11. `CompanyProfile` — mọi trường mặc định rỗng

Đây là ràng buộc nghiệp vụ, không phải thiếu sót.

Tên pháp lý, mã số thuế, giấy phép, địa chỉ, số điện thoại, quy mô đội xe, khu vực phục vụ,
bảng giá, số năm kinh nghiệm, số lượng khách hàng, đánh giá, chứng nhận, điều khoản trách
nhiệm và bảo hiểm — **không được bịa**.

Trường chưa có dữ liệu hiển thị **"Cần doanh nghiệp cập nhật"** trong giao diện quản trị, và
được ẩn ở trang công khai. Không có số liệu giả, không có đánh giá giả, không có logo đối
tác giả.

Danh sách những gì còn thiếu: [`content-needed.md`](content-needed.md).

---

## 12. Bảng đã có nhưng chưa dùng

Tổng hợp lại để không ai tưởng các tính năng này đã chạy:

| Bảng | Thiếu gì |
|---|---|
| `MfaCredential` | MFA chưa triển khai |
| `IdempotencyRecord` | Chưa endpoint nào đọc header `Idempotency-Key` |
| `NotificationTemplate` | Nội dung hiện nằm trong `catalog.ts` |
| `NotificationPreference` | Chưa cho người dùng tự chọn |
| `ConsentRecord` | Chưa ghi nhận đồng ý |
| `DataSubjectRequest` | Chưa có quy trình xử lý |
| `TicketAttachment` | Module media sẵn sàng, chưa nối |
| `IncidentMedia` | Module media sẵn sàng, chưa nối |
| Nhóm `Price*`, `*Rate` | Module `pricing` rỗng |
