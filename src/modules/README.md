# Module nghiệp vụ

Kiến trúc modular monolith (§4). Mỗi module là một biên nghiệp vụ độc lập.

## Cấu trúc chuẩn của một module

```
src/modules/<ten-module>/
├── schema.ts       Zod schema cho input/output (DTO)
├── policy.ts       Kiểm tra quyền: role, permission, ownership, assignment
├── service.ts      Logic nghiệp vụ, transaction, ghi outbox + audit
├── repository.ts   Truy cập database qua Prisma
└── index.ts        Điểm export công khai của module
```

## Quy tắc bắt buộc

**Không gọi Prisma trực tiếp trong component hoặc route handler.** Mọi truy cập database
đi qua `repository.ts` của module tương ứng.

**Không để logic phân quyền chỉ ở giao diện.** Ẩn nút trên UI không phải là bảo vệ.
Mọi truy cập dữ liệu riêng tư phải kiểm tra quyền và quyền sở hữu ở server, ngay trong
câu truy vấn chứ không phải sau khi đã lấy bản ghi ra (§30.2).

**Route handler và server action phải mỏng.** Nhiệm vụ của chúng: parse input → gọi
service → map lỗi thành response. Không chứa logic nghiệp vụ.

**Mọi service method nhận actor context.** Không có hàm nghiệp vụ nào chạy mà không biết
ai đang thực hiện. Deny by default.

**Nghiệp vụ nhiều bước phải nằm trong transaction**, và ghi `OutboxEvent` cùng transaction
đó để không mất side effect khi provider thông báo lỗi (§21, §32.2).

## Danh sách module

| Module | Phạm vi |
|---|---|
| `auth` | Đăng nhập, phiên, xác minh, MFA, đặt lại mật khẩu |
| `users` | Hồ sơ, sổ địa chỉ, vai trò, quản lý tài khoản |
| `cms` | Nội dung website, trang tĩnh, tin tức, FAQ, media thư viện |
| `services` | Danh mục dịch vụ và khu vực phục vụ |
| `service-requests` | Yêu cầu vận chuyển và yêu cầu chuyển nhà |
| `pricing` | Bảng giá có phiên bản, phụ phí, giá nhân công |
| `quotes` | Báo giá, revision, duyệt, thương lượng |
| `fleet` | Xe, loại xe, tài xế, giấy tờ, lịch bận |
| `shipments` | Đơn hàng, state machine, điều phối, phân công |
| `tracking` | Tra cứu công khai và tra cứu trong tài khoản |
| `media` | Upload intent/confirm, quét, signed URL |
| `locations` | Nhận và hiển thị vị trí phương tiện |
| `proof-of-delivery` | Bằng chứng lấy hàng và giao hàng, OTP |
| `incidents` | Sự cố, tổn thất |
| `support` | Ticket hỗ trợ, khiếu nại, liên hệ |
| `invoices` | Hóa đơn và thanh toán ghi nhận |
| `notifications` | Outbox, mẫu thông báo, kênh gửi |
| `audit` | Nhật ký thao tác append-only |
