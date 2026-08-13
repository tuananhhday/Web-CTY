# Tính năng tương lai — chưa triển khai

> Theo §36. Các mục dưới đây **không** có route, menu, model, API, CTA hay màn hình mock
> nào trong sản phẩm hiện tại. Đây là ghi chú nội bộ, không phải cam kết với khách hàng.

## 1. Công cụ tổng hợp bài đăng tìm hàng từ Facebook

**Trạng thái: chưa triển khai, chưa được phê duyệt về pháp lý.**

Mục tiêu tương lai: giúp người dùng có quyền truy cập xem các bài đăng công khai phù hợp
từ group/page vận tải.

### Điều kiện bắt buộc trước khi bắt đầu

- [ ] Xác minh khả năng và quyền truy cập qua **Meta Graph API chính thức**
- [ ] Rà soát Platform Terms, quy định quyền riêng tư, bản quyền và điều kiện riêng của
      từng group/page
- [ ] **Không** scraping trái phép, **không** vượt qua đăng nhập, CAPTCHA hay giới hạn truy cập
- [ ] Không thu thập profile hoặc dữ liệu cá nhân vượt quá mục đích đã công bố
- [ ] Thiết kế cơ chế kiểm duyệt, khử trùng lặp, ghi nguồn và thời điểm đồng bộ
- [ ] Tách thành module riêng sau khi có quyết định pháp lý và kỹ thuật

### Rủi ro cần cân nhắc

Việc thu thập nội dung từ nền tảng bên thứ ba có rủi ro pháp lý và rủi ro bị khoá truy cập.
Cần ý kiến pháp chế trước khi đầu tư công sức phát triển.

---

## 2. AI ước tính giá từ ảnh hàng hóa

**Trạng thái: chưa triển khai.** Đã gỡ bỏ toàn bộ giao diện mô phỏng khỏi sản phẩm ngày
10/08/2026 vì §1 cấm quảng cáo tính năng chưa có và cấm nút giả.

### Điều kiện bắt buộc trước khi bắt đầu

- [ ] Xác định model/provider cụ thể và chi phí vận hành
- [ ] Lấy consent xử lý ảnh từ người dùng, có version và timestamp
- [ ] Xây dataset hợp pháp
- [ ] Chỉ dùng ở mức **hỗ trợ**: phân loại hàng, ước lượng kích thước/khối lượng
- [ ] Yêu cầu vật chuẩn trong ảnh hoặc để người dùng nhập kích thước tham chiếu
- [ ] Hiển thị độ tin cậy và lý do của kết quả
- [ ] **Không** coi kết quả AI là giá cuối cùng
- [ ] Nhân viên bắt buộc xác nhận trước khi phát hành báo giá
- [ ] Đo sai số, drift, bias và chi phí theo thời gian
- [ ] Có fallback thủ công và chính sách lưu/xoá ảnh rõ ràng

### Ghi chú kỹ thuật

Schema hiện tại đã có `RequestAttachment` để lưu ảnh hàng hóa khách gửi kèm yêu cầu báo giá.
Ảnh này phục vụ **nhân viên đánh giá thủ công**, không đưa vào mô hình nào.

Khi triển khai AI, bổ sung hai bảng `CargoImage` và `AiAnalysis` với các trường: kết quả thô
từ model, độ tin cậy, người xác nhận lại và thời điểm xác nhận.

---

## 3. Các mục có thể cân nhắc

| Hạng mục | Ghi chú |
|---|---|
| Ứng dụng tài xế native hoặc PWA nâng cao | Hiện dùng web responsive; PWA giúp chụp ảnh và gửi vị trí ổn định hơn khi mạng yếu |
| Tích hợp thiết bị GPS/IoT thật trên xe | Schema `LocationPing` đã sẵn sàng nhận dữ liệu từ nguồn khác ngoài điện thoại tài xế |
| Cổng thanh toán online | Bắt buộc dùng hosted/tokenized flow của nhà cung cấp, webhook có chữ ký, idempotency và reconciliation. Tuyệt đối không lưu dữ liệu thẻ |
| Hóa đơn điện tử hợp pháp | Phải qua nhà cung cấp được cấp phép. `Invoice.invoiceNumber` hiện chỉ là mã chứng từ nội bộ |
| Tối ưu lộ trình nhiều xe | Cần dữ liệu vận hành thật để đánh giá hiệu quả trước khi đầu tư |
| Tích hợp CRM/kế toán | Chờ doanh nghiệp xác định phần mềm đang dùng |
