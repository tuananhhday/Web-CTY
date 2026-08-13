# Thông tin doanh nghiệp cần cung cấp

> Toàn bộ nội dung hiển thị trên website hiện là **thông tin minh họa**. Danh sách dưới đây là những gì cần bạn cung cấp để thay thế trước khi công bố.
>
> Nơi cập nhật chính: [`src/config/company.ts`](../src/config/company.ts)

## 1. Thông tin pháp lý và nhận diện

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Tên công ty đầy đủ | ✅ Đã có | `company.name` |
| Tên viết tắt / tên thương hiệu | ✅ Đã có | `company.shortName` |
| Logo (SVG hoặc PNG nền trong suốt) | ❌ Thiếu | Hiện dùng logo chữ tạm + icon xe tải |
| Mã số thuế | ❌ Thiếu | `company.taxCode` đang là placeholder |
| Giấy phép kinh doanh vận tải (nếu công bố) | ❌ Thiếu | Cần bản scan hoặc số giấy phép |

## 2. Thông tin liên hệ

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Hotline | ✅ Đã có | `company.phone` |
| Số Zalo | ✅ Đã có | `company.zalo` |
| Email | ✅ Đã có | `company.email` |
| Địa chỉ trụ sở | ✅ Đã có | `company.address` |
| Địa chỉ kho bãi / chi nhánh khác | ❌ Thiếu | Nếu có nhiều điểm, cần danh sách |
| Giờ làm việc chính xác | ⚠️ Cần xác nhận | Hiện đặt mặc định T2–T7, 08:00–18:00 |

## 3. Mạng xã hội

Hiện để trống trong `socialLinks`:

- [ ] Facebook Page
- [ ] Zalo OA
- [ ] YouTube / TikTok (nếu có)

## 4. Dịch vụ thật

File hiện tại: [`src/data/mock/services.ts`](../src/data/mock/services.ts) — 6 dịch vụ minh họa.

Cần xác nhận cho **từng dịch vụ**:

- [ ] Có thực sự cung cấp dịch vụ này không
- [ ] Tên gọi chính thức
- [ ] Mô tả ngắn (1–2 câu) và mô tả chi tiết
- [ ] Điều kiện áp dụng, giới hạn hàng hóa
- [ ] Dịch vụ nào cần bổ sung mà chưa có trong danh sách

## 5. Phạm vi vận chuyển

Hiện tại website ghi *"Phạm vi phục vụ được xác nhận theo từng yêu cầu vận chuyển"* và liệt kê một số tỉnh minh họa trong `serviceAreas`.

- [ ] Danh sách tỉnh/thành thực sự phục vụ
- [ ] Có phục vụ toàn quốc không, hay giới hạn tuyến cố định
- [ ] Các tuyến chạy thường xuyên (nếu muốn hiển thị)

## 6. Đội xe thật

File hiện tại: [`src/data/mock/vehicle-types.ts`](../src/data/mock/vehicle-types.ts) — 6 nhóm xe minh họa, **không ghi tải trọng và số lượng** vì chưa có dữ liệu.

- [ ] Danh sách loại xe thực tế đang khai thác
- [ ] Tải trọng từng loại (kg hoặc tấn)
- [ ] Kích thước thùng (nếu muốn công bố)
- [ ] Số lượng xe mỗi loại (nếu muốn công bố)
- [ ] Loại hàng phù hợp với từng nhóm xe

## 7. Hình ảnh thật

Hiện dùng 4 ảnh Unsplash minh họa — xem [`docs/image-sources.md`](image-sources.md).

- [ ] Ảnh đội xe thật (nhiều góc, độ phân giải ≥ 1600px chiều rộng)
- [ ] Ảnh kho bãi / điểm tập kết
- [ ] Ảnh quá trình bốc xếp
- [ ] Ảnh đội ngũ nhân sự (nếu muốn dùng ở trang Giới thiệu)
- [ ] Xác nhận quyền sử dụng hình ảnh (đặc biệt nếu có mặt người)

## 8. Nội dung giới thiệu doanh nghiệp

Trang `/gioi-thieu` hiện là bản nháp trung tính.

- [ ] Năm thành lập
- [ ] Câu chuyện / định hướng doanh nghiệp
- [ ] Năng lực thực tế (nếu muốn công bố số liệu, cần con số đã kiểm chứng)
- [ ] Chứng nhận, giấy phép chuyên ngành (nếu có)
- [ ] Đối tác tiêu biểu (**chỉ dùng khi đã có sự đồng ý bằng văn bản của đối tác**)
- [ ] Đánh giá khách hàng (**chỉ dùng đánh giá thật, có sự đồng ý của khách hàng**)

> ⚠️ Website hiện **không** hiển thị bất kỳ số liệu nào chưa được kiểm chứng (số năm hoạt động, số khách hàng, số xe, tỷ lệ giao đúng hạn). Chỉ bổ sung khi bạn cung cấp số liệu thật.

## 9. Chính sách và điều khoản

Hai trang `/chinh-sach-bao-mat` và `/dieu-khoan-su-dung` đang là **bản nháp có gắn cảnh báo chưa có hiệu lực pháp lý**.

- [ ] Chính sách bảo mật chính thức (nên có bộ phận pháp chế rà soát)
- [ ] Điều khoản sử dụng chính thức
- [ ] Chính sách bồi thường hàng hóa
- [ ] Chính sách hủy đơn / hoàn tiền
- [ ] Quy định về hàng hóa cấm vận chuyển

## 10. Nghiệp vụ vận hành (phục vụ giai đoạn backend)

- [ ] Bộ trạng thái đơn hàng thực tế đang dùng (hiện đang dùng 7 trạng thái minh họa)
- [ ] Quy tắc đánh mã vận đơn / mã báo giá
- [ ] Cách tính chi phí (theo km, theo tải trọng, theo tuyến cố định...)
- [ ] Ai là người xác nhận báo giá và trong bao lâu
- [ ] Cách theo dõi vị trí xe: GPS điện thoại tài xế hay thiết bị định vị gắn xe

## 11. Tên miền và hạ tầng

- [ ] Tên miền chính thức
- [ ] Email doanh nghiệp (nếu muốn dùng SMTP riêng để gửi thông báo)
- [ ] Nơi triển khai (Vercel, VPS, hosting nội địa...)
