# Vai trò và phân quyền

> Nguồn sự thật là mã nguồn: [`src/modules/auth/permissions.ts`](../src/modules/auth/permissions.ts).
> Tài liệu này mô tả lại để người không đọc mã vẫn nắm được. Khi sửa mã, sửa cả tài liệu.

## Nguyên tắc nền tảng

**Deny by default.** Không có trong ma trận nghĩa là không được phép. Không có cơ chế
"quyền mặc định" hay kế thừa ngầm giữa các vai trò.

**Hai lớp kiểm tra tách bạch.** Có quyền chưa đủ để chạm vào một bản ghi cụ thể:

| Lớp | Câu hỏi | Nơi thực hiện |
|---|---|---|
| 1. Permission | Vai trò này về nguyên tắc được làm gì? | `permissions.ts` |
| 2. Ownership / assignment | Bản ghi cụ thể này có thuộc về họ không? | `policy.ts` |

Người có quyền `*_all` bỏ qua lớp 2. Người không có thì bắt buộc qua lớp 2.

**Lọc ngay trong truy vấn.** Khi người dùng không có quyền `*_all`, câu truy vấn phải kèm
điều kiện `userId = actor.userId` — không lấy hết rồi mới lọc sau (§30.2).

**Vai trò đọc từ database mỗi request.** Không lấy từ cookie hay JWT claim. Thu hồi vai trò
có hiệu lực ngay, không phải chờ phiên hết hạn.

**Truy cập chéo trả 404, không phải 403.** Trả 403 sẽ xác nhận bản ghi có tồn tại.

## Tám vai trò

| Vai trò | Mô tả | Đăng ký công khai |
|---|---|---|
| `GUEST` | Chưa đăng nhập. Không có bản ghi trong database. | — |
| `CUSTOMER` | Khách hàng. Chỉ chạm được dữ liệu của chính mình. | Có |
| `DRIVER` | Tài xế. Chỉ chạm được chuyến được phân công. | Không |
| `DISPATCHER` | Điều phối vận hành. | Không |
| `EDITOR` | Biên tập nội dung website. | Không |
| `ACCOUNTANT` | Kế toán, hóa đơn và thanh toán. | Không |
| `ADMIN` | Quản trị viên. | Không |
| `SUPER_ADMIN` | Quản trị hệ thống. | Không |

Vai trò `CARGO_PARTNER` **không tồn tại** ở phiên bản này (§8).

Tài khoản nhân viên không được đăng ký công khai — phải do quản trị viên tạo hoặc mời (§9).

## Ma trận quyền

Ký hiệu: ● có quyền · ○ không có quyền

| Permission | CUSTOMER | DRIVER | DISPATCHER | EDITOR | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `cms.read` | ○ | ○ | ○ | ● | ○ | ● | ● |
| `cms.write` | ○ | ○ | ○ | ● | ○ | ● | ● |
| `cms.publish` | ○ | ○ | ○ | ● | ○ | ● | ● |
| `request.read_all` | ○ | ○ | ● | ○ | ● | ● | ● |
| `request.manage` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `quote.read_all` | ○ | ○ | ● | ○ | ● | ● | ● |
| `quote.create` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `quote.approve` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `quote.send` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `pricing.read` | ○ | ○ | ● | ○ | ● | ● | ● |
| `pricing.manage` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `pricing.publish` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `shipment.read_all` | ○ | ○ | ● | ○ | ● | ● | ● |
| `shipment.dispatch` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `shipment.update` | ○ | ● | ● | ○ | ○ | ● | ● |
| `fleet.read` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `fleet.manage` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `tracking.read_all` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `tracking.manage` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `incident.read_all` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `incident.manage` | ○ | ● | ● | ○ | ○ | ● | ● |
| `support.read_all` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `support.manage` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `invoice.read_all` | ○ | ○ | ○ | ○ | ● | ● | ● |
| `invoice.manage` | ○ | ○ | ○ | ○ | ● | ● | ● |
| `payment.record` | ○ | ○ | ○ | ○ | ● | ● | ● |
| `user.read` | ○ | ○ | ● | ○ | ○ | ● | ● |
| `user.manage` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `audit.read` | ○ | ○ | ○ | ○ | ○ | ● | ● |
| `settings.manage` | ○ | ○ | ○ | ○ | ○ | **○** | ● |

## Vì sao CUSTOMER không có quyền nào

Khách hàng có **0 permission**. Điều đó không có nghĩa họ không làm được gì — họ truy cập
dữ liệu của chính mình thông qua kiểm tra **ownership**, không thông qua permission.

Thiết kế này khiến mọi lỗ hổng IDOR trở nên rõ ràng: nếu một endpoint cho khách hàng chạm
được dữ liệu người khác, đó chắc chắn là lỗi bỏ sót kiểm tra ownership, không phải do cấu
hình quyền sai.

## Các ràng buộc được thực thi bằng test

Mỗi dòng dưới đây có ít nhất một test tương ứng trong
[`tests/unit/permissions.test.ts`](../tests/unit/permissions.test.ts) và
[`tests/unit/policy-idor.test.ts`](../tests/unit/policy-idor.test.ts).

| Ràng buộc (§8) | Cách thực thi |
|---|---|
| CUSTOMER chỉ đọc/ghi tài nguyên của chính mình | `canReadOwned` / `canWriteOwned` so khớp `ownerId` |
| DRIVER chỉ xem chuyến được phân công | `isAssignedDriver` kiểm tra `primaryDriverId`/`secondaryDriverId` |
| Tài xế cũ mất quyền sau khi assignment hết hiệu lực | Kiểm tra thêm `isActive` và khoảng `effectiveFrom`–`effectiveTo` |
| DRIVER không xem bảng giá nội bộ | Không cấp `pricing.*` |
| DRIVER không xem dữ liệu tài chính | Không cấp `invoice.*`, `payment.*` |
| EDITOR không điều phối | Chỉ cấp `cms.*` |
| ACCOUNTANT không đổi trạng thái vận chuyển | Có `invoice.manage`, không có `shipment.update` |
| DISPATCHER không tự cấp quyền | Không cấp `user.manage` |
| ADMIN không mặc nhiên có quyền SUPER_ADMIN | `settings.manage` chỉ thuộc SUPER_ADMIN |

## Thao tác nhạy cảm cần xác thực lại

`requireFreshAuth` áp thêm hai điều kiện cho `user.manage`, `settings.manage`, `payment.record`:

1. Phiên phải được xác thực trong vòng **15 phút** gần nhất, nếu không ném `REAUTH_REQUIRED`.
2. Tài khoản `ADMIN`/`SUPER_ADMIN` phải đã bật MFA, nếu không ném `MFA_REQUIRED`.

## Bảo vệ theo tầng

| Tầng | Vai trò | Có phải lớp bảo vệ không |
|---|---|---|
| Route group `(auth)`, `(public)` | Tổ chức mã nguồn | **Không** |
| `src/middleware.ts` | Điều hướng sớm, tránh chớp giao diện | **Không** |
| `guards.ts` trong Server Component | Chặn truy cập trang | **Có** |
| `policy.ts` trong service | Chặn truy cập dữ liệu | **Có** — lớp quyết định |
| Ràng buộc database | Chặn dữ liệu sai bất kể tầng trên | **Có** |

Middleware chỉ kiểm tra **sự tồn tại** của cookie phiên. Nó không xác minh chữ ký, không đọc
database, không biết vai trò. Xóa middleware đi thì hệ thống vẫn an toàn — chỉ kém mượt hơn.

## Tài khoản development

Tạo bằng `pnpm db:seed:accounts`. Chỉ chạy được khi `NODE_ENV != production`.

| Email | Vai trò |
|---|---|
| `superadmin@local.test` | SUPER_ADMIN |
| `admin@local.test` | ADMIN |
| `dieuphoi@local.test` | DISPATCHER |
| `bientap@local.test` | EDITOR |
| `ketoan@local.test` | ACCOUNTANT |
| `taixe1@local.test` | DRIVER (hồ sơ TX-001) |
| `taixe2@local.test` | DRIVER (hồ sơ TX-002) |
| `khachhang1@local.test` | CUSTOMER |
| `khachhang2@local.test` | CUSTOMER |

Mật khẩu chung lấy từ biến `SEED_DEMO_PASSWORD` trong `.env`. Script từ chối chạy nếu mật
khẩu ngắn hơn 10 ký tự, và dừng ngay nếu phát hiện hai tài khoản trùng email.
