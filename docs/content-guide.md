# Hướng dẫn biên tập nội dung

Dành cho người quản lý nội dung website: viết gì, viết thế nào, và **tuyệt đối không được
viết gì**.

Tài liệu này nói về *cách viết*. Danh sách thông tin doanh nghiệp còn thiếu nằm ở
[`content-needed.md`](content-needed.md).

---

## 1. Nguyên tắc bất di bất dịch: không bịa

Đây không phải lời khuyên phong cách. Đây là ràng buộc, và nó có lý do pháp lý.

### Tuyệt đối không được tự nghĩ ra

| Nhóm | Ví dụ cụ thể |
|---|---|
| Pháp lý | Tên pháp nhân, mã số thuế, số giấy phép kinh doanh vận tải |
| Liên hệ | Địa chỉ, số điện thoại, email, Zalo, Facebook |
| Năng lực | Số lượng xe, loại xe, tải trọng, khu vực phục vụ |
| Giá | Đơn giá, mức chiết khấu, phụ phí |
| Thành tích | Số năm kinh nghiệm, số khách hàng, số chuyến đã chạy, điểm đánh giá |
| Cam kết | Điều khoản trách nhiệm, mức bồi thường, phạm vi bảo hiểm |
| Uy tín | Chứng nhận, giải thưởng, logo đối tác, đánh giá của khách |

Nếu doanh nghiệp chưa cung cấp con số, **để trống**. Giao diện quản trị sẽ hiện *"Cần doanh
nghiệp cập nhật"* và trường đó bị ẩn khỏi trang công khai.

### Vì sao nghiêm khắc đến vậy

- "Hơn 50 đầu xe" trong khi có 12 xe là quảng cáo sai sự thật, và có chế tài.
- "Bồi thường 100% giá trị hàng hoá" là một cam kết ràng buộc pháp lý. Viết một câu, doanh
  nghiệp gánh trách nhiệm thật.
- Đánh giá khách hàng bịa ra là gian lận thương mại.
- Logo đối tác chưa xin phép là xâm phạm nhãn hiệu.

Một con số làm tròn lên cho đẹp trong lúc viết bài sẽ trở thành bằng chứng chống lại doanh
nghiệp khi có tranh chấp.

### Cấm dùng từ ngữ tuyệt đối

Không dùng: **"rẻ nhất"**, **"số 1"**, **"tốt nhất"**, **"an toàn 100%"**, **"đảm bảo tuyệt
đối"**, **"nhanh nhất thị trường"**, **"uy tín nhất"**.

Lý do kép: những tuyên bố này phải chứng minh được, và nếu không chứng minh được thì vi phạm
quy định về quảng cáo. Chúng cũng không thuyết phục — người đọc đã miễn nhiễm.

Viết thế nào thay vào đó:

| ❌ Đừng viết | ✅ Viết |
|---|---|
| "Giá rẻ nhất thị trường" | "Báo giá trọn gói, không phát sinh ngoài hợp đồng" |
| "An toàn 100%" | "Hàng được chằng buộc và chụp ảnh trước khi xe lăn bánh" |
| "Nhanh nhất" | "Nhận hàng trong ngày với đơn đặt trước 10 giờ sáng" |
| "Uy tín số 1" | "Mỗi chuyến có ảnh bằng chứng giao nhận, khách tra cứu được" |

Cột phải cụ thể, kiểm chứng được, và mô tả đúng những gì hệ thống thực sự làm.

---

## 2. Giọng văn

Khách hàng của dịch vụ này đang lo lắng: họ sắp giao tài sản cho người lạ chở đi. Nội dung
tốt làm giảm lo lắng đó bằng thông tin, không bằng tính từ.

| Nên | Không nên |
|---|---|
| Câu ngắn, chủ động | Câu dài nhiều mệnh đề |
| "Chúng tôi", "bạn" | "Quý khách hàng thân mến" |
| Nói rõ việc gì xảy ra tiếp theo | Để người đọc tự đoán |
| Nêu cả giới hạn | Chỉ nói mặt tốt |
| Tiếng Việt có dấu, đúng chính tả | Viết tắt, teencode |

Nói rõ giới hạn là điểm hay bị bỏ qua nhưng lại tạo tin cậy nhiều nhất. "Chúng tôi không
nhận vận chuyển hàng dễ cháy nổ" nói với người đọc rằng doanh nghiệp biết mình đang làm gì.

---

## 3. Nơi nội dung được quản lý

| Loại | Model | Ghi chú |
|---|---|---|
| Thông tin công ty | `CompanyProfile` | Mặc định rỗng |
| Văn phòng, kho | `Office` | |
| Kênh liên hệ | `ContactChannel` | Điện thoại, email, Zalo, Facebook |
| Dịch vụ | `Service` | |
| Khu vực phục vụ | `ServiceArea` | |
| Câu hỏi thường gặp | `Faq` | |
| Trang tĩnh | `StaticPage` | Giới thiệu, chính sách |
| Khối trang chủ | `SiteSection` | |
| Tin tức | `NewsPost` + `NewsCategory` + `NewsTag` | |
| Ảnh nội dung | `MediaAsset` | Khác `ShipmentMedia` |

> Giao diện quản trị cho CMS (`/quan-tri/noi-dung`, `/quan-tri/tin-tuc`) **chưa có**. Hiện
> nội dung được nạp qua seed. Xem [`implementation-status.md`](implementation-status.md).

---

## 4. Quy trình xuất bản

```
DRAFT ──► PUBLISHED ──► ARCHIVED
```

`DRAFT` không hiện ở trang công khai. `publishedAt` quyết định thứ tự hiển thị và ngày
trong structured data — đặt sai sẽ ra bài "đăng trong tương lai".

Sửa bài đã xuất bản có hiệu lực ngay. Không có bước duyệt lại.

---

## 5. Định dạng được phép

Nội dung rich text đi qua bộ lọc trước khi lưu (`src/lib/sanitize.ts`). Thẻ ngoài danh sách
bị **loại bỏ âm thầm** — dán từ Word rồi thấy mất định dạng là do bước này.

**Thẻ được giữ:**

```
p  br  hr
h2  h3  h4
strong  b  em  i  u  s
ul  ol  li
blockquote
a
table  thead  tbody  tr  th  td
figure  figcaption
img
code  pre
```

**Thuộc tính được giữ:** `href`, `title`, `target`, `rel`, `src`, `alt`, `width`, `height`,
`colspan`, `rowspan`.

Mọi thứ khác — `<script>`, `<iframe>`, `<style>`, `onclick`, thuộc tính `style` — bị loại.
Không có ngoại lệ, kể cả cho người có quyền quản trị: tài khoản biên tập cũng có thể bị
chiếm.

### `h1` không có trong danh sách

Mỗi trang chỉ được có **một** `h1`, và nó do hệ thống sinh từ tiêu đề trang. Thân bài bắt
đầu từ `h2`.

Đây là yêu cầu về khả năng tiếp cận: người dùng trình đọc màn hình duyệt trang bằng cấu
trúc tiêu đề. Hai `h1` làm cấu trúc đó vô nghĩa.

### Liên kết ngoài

Liên kết ra ngoài tự động được thêm `rel="noopener noreferrer"`. Không cần tự gõ.

---

## 6. Ảnh

| Yêu cầu | Chi tiết |
|---|---|
| Định dạng | JPEG, PNG, WebP |
| **Không nhận SVG** | SVG chạy được JavaScript — xem [`storage-media.md`](storage-media.md) §3 |
| Kích thước tệp | Tối đa 15 MB, nên nén xuống dưới 300 KB |
| Chiều rộng | 1600 px là đủ cho ảnh bìa |
| `alt` | **Bắt buộc** |

### Viết `alt` cho đúng

`alt` mô tả nội dung ảnh cho người không nhìn thấy nó.

| ❌ | ✅ |
|---|---|
| `alt="ảnh"` | `alt="Xe tải 1,5 tấn đang được xếp hàng tại kho"` |
| `alt="xe tải vận chuyển hàng hóa giá rẻ TPHCM"` | `alt="Hai nhân viên khiêng tủ lạnh lên xe"` |

Cột trái thứ hai là nhồi từ khoá — nó làm hại trải nghiệm người dùng trình đọc màn hình và
không giúp gì cho SEO.

Ảnh thuần trang trí để `alt=""`, không bỏ trống thuộc tính.

### Bản quyền ảnh

Mọi ảnh phải có nguồn hợp pháp. Ảnh minh hoạ đang dùng được ghi nguồn tại
[`image-sources.md`](image-sources.md) và hiển thị công khai ở `/nguon-hinh-anh`.

Ảnh thật của doanh nghiệp luôn tốt hơn ảnh kho — và tránh được rủi ro bản quyền.

**Không dùng ảnh có mặt người, biển số xe, hay địa chỉ khách hàng mà chưa được đồng ý.**

---

## 7. SEO

| Trường | Độ dài | Ghi chú |
|---|---|---|
| `seoTitle` | 50–60 ký tự | Bỏ trống thì dùng tiêu đề bài |
| `seoDescription` | 140–160 ký tự | Bỏ trống thì trích từ nội dung |
| `slug` | ngắn, có dấu gạch nối | **Đổi slug là làm hỏng liên kết cũ** |
| `excerpt` | 1–2 câu | Hiện ở danh sách bài |

### Đổi slug

Slug đã xuất bản thì **không đổi**. Liên kết người khác đã chia sẻ sẽ thành 404, và thứ
hạng tìm kiếm mất theo.

Nếu buộc phải đổi, thêm một chuyển hướng 308 trong `next.config.ts` — xem các mục sẵn có
trong `redirects()` làm mẫu.

### Viết mô tả

Mô tả là dòng hiện dưới tiêu đề trên trang kết quả tìm kiếm. Nó là quảng cáo, không phải
tóm tắt. Nói lợi ích cụ thể của việc bấm vào.

Không nhồi từ khoá. Công cụ tìm kiếm phát hiện được, và người đọc thấy khó chịu.

---

## 8. Trang chính sách

`/chinh-sach/bao-mat`, `/chinh-sach/dieu-khoan`, `/chinh-sach/van-chuyen`,
`/chinh-sach/cookie` là **tài liệu pháp lý**.

Nội dung hiện tại là bản mẫu. Trước khi công bố, chúng phải được người có chuyên môn pháp
lý rà soát. Đặc biệt:

- Điều khoản trách nhiệm và mức bồi thường khi hàng hư hỏng hoặc mất.
- Phạm vi bảo hiểm hàng hoá.
- Điều kiện huỷ chuyến và hoàn tiền.
- Cách thu thập, sử dụng và lưu trữ dữ liệu cá nhân — bao gồm **dữ liệu vị trí của tài xế**,
  xem [`location-privacy.md`](location-privacy.md).

**Đừng chỉnh sửa các trang này như nội dung marketing.** Một câu thêm vào có thể tạo ra nghĩa
vụ pháp lý mà doanh nghiệp không lường trước.

---

## 9. Khả năng tiếp cận

Bắt buộc, không phải tuỳ chọn:

- Tiêu đề đúng thứ bậc: `h2` rồi mới `h3`. Không nhảy cấp, không dùng tiêu đề để làm chữ to.
- Chữ liên kết mô tả được đích đến. **Không dùng "bấm vào đây"** — người dùng trình đọc màn
  hình thường duyệt danh sách liên kết tách rời khỏi ngữ cảnh.
- Bảng phải có hàng tiêu đề `<th>`.
- Không truyền đạt thông tin **chỉ** bằng màu sắc.
- Không viết HOA TOÀN BỘ cả câu — trình đọc màn hình đánh vần từng chữ cái.

---

## 10. Kiểm trước khi xuất bản

- [ ] Mọi số liệu đều do doanh nghiệp cung cấp, không có con số tự nghĩ ra
- [ ] Không có từ ngữ tuyệt đối ("nhất", "100%", "tuyệt đối")
- [ ] Không có cam kết trách nhiệm hay bồi thường chưa được duyệt
- [ ] Mọi ảnh có `alt` mô tả đúng nội dung
- [ ] Mọi ảnh có nguồn hợp pháp, đã ghi vào `image-sources.md`
- [ ] Không có mặt người, biển số, địa chỉ khách chưa xin phép
- [ ] Tiêu đề bắt đầu từ `h2` và không nhảy cấp
- [ ] `seoTitle` và `seoDescription` trong khoảng độ dài
- [ ] Slug không đổi (nếu là bài cũ)
- [ ] Liên kết nội bộ còn sống
- [ ] Đọc lại trên màn hình điện thoại
