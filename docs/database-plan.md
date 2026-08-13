# Kế hoạch database

> **Trạng thái:** Bản nháp schema. Chưa chạy migration, chưa kết nối database thật, chưa có API.
> File schema: [`prisma/schema.prisma`](../prisma/schema.prisma)

## 1. Nguyên tắc thiết kế

- Giao diện được xây trước, nhưng cấu trúc dữ liệu phải chuẩn bị đủ để giai đoạn sau không phải thiết kế lại.
- Mọi số tiền dùng `Decimal` (không dùng `Float`) để tránh sai số khi tính toán chi phí.
- Bảng nghiệp vụ dùng `onDelete: SetNull` với quan hệ tới `User` để không mất dữ liệu lịch sử khi người dùng bị xóa; bảng con phụ thuộc chặt (item, tracking event) dùng `Cascade`.
- Trạng thái dùng `enum` thay vì chuỗi tự do để tránh dữ liệu rác.
- Chưa đưa vào schema: bảng thanh toán, hợp đồng, bảng giá theo tuyến — chờ nghiệp vụ thật từ doanh nghiệp.

## 2. Phân nhóm theo giai đoạn triển khai

| Nhóm | Bảng | Mục đích |
|---|---|---|
| **[AUTH]** Đăng nhập & tài khoản | `User`, `Session`, `Account`, `Verification`, `CustomerProfile`, `Address` | Xác thực, hồ sơ khách hàng, sổ địa chỉ |
| **[SHIPPING]** Vận chuyển | `Service`, `VehicleType`, `QuoteRequest`, `QuoteRequestItem`, `Shipment`, `ShipmentItem`, `TrackingEvent`, `ContactLead`, `Notification` | Danh mục dịch vụ/xe, yêu cầu báo giá, đơn hàng, hành trình, liên hệ, thông báo |
| **[AI]** Ước tính từ ảnh | `CargoImage`, `AiAnalysis` | Lưu ảnh hàng hóa và kết quả nhận diện, luôn kèm bước người xác nhận |
| **[AUDIT]** Nhật ký | `AuditLog` | Lưu vết thao tác thay đổi dữ liệu |

## 3. ERD

```mermaid
erDiagram
    User ||--o{ Session : "có"
    User ||--o{ Account : "liên kết"
    User ||--o{ Verification : "yêu cầu"
    User ||--o| CustomerProfile : "hồ sơ"
    User ||--o{ QuoteRequest : "gửi"
    User ||--o{ Shipment : "sở hữu"
    User ||--o{ Notification : "nhận"
    User ||--o{ AuditLog : "thực hiện"
    User ||--o{ CargoImage : "tải lên"

    CustomerProfile ||--o{ Address : "lưu"

    Service ||--o{ QuoteRequest : "được chọn cho"
    VehicleType ||--o{ QuoteRequest : "đề xuất cho"
    VehicleType ||--o{ Shipment : "điều phối cho"

    QuoteRequest ||--o{ QuoteRequestItem : "gồm"
    QuoteRequest ||--o{ CargoImage : "đính kèm"
    QuoteRequest ||--o| Shipment : "chuyển thành"

    Shipment ||--o{ ShipmentItem : "gồm"
    Shipment ||--o{ TrackingEvent : "ghi nhận"

    CargoImage ||--o{ AiAnalysis : "được phân tích"

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        string phone
        enum role
        boolean isActive
    }

    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expiresAt
    }

    Account {
        string id PK
        string userId FK
        string provider
        string providerAccountId
    }

    Verification {
        string id PK
        string userId FK
        string token UK
        enum purpose
        datetime expiresAt
    }

    CustomerProfile {
        string id PK
        string userId FK,UK
        string companyName
        string taxCode
    }

    Address {
        string id PK
        string customerProfileId FK
        enum type
        string line
        string province
        boolean isDefault
    }

    Service {
        string id PK
        string slug UK
        string name
        boolean isActive
    }

    VehicleType {
        string id PK
        string slug UK
        enum category
        int maxWeightKg
    }

    QuoteRequest {
        string id PK
        string code UK
        string userId FK
        string serviceId FK
        string vehicleTypeId FK
        enum status
        decimal quotedAmount
    }

    QuoteRequestItem {
        string id PK
        string quoteRequestId FK
        string cargoType
        decimal weightKg
        int quantity
    }

    Shipment {
        string id PK
        string code UK
        string userId FK
        string quoteRequestId FK,UK
        enum status
        decimal totalAmount
    }

    ShipmentItem {
        string id PK
        string shipmentId FK
        string cargoType
        decimal weightKg
    }

    TrackingEvent {
        string id PK
        string shipmentId FK
        enum status
        decimal latitude
        decimal longitude
        datetime occurredAt
    }

    ContactLead {
        string id PK
        string name
        string phone
        enum status
    }

    Notification {
        string id PK
        string userId FK
        enum type
        datetime readAt
    }

    CargoImage {
        string id PK
        string userId FK
        string quoteRequestId FK
        string storageKey
        string mimeType
    }

    AiAnalysis {
        string id PK
        string cargoImageId FK
        enum status
        decimal confidence
        datetime reviewedAt
    }

    AuditLog {
        string id PK
        string userId FK
        string action
        string entityType
        json changes
    }
```

## 4. Ghi chú thiết kế theo bảng

### QuoteRequest → Shipment
Quan hệ 1–1 tùy chọn. Một yêu cầu báo giá sau khi được xác nhận sẽ sinh ra đúng một vận đơn. Vẫn cho phép tạo `Shipment` độc lập (đơn nhập tay từ nhân viên) nên `quoteRequestId` để null được.

### TrackingEvent và theo dõi vị trí
`latitude` / `longitude` đã có sẵn để phục vụ tính năng theo dõi vị trí phương tiện. Nguồn dữ liệu có thể là GPS điện thoại tài xế (app driver) hoặc thiết bị định vị gắn xe — quyết định sau, schema không cần đổi.

### AiAnalysis
- `rawResult` (Json) giữ nguyên kết quả thô từ mô hình để đối chiếu khi cần.
- `reviewedByUserId` / `reviewedAt` bắt buộc trong luồng nghiệp vụ: kết quả AI **không** được tự động tin, luôn cần người xác nhận.
- Một ảnh có thể phân tích nhiều lần (đổi mô hình, chạy lại) nên quan hệ là 1–n.

### Giá trị tiền tệ
`quotedAmount`, `totalAmount` dùng `Decimal(14,2)`, kèm cột `currency` mặc định `"VND"` để mở đường cho hợp đồng ngoại tệ sau này.

## 5. Việc chưa làm (giai đoạn sau)

- [ ] Chạy `prisma migrate dev` sau khi có `DATABASE_URL` thật
- [ ] Viết seed data thay thế mock data trong `src/data/mock/`
- [ ] Bổ sung bảng thanh toán / hợp đồng khi có nghiệp vụ thật
- [ ] Bổ sung bảng bảng giá theo tuyến nếu doanh nghiệp áp dụng biểu giá cố định
- [ ] Xác định chính sách lưu trữ và xóa ảnh hàng hóa (retention policy)
- [ ] Rà soát index sau khi có dữ liệu thật và truy vấn thực tế

## 6. Cách chạy kiểm tra schema

```bash
npx prisma format
```

```bash
npx prisma validate
```

Không chạy `prisma migrate` hoặc `prisma db push` ở giai đoạn này.
