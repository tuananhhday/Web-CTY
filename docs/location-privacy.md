# Quyền riêng tư dữ liệu vị trí

Vị trí tài xế là dữ liệu cá nhân của **người lao động**, không phải tài sản vận hành. Tài
liệu này ghi lại cách hệ thống xử lý nó và những ranh giới đã đặt ra.

---

## 1. Vấn đề

Theo dõi vị trí trong vận tải có hai mục đích chính đáng: khách muốn biết hàng đang ở đâu,
và điều phối cần biết xe đang ở đâu để phân chuyến tiếp.

Nó cũng cho phép hai việc **không** chính đáng: giám sát nhân viên ngoài giờ làm, và dựng
lại toàn bộ lịch trình di chuyển của một người trong nhiều tháng.

Ranh giới giữa hai nhóm này không tự có. Nó phải được cài vào hệ thống.

---

## 2. Bốn ràng buộc

| Ràng buộc | Cơ chế |
|---|---|
| Chỉ thu thập khi chuyến đang chạy | Ứng dụng tài xế chỉ gửi trong hành trình |
| Khách chỉ xem khi được bật | `locationSharingEnabled`, **mặc định tắt** |
| Thông tin tài xế chỉ hiện trong khung giờ | `driverVisibleNow()` |
| Dữ liệu bị xoá sau thời hạn | `purgeExpiredLocations()`, chạy mỗi 6 giờ |

---

## 3. Dữ liệu được lưu

`LocationPing`:

| Trường | Ghi chú |
|---|---|
| `latitude`, `longitude` | Decimal(10,7) — chính xác tới ~1 cm |
| `accuracyM` | Sai số thiết bị báo |
| `speedKph`, `heading` | Tuỳ chọn |
| `recordedAt` | Thời điểm **thiết bị** ghi nhận |
| `receivedAt` | Thời điểm **server** nhận |
| `shipmentId`, `assignmentId` | Gắn với chuyến, không gắn trực tiếp với người |

### Vì sao có cả hai mốc thời gian

`recordedAt` do thiết bị khai, và đồng hồ thiết bị có thể sai hoặc bị chỉnh. `receivedAt`
do server ghi.

Ứng dụng tài xế gom điểm khi mất sóng rồi gửi bù cả lô, nên hai mốc lệch nhau là bình
thường. Nhưng lệch bất thường là dấu hiệu cần đối chiếu — đặc biệt khi vị trí được dùng
làm bằng chứng trong tranh chấp.

### Gắn với chuyến, không gắn với người

`LocationPing` không có `driverId`. Nó trỏ tới `shipmentId` và `assignmentId`.

Truy được ra tài xế qua assignment, nhưng khác biệt vẫn có ý nghĩa: xoá chuyến là xoá điểm
vị trí theo (`onDelete: Cascade`), và không có bảng nào cho phép truy vấn thẳng "cho tôi
mọi vị trí của tài xế X".

---

## 4. Khách hàng xem vị trí

### Mặc định tắt

`Shipment.locationSharingEnabled` mặc định `false`.

Đây là lựa chọn có chủ đích. Mặc định bật sẽ khiến mọi chuyến chia sẻ vị trí trừ khi có
người nhớ tắt — và không ai nhớ.

Nhân viên bật thủ công cho từng chuyến. Việc bật/tắt được ghi vào `AuditLog` kèm lý do.

### Nhân viên không bị chặn bởi cờ này

```ts
if (!isStaff && !shipment.locationSharingEnabled) { … }
```

Cờ điều khiển việc **khách hàng** xem được hay không. Điều phối viên vẫn thấy vị trí để
làm việc.

---

## 5. Thông tin tài xế chỉ hiện trong khung giờ

`driverVisibleNow()` trong `src/modules/tracking/service.ts`:

```ts
return assignment.effectiveFrom <= now && now < assignment.effectiveTo;
```

Ngoài khung giờ phân công, tên và số điện thoại tài xế **bị gỡ khỏi dữ liệu trả về** — chứ
không phải ẩn ở giao diện.

Hai lý do:

- Sau khi bàn giao xong, khách không cần biết ai đã lái xe của họ.
- Tài xế không nên bị gọi điện lúc nửa đêm về một chuyến đã kết thúc từ hôm trước.

### Khác biệt quan trọng với quyền cập nhật

Khung giờ này áp cho **hiển thị thông tin tài xế cho khách**. Nó **không** áp cho **quyền
cập nhật chuyến của tài xế** — hai thứ khác nhau, và nhầm lẫn giữa chúng đã từng gây lỗi
nghiêm trọng.

Chuyến chạy trễ là bình thường trong vận tải. Nếu dùng khung giờ làm ranh giới phân quyền,
tài xế sẽ bị khoá ra khỏi chuyến mình đang chạy. Ranh giới đúng cho quyền cập nhật là
**trạng thái chuyến**. Xem [`security.md`](security.md) §3.

`LOCATION_VISIBILITY_MINUTES` (mặc định 60) cho phép nới thêm sau khi chuyến kết thúc, để
khách còn kịp xem lại.

### Gỡ khỏi dữ liệu, không ẩn ở giao diện

```ts
return {
  ...shipment,
  // Gỡ hẳn khỏi object trả về thay vì để giao diện tự nhớ ẩn đi.
  assignments: undefined,
  vehicle: assignment?.vehicle ?? null,
};
```

Ẩn ở giao diện nghĩa là dữ liệu vẫn nằm trong HTML của trang, xem được bằng "View source".
Đó không phải bảo vệ.

Cùng nguyên tắc với `toPublicView()` trong `src/modules/tracking/masking.ts`: hàm đó chỉ trả
về **những khoá được khai báo tường minh**, nên một trường mới thêm vào model sẽ không tự
lọt ra màn hình tra cứu công khai.

---

## 6. Thời hạn lưu trữ

`LOCATION_RETENTION_DAYS`, mặc định **30 ngày**.

`purgeExpiredLocations()` xoá mọi `LocationPing` có `recordedAt` cũ hơn ngưỡng. Chạy mỗi 6
giờ qua bộ lập lịch.

Chạy nhiều lần không sao. Chạy tay:

```bash
curl -X POST https://tenmien.vn/api/internal/scheduler/run \
  -H "x-internal-key: $BETTER_AUTH_SECRET" \
  -d '{"job":"purge-locations"}'
```

### Xoá thật, không đánh dấu

`deleteMany`, không phải `deletedAt`. Đánh dấu xoá mềm nghĩa là dữ liệu vẫn còn trong
database — không phải là xoá.

### 30 ngày có đúng không

Con số này là mặc định kỹ thuật, **không** phải kết luận pháp lý.

Doanh nghiệp cần quyết định dựa trên: nghĩa vụ lưu trữ chứng từ vận tải, thời hạn khiếu nại
của khách, và quy định về dữ liệu cá nhân của người lao động. Nếu tranh chấp giao hàng
thường được nêu trong vòng 60 ngày thì 30 ngày là quá ngắn.

**Cần doanh nghiệp cập nhật:** thời hạn lưu trữ chính thức và căn cứ của nó.

---

## 7. Nghĩa vụ với tài xế

Những việc dưới đây **chưa được làm** và nằm ngoài phạm vi mã nguồn. Ghi ra vì hệ thống
đang thu thập dữ liệu vị trí của người lao động thật.

- **Thông báo.** Tài xế phải được biết vị trí của họ được thu thập, khi nào, và ai xem được.
- **Đồng ý.** Cần văn bản thoả thuận, không phải một dòng trong điều khoản sử dụng.
- **Quyền truy cập.** Tài xế có quyền xem dữ liệu vị trí của chính mình. Hiện chưa có màn
  hình nào cho việc đó.
- **Giới hạn mục đích.** Dữ liệu thu để điều phối và phục vụ khách. Dùng nó để đánh giá
  hiệu suất hay kỷ luật là mục đích khác, cần cơ sở riêng.

**Cần doanh nghiệp cập nhật:** chính sách sử dụng dữ liệu vị trí của người lao động.

---

## 8. Chưa có

- Màn hình cho tài xế xem lịch sử vị trí của chính mình.
- Xuất dữ liệu theo yêu cầu của chủ thể dữ liệu.
- Cách xoá vị trí của một chuyến cụ thể trước hạn (hiện chỉ có xoá theo thời hạn chung).
- Ghi nhận việc tài xế đồng ý.
- Giảm độ chính xác toạ độ cho khách hàng — hiện khách thấy đúng toạ độ tài xế gửi.
- Bản đồ. `MAP_PROVIDER=none` nên vị trí hiện dưới dạng toạ độ số.
