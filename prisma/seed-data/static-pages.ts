/**
 * Bản nháp nội dung pháp lý (§31).
 *
 * TOÀN BỘ nội dung dưới đây là BẢN NHÁP KỸ THUẬT do lập trình viên soạn để hệ thống có
 * dữ liệu chạy. Chưa được luật sư hoặc doanh nghiệp rà soát.
 *
 * Mỗi trang mở đầu bằng một khối cảnh báo hiển thị ngay cho người đọc. Khối này chỉ được
 * gỡ sau khi doanh nghiệp phê duyệt nội dung chính thức.
 */

const DRAFT_NOTICE = `<blockquote><p><strong>Bản nháp chưa phê duyệt.</strong> Nội dung trang này do đội kỹ thuật soạn để hệ thống có dữ liệu vận hành. Doanh nghiệp và bộ phận pháp chế cần rà soát, chỉnh sửa và phê duyệt trước khi công bố chính thức. Không sử dụng làm căn cứ pháp lý.</p></blockquote>`;

export interface StaticPageSeed {
  slug: string;
  title: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
}

export const staticPages: StaticPageSeed[] = [
  {
    slug: "bao-mat",
    title: "Chính sách bảo mật",
    seoTitle: "Chính sách bảo mật",
    seoDescription:
      "Cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của khách hàng khi sử dụng dịch vụ vận chuyển.",
    content: `${DRAFT_NOTICE}
<h2>1. Thông tin chúng tôi thu thập</h2>
<p>Khi bạn gửi yêu cầu báo giá, tạo tài khoản hoặc liên hệ với chúng tôi, hệ thống ghi nhận các nhóm thông tin sau:</p>
<ul>
<li><strong>Thông tin liên hệ:</strong> họ tên, số điện thoại, địa chỉ email, tên doanh nghiệp nếu có.</li>
<li><strong>Thông tin vận chuyển:</strong> địa chỉ lấy hàng, địa chỉ giao hàng, loại hàng hóa, khối lượng, kích thước và ảnh hàng hóa bạn tải lên.</li>
<li><strong>Thông tin tài khoản:</strong> địa chỉ email, mật khẩu đã mã hóa một chiều, lịch sử đăng nhập.</li>
<li><strong>Thông tin kỹ thuật:</strong> địa chỉ IP, loại trình duyệt, thời điểm truy cập — phục vụ bảo mật và khắc phục sự cố.</li>
</ul>
<p>Chúng tôi chỉ thu thập thông tin cần thiết cho việc cung cấp dịch vụ. Bạn không bắt buộc phải cung cấp thông tin ngoài phạm vi này.</p>

<h2>2. Mục đích sử dụng</h2>
<ul>
<li>Tiếp nhận và xử lý yêu cầu vận chuyển của bạn.</li>
<li>Lập báo giá và trao đổi về phương án vận chuyển.</li>
<li>Điều phối phương tiện và theo dõi tiến trình giao hàng.</li>
<li>Liên hệ khi có thay đổi hoặc sự cố liên quan đến đơn hàng.</li>
<li>Lưu lịch sử giao dịch để bạn đối chiếu khi cần.</li>
<li>Bảo vệ hệ thống trước truy cập trái phép.</li>
</ul>
<p>Chúng tôi không sử dụng thông tin của bạn cho mục đích quảng cáo của bên thứ ba.</p>

<h2>3. Thông tin vị trí</h2>
<p>Hệ thống chỉ truy cập vị trí thiết bị của bạn sau khi bạn bấm đồng ý một cách rõ ràng, và chỉ tại thời điểm bạn chọn điểm lấy hoặc giao hàng trên bản đồ. Bạn luôn có thể nhập địa chỉ bằng tay thay vì cấp quyền vị trí.</p>
<p>Vị trí hiển thị khi theo dõi đơn hàng là <strong>vị trí của phương tiện đang vận chuyển</strong>, không phải thiết bị định vị gắn trên từng kiện hàng.</p>

<h2>4. Chia sẻ thông tin</h2>
<p>Chúng tôi chia sẻ thông tin của bạn trong phạm vi tối thiểu cần thiết:</p>
<ul>
<li><strong>Tài xế thực hiện chuyến:</strong> chỉ nhận thông tin cần cho việc giao nhận — tên người liên hệ, số điện thoại, địa chỉ. Tài xế không xem được dữ liệu tài chính hay thông tin khách hàng khác.</li>
<li><strong>Nhân viên vận hành:</strong> truy cập theo đúng vai trò được phân quyền.</li>
<li><strong>Cơ quan nhà nước:</strong> khi có yêu cầu hợp pháp bằng văn bản.</li>
</ul>
<p>Chúng tôi không bán, không cho thuê và không trao đổi thông tin cá nhân của bạn với bên thứ ba vì mục đích thương mại.</p>

<h2>5. Thời gian lưu trữ</h2>
<p>Thông tin đơn hàng và chứng từ được lưu theo quy định về lưu trữ chứng từ kinh doanh. Dữ liệu vị trí chi tiết được lưu trong thời gian giới hạn rồi làm mờ hoặc xóa theo chính sách nội bộ. Bạn có thể yêu cầu biết chính xác thời hạn áp dụng cho từng loại dữ liệu.</p>

<h2>6. Quyền của bạn</h2>
<p>Bạn có quyền yêu cầu chúng tôi:</p>
<ul>
<li>Cho biết chúng tôi đang lưu những thông tin nào về bạn.</li>
<li>Chỉnh sửa thông tin không chính xác.</li>
<li>Xuất dữ liệu của bạn ở định dạng đọc được.</li>
<li>Xóa hoặc ẩn danh dữ liệu, trong phạm vi pháp luật cho phép.</li>
<li>Thay đổi lựa chọn nhận thông báo.</li>
</ul>
<p>Gửi yêu cầu qua trang liên hệ hoặc hotline. Chúng tôi phản hồi trong thời gian hợp lý.</p>

<h2>7. Bảo mật</h2>
<p>Mật khẩu được mã hóa một chiều — kể cả nhân viên của chúng tôi cũng không đọc được. Kết nối tới website được mã hóa. Tài liệu và hình ảnh bạn tải lên được lưu ở khu vực riêng tư, chỉ truy cập được qua liên kết có thời hạn ngắn.</p>
<p>Dù vậy, không hệ thống nào an toàn tuyệt đối. Hãy dùng mật khẩu mạnh và không chia sẻ tài khoản.</p>

<h2>8. Thay đổi chính sách</h2>
<p>Khi có thay đổi đáng kể, chúng tôi thông báo trên website trước khi áp dụng.</p>`,
  },

  {
    slug: "dieu-khoan",
    title: "Điều khoản sử dụng",
    seoTitle: "Điều khoản sử dụng",
    seoDescription:
      "Điều kiện sử dụng website và nền tảng đặt dịch vụ vận chuyển hàng hóa.",
    content: `${DRAFT_NOTICE}
<h2>1. Phạm vi áp dụng</h2>
<p>Điều khoản này áp dụng cho việc sử dụng website và nền tảng đặt dịch vụ vận chuyển. Khi tạo tài khoản hoặc gửi yêu cầu báo giá, bạn xác nhận đã đọc và đồng ý với các nội dung dưới đây.</p>

<h2>2. Tài khoản</h2>
<ul>
<li>Bạn chịu trách nhiệm về tính chính xác của thông tin đăng ký.</li>
<li>Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động diễn ra dưới tài khoản của mình.</li>
<li>Thông báo cho chúng tôi ngay khi phát hiện tài khoản bị truy cập trái phép.</li>
<li>Tài khoản nhân viên do quản trị viên tạo, không đăng ký công khai.</li>
</ul>

<h2>3. Yêu cầu báo giá và đơn hàng</h2>
<p>Yêu cầu báo giá bạn gửi là <strong>đề nghị trao đổi</strong>, chưa phải hợp đồng. Đơn hàng chỉ hình thành khi hai bên thống nhất báo giá và thông tin hàng hóa, và chúng tôi xác nhận tiếp nhận.</p>
<p>Con số hiển thị trước khi xác nhận chỉ mang tính tham khảo. Chi phí chính thức phụ thuộc vào khối lượng, kích thước, quãng đường và điều kiện bốc xếp thực tế.</p>

<h2>4. Trách nhiệm của khách hàng</h2>
<ul>
<li>Cung cấp thông tin hàng hóa trung thực, đặc biệt là khối lượng, kích thước và tính chất đặc biệt của hàng.</li>
<li>Không gửi hàng hóa thuộc danh mục cấm vận chuyển theo quy định pháp luật.</li>
<li>Đóng gói phù hợp với tính chất hàng hóa, trừ khi có thỏa thuận riêng về dịch vụ đóng gói.</li>
<li>Bố trí người tiếp nhận tại điểm giao trong khung thời gian đã thống nhất.</li>
</ul>
<p>Khai báo sai thông tin hàng hóa có thể dẫn đến thay đổi chi phí, chậm trễ hoặc từ chối vận chuyển.</p>

<h2>5. Hàng hóa không nhận vận chuyển</h2>
<p>Chúng tôi không nhận vận chuyển hàng hóa thuộc danh mục cấm theo pháp luật Việt Nam, bao gồm nhưng không giới hạn: chất nổ, chất cháy, ma túy, vũ khí, động vật hoang dã và hàng hóa không có giấy tờ hợp lệ.</p>
<p>Danh mục chi tiết cần doanh nghiệp bổ sung.</p>

<h2>6. Sử dụng website</h2>
<p>Bạn không được:</p>
<ul>
<li>Truy cập hoặc cố truy cập dữ liệu của người dùng khác.</li>
<li>Dò tìm lỗ hổng, gửi yêu cầu tự động với tần suất bất thường.</li>
<li>Sao chép nội dung website cho mục đích thương mại khi chưa được đồng ý.</li>
</ul>

<h2>7. Trách nhiệm và bồi thường</h2>
<p><strong>Nội dung mục này chưa được soạn.</strong> Điều kiện bồi thường, mức trách nhiệm tối đa và quy trình khiếu nại cần doanh nghiệp thống nhất với bộ phận pháp chế và bảo hiểm trước khi công bố. Không được suy diễn cam kết từ các nội dung khác trên website.</p>

<h2>8. Giải quyết tranh chấp</h2>
<p>Hai bên ưu tiên thương lượng. Trường hợp không đạt được thỏa thuận, tranh chấp được giải quyết theo pháp luật Việt Nam tại cơ quan có thẩm quyền.</p>

<h2>9. Thay đổi điều khoản</h2>
<p>Chúng tôi có thể cập nhật điều khoản này. Bản mới có hiệu lực kể từ khi đăng tải, trừ khi có thông báo khác.</p>`,
  },

  {
    slug: "van-chuyen",
    title: "Chính sách vận chuyển",
    seoTitle: "Chính sách vận chuyển",
    seoDescription:
      "Quy định về tiếp nhận, đóng gói, thời gian giao nhận và xử lý sự cố trong quá trình vận chuyển.",
    content: `${DRAFT_NOTICE}
<h2>1. Tiếp nhận yêu cầu</h2>
<p>Yêu cầu vận chuyển được tiếp nhận qua website, hotline hoặc Zalo. Sau khi nhận được thông tin, nhân viên vận hành liên hệ xác nhận chi tiết hàng hóa trước khi lập báo giá.</p>

<h2>2. Xác nhận thông tin hàng hóa</h2>
<p>Trước khi điều phối phương tiện, hai bên cần thống nhất:</p>
<ul>
<li>Loại hàng, số kiện, khối lượng và kích thước ước tính.</li>
<li>Địa chỉ lấy và giao hàng, kèm điều kiện tiếp cận: tầng, thang máy, chiều rộng hẻm, khoảng cách bê hàng.</li>
<li>Thời gian mong muốn lấy và giao hàng.</li>
<li>Nhu cầu bốc xếp, đóng gói, tháo lắp nếu có.</li>
</ul>
<p>Thông tin càng chi tiết, phương án vận chuyển càng sát thực tế và ít phát sinh.</p>

<h2>3. Đóng gói</h2>
<p>Trừ khi có thỏa thuận về dịch vụ đóng gói, khách hàng chịu trách nhiệm đóng gói hàng hóa phù hợp với tính chất hàng và điều kiện vận chuyển. Hàng dễ vỡ, hàng có giá trị cao cần được thông báo trước và đóng gói tương xứng.</p>

<h2>4. Thời gian giao nhận</h2>
<p>Thời gian dự kiến được thống nhất khi xác nhận đơn hàng. Đây là <strong>thời gian dự kiến</strong>, có thể thay đổi do các yếu tố khách quan: thời tiết, ùn tắc, sự cố phương tiện, hạn chế giờ lưu thông của xe tải trong nội thành.</p>
<p>Khi có khả năng chậm trễ, chúng tôi thông báo sớm nhất có thể qua kênh liên hệ bạn đã đăng ký.</p>

<h2>5. Theo dõi đơn hàng</h2>
<p>Bạn tra cứu trạng thái bằng mã vận đơn tại trang Tra cứu. Khi đăng nhập, bạn xem được đầy đủ hành trình, hình ảnh theo từng giai đoạn và chứng từ giao nhận của đơn hàng thuộc tài khoản mình.</p>

<h2>6. Bằng chứng giao hàng</h2>
<p>Khi giao hàng, chúng tôi ghi nhận tên người nhận, thời điểm giao và hình ảnh hàng hóa tại điểm giao. Tùy loại dịch vụ, có thể yêu cầu thêm mã xác nhận hoặc chữ ký người nhận.</p>

<h2>7. Xử lý sự cố</h2>
<p>Khi phát sinh sự cố — chậm trễ, hư hỏng, không liên hệ được người nhận — tài xế lập biên bản kèm hình ảnh và báo về bộ phận vận hành. Chúng tôi liên hệ với bạn để thống nhất hướng xử lý.</p>
<p>Nếu phát hiện hàng hóa có vấn đề khi nhận, hãy ghi nhận ngay tại thời điểm giao và thông báo cho chúng tôi. Phản ánh muộn gây khó khăn cho việc xác minh.</p>

<h2>8. Hủy đơn</h2>
<p><strong>Điều kiện và mức phí hủy đơn chưa được quy định.</strong> Nội dung này cần doanh nghiệp thống nhất trước khi công bố.</p>`,
  },

  {
    slug: "cookie",
    title: "Chính sách cookie",
    seoTitle: "Chính sách cookie",
    seoDescription: "Các loại cookie website sử dụng và cách bạn kiểm soát chúng.",
    content: `${DRAFT_NOTICE}
<h2>1. Cookie là gì</h2>
<p>Cookie là tệp dữ liệu nhỏ mà website lưu trên trình duyệt của bạn để ghi nhớ trạng thái giữa các lần truy cập.</p>

<h2>2. Cookie website này sử dụng</h2>
<h3>Cookie thiết yếu</h3>
<p>Cần thiết để website hoạt động, không thể tắt:</p>
<table>
<thead><tr><th>Mục đích</th><th>Mô tả</th></tr></thead>
<tbody>
<tr><td>Phiên đăng nhập</td><td>Giữ trạng thái đăng nhập khi bạn di chuyển giữa các trang. Cookie này được đặt ở chế độ chỉ máy chủ đọc được, JavaScript trong trình duyệt không truy cập được.</td></tr>
<tr><td>Bảo mật</td><td>Chống giả mạo yêu cầu từ trang web khác.</td></tr>
</tbody>
</table>

<h3>Cookie phân tích và quảng cáo</h3>
<p><strong>Hiện tại website không sử dụng cookie phân tích hay quảng cáo.</strong> Nếu triển khai trong tương lai, chúng tôi sẽ hiển thị thông báo xin phép và chỉ kích hoạt sau khi bạn đồng ý.</p>

<h2>3. Kiểm soát cookie</h2>
<p>Bạn có thể xóa hoặc chặn cookie trong cài đặt trình duyệt. Lưu ý: chặn cookie thiết yếu sẽ khiến bạn không đăng nhập được.</p>

<h2>4. Cookie của bên thứ ba</h2>
<p>Khi website nhúng bản đồ hoặc nội dung từ nhà cung cấp bên ngoài, nhà cung cấp đó có thể đặt cookie riêng. Chúng tôi chỉ nhúng nội dung như vậy khi thực sự cần và sẽ nêu rõ tại vị trí nhúng.</p>`,
  },
];
