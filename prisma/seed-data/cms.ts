/**
 * Dữ liệu khởi tạo cho nội dung website.
 *
 * KHÔNG chứa: số liệu thành tích, đánh giá khách hàng, logo đối tác, mức giá cụ thể,
 * số lượng xe hay tải trọng (§1). Những thứ đó chỉ được nhập từ trang quản trị sau khi
 * doanh nghiệp cung cấp dữ liệu thật.
 */

export interface ServiceAreaSeed {
  slug: string;
  name: string;
  province: string;
  district?: string;
  description?: string;
  note?: string;
  sortOrder: number;
}

/**
 * Khu vực phục vụ khởi tạo. Đây là các tỉnh thành hệ thống sẵn sàng tiếp nhận yêu cầu,
 * KHÔNG phải tuyên bố "phủ toàn quốc". Phạm vi cụ thể xác nhận theo từng yêu cầu (§8.8).
 */
export const serviceAreas: ServiceAreaSeed[] = [
  {
    slug: "ha-noi",
    name: "Hà Nội",
    province: "Hà Nội",
    description: "Tiếp nhận vận chuyển nội thành Hà Nội và các tuyến đi tỉnh lân cận.",
    note: "Xe tải bị hạn chế giờ lưu thông trong khu vực nội đô. Thời gian lấy và giao hàng được thống nhất theo khung giờ cho phép.",
    sortOrder: 1,
  },
  {
    slug: "hai-phong",
    name: "Hải Phòng",
    province: "Hải Phòng",
    description: "Tuyến kết nối Hà Nội – Hải Phòng và khu vực cảng.",
    sortOrder: 2,
  },
  {
    slug: "bac-ninh",
    name: "Bắc Ninh",
    province: "Bắc Ninh",
    description: "Phục vụ các khu công nghiệp và tuyến liên tỉnh phía Bắc.",
    sortOrder: 3,
  },
  {
    slug: "quang-ninh",
    name: "Quảng Ninh",
    province: "Quảng Ninh",
    description: "Tuyến Hà Nội – Quảng Ninh và khu vực Hạ Long, Cẩm Phả.",
    sortOrder: 4,
  },
  {
    slug: "da-nang",
    name: "Đà Nẵng",
    province: "Đà Nẵng",
    description: "Đầu mối trung chuyển khu vực miền Trung.",
    sortOrder: 5,
  },
  {
    slug: "tp-ho-chi-minh",
    name: "TP. Hồ Chí Minh",
    province: "TP. Hồ Chí Minh",
    description: "Tiếp nhận vận chuyển nội thành và các tuyến đi tỉnh phía Nam.",
    note: "Xe tải bị hạn chế giờ lưu thông trong khu vực nội đô. Thời gian lấy và giao hàng được thống nhất theo khung giờ cho phép.",
    sortOrder: 6,
  },
  {
    slug: "binh-duong",
    name: "Bình Dương",
    province: "Bình Dương",
    description: "Phục vụ các khu công nghiệp và tuyến kết nối TP. Hồ Chí Minh.",
    sortOrder: 7,
  },
  {
    slug: "dong-nai",
    name: "Đồng Nai",
    province: "Đồng Nai",
    description: "Tuyến TP. Hồ Chí Minh – Biên Hòa và khu vực lân cận.",
    sortOrder: 8,
  },
  {
    slug: "long-an",
    name: "Long An",
    province: "Long An",
    description: "Tuyến kết nối TP. Hồ Chí Minh với khu vực Tây Nam Bộ.",
    sortOrder: 9,
  },
  {
    slug: "can-tho",
    name: "Cần Thơ",
    province: "Cần Thơ",
    description: "Đầu mối khu vực Đồng bằng sông Cửu Long.",
    sortOrder: 10,
  },
];

export interface ContactChannelSeed {
  type: "HOTLINE" | "PHONE" | "EMAIL" | "ZALO" | "FACEBOOK" | "YOUTUBE" | "TIKTOK" | "OTHER";
  label: string;
  value: string;
  url?: string;
  isPrimary: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Kênh liên hệ khởi tạo dùng giá trị trong src/config/company.ts. Quản trị viên cập nhật
 * lại trong trang cấu hình khi có thông tin chính thức.
 */
export const contactChannels: ContactChannelSeed[] = [
  { type: "HOTLINE", label: "Hotline", value: "0968773550", isPrimary: true, isActive: true, sortOrder: 1 },
  { type: "ZALO", label: "Zalo", value: "0968773550", url: "https://zalo.me/0968773550", isPrimary: false, isActive: true, sortOrder: 2 },
  { type: "EMAIL", label: "Email", value: "tanh2811@gmail.com", isPrimary: true, isActive: true, sortOrder: 3 },
];

export interface OfficeSeed {
  name: string;
  kind: string;
  line: string;
  ward?: string;
  district?: string;
  province: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  isPublic: boolean;
  sortOrder: number;
}

export const offices: OfficeSeed[] = [
  {
    name: "Trụ sở chính",
    kind: "HEAD_OFFICE",
    line: "379 Đ. Giáp Hải",
    ward: "Bát Tràng",
    province: "Hà Nội",
    phone: "0968773550",
    email: "tanh2811@gmail.com",
    workingHours: "Thứ 2 – Thứ 7: 08:00 – 18:00 (nghỉ Chủ nhật và ngày lễ)",
    isPublic: true,
    sortOrder: 1,
  },
];

export interface NewsSeed {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  publishedAt: string;
  seoDescription: string;
}

export const newsCategories = [
  { slug: "huong-dan", name: "Hướng dẫn", description: "Bài viết hướng dẫn sử dụng dịch vụ", sortOrder: 1 },
  { slug: "kien-thuc-van-tai", name: "Kiến thức vận tải", description: "Thông tin hữu ích về vận chuyển hàng hóa", sortOrder: 2 },
];

export const newsPosts: NewsSeed[] = [
  {
    slug: "quy-trinh-tiep-nhan-yeu-cau-van-chuyen",
    title: "Quy trình tiếp nhận yêu cầu vận chuyển gồm những bước nào?",
    excerpt:
      "Từ lúc gửi yêu cầu đến khi hàng được giao, đơn hàng đi qua năm bước. Biết trước từng bước giúp bạn chuẩn bị thông tin đúng lúc.",
    categorySlug: "huong-dan",
    publishedAt: "2026-07-28T02:00:00.000Z",
    seoDescription:
      "Năm bước trong quy trình vận chuyển: gửi yêu cầu, xác nhận hàng hóa, nhận báo giá, điều phối phương tiện, theo dõi và giao hàng.",
    body: `<h2>Bước 1 — Gửi yêu cầu</h2>
<p>Bạn cung cấp điểm lấy hàng, điểm giao hàng, loại hàng và khối lượng dự kiến. Có thể gửi qua form trên website, hotline hoặc Zalo. Ở bước này chưa cần số liệu chính xác tuyệt đối — ước lượng gần đúng là đủ để bắt đầu.</p>

<h2>Bước 2 — Xác nhận hàng hóa</h2>
<p>Nhân viên vận hành liên hệ để làm rõ những điểm ảnh hưởng trực tiếp đến chi phí và phương án:</p>
<ul>
<li>Số kiện và kích thước từng kiện.</li>
<li>Hàng có dễ vỡ hoặc cần điều kiện bảo quản riêng không.</li>
<li>Điều kiện tại hai đầu: tầng mấy, có thang máy không, xe đỗ cách cửa bao xa, hẻm có đủ rộng cho xe tải không.</li>
</ul>
<p>Đây là bước hay bị bỏ qua nhưng lại quyết định phần lớn chi phí bốc xếp. Một chuyến hàng lên tầng 5 không thang máy khác hẳn cùng khối lượng đó ở tầng trệt.</p>

<h2>Bước 3 — Nhận báo giá</h2>
<p>Báo giá được lập dựa trên thông tin đã xác nhận, tách rõ từng khoản: cước vận chuyển, nhân công bốc xếp, phụ phí nếu có. Báo giá có thời hạn hiệu lực. Nếu cần điều chỉnh, chúng tôi lập phiên bản mới thay vì sửa đè lên bản cũ, để hai bên luôn đối chiếu được.</p>

<h2>Bước 4 — Điều phối phương tiện</h2>
<p>Sau khi bạn chấp nhận báo giá, hệ thống tạo đơn hàng và điều phối xe phù hợp với khối lượng, kích thước và lộ trình. Bạn nhận được thông tin xe và tài xế khi chuyến bắt đầu.</p>

<h2>Bước 5 — Theo dõi và giao hàng</h2>
<p>Bạn tra cứu trạng thái bằng mã vận đơn. Khi đăng nhập, bạn xem được hành trình chi tiết và hình ảnh hàng hóa theo từng giai đoạn. Khi giao xong, chứng từ giao nhận được lưu trong tài khoản để bạn đối chiếu về sau.</p>

<h2>Chuẩn bị trước giúp rút ngắn thời gian</h2>
<p>Phần lớn thời gian chờ báo giá nằm ở bước 2 — trao đổi qua lại để làm rõ thông tin. Nếu bạn chuẩn bị sẵn ảnh hàng hóa và mô tả điều kiện tiếp cận ngay từ bước 1, quá trình này rút ngắn đáng kể.</p>`,
  },
  {
    slug: "chuan-bi-thong-tin-hang-hoa-truoc-khi-bao-gia",
    title: "Chuẩn bị thông tin hàng hóa trước khi yêu cầu báo giá",
    excerpt:
      "Bốn nhóm thông tin quyết định chi phí vận chuyển. Chuẩn bị trước giúp báo giá sát thực tế và hạn chế phát sinh khi xe đến.",
    categorySlug: "huong-dan",
    publishedAt: "2026-08-02T02:00:00.000Z",
    seoDescription:
      "Những thông tin cần chuẩn bị trước khi yêu cầu báo giá vận chuyển: khối lượng, kích thước, tính chất hàng và điều kiện tiếp cận.",
    body: `<h2>Vì sao thông tin ban đầu quan trọng</h2>
<p>Chi phí vận chuyển không chỉ phụ thuộc quãng đường. Hai chuyến cùng tuyến, cùng khối lượng vẫn có thể chênh nhau đáng kể nếu điều kiện bốc xếp khác nhau. Thông tin đầy đủ ngay từ đầu giúp báo giá sát thực tế, tránh phát sinh khi xe đã đến nơi.</p>

<h2>1. Khối lượng và số kiện</h2>
<p>Ước lượng tổng khối lượng và số kiện hàng. Không cần chính xác đến từng ký, nhưng chênh lệch lớn sẽ dẫn đến chọn sai loại xe. Nếu hàng đóng thùng đồng nhất, đếm số thùng và cân thử một thùng là đủ để suy ra.</p>

<h2>2. Kích thước</h2>
<p>Với hàng cồng kềnh, kích thước quan trọng hơn khối lượng. Một kiện hàng nhẹ nhưng dài 4 mét sẽ cần loại xe khác hẳn. Đo chiều dài, rộng, cao của kiện lớn nhất và cho biết tổng thể tích ước tính nếu có.</p>

<h2>3. Tính chất hàng hóa</h2>
<p>Cho biết hàng có thuộc nhóm nào dưới đây không:</p>
<ul>
<li>Dễ vỡ — cần chèn lót và xếp riêng.</li>
<li>Giá trị cao — cần lưu ý khi xếp dỡ và bàn giao.</li>
<li>Cần tránh mưa nắng — quyết định chọn xe thùng kín hay thùng bạt.</li>
<li>Có hình dạng bất thường, không xếp chồng được.</li>
</ul>

<h2>4. Điều kiện tiếp cận — phần hay bị bỏ sót</h2>
<p>Đây là nhóm thông tin gây phát sinh nhiều nhất. Hãy cho biết ở cả điểm lấy và điểm giao:</p>
<ul>
<li>Tầng mấy, có thang máy không. Nếu có, thang máy có chở được kiện hàng lớn nhất không.</li>
<li>Xe tải đỗ được cách cửa bao xa. Quãng đường bê hàng 50 mét khác hẳn 5 mét.</li>
<li>Đường vào có phải hẻm không, hẻm rộng bao nhiêu.</li>
<li>Khu vực có hạn chế giờ xe tải ra vào không.</li>
</ul>

<h2>Ảnh hàng hóa giúp ích nhiều</h2>
<p>Một tấm ảnh chụp toàn cảnh lô hàng thường nói được nhiều hơn vài dòng mô tả. Nhân viên nhìn ảnh có thể ước lượng thể tích, nhận ra hàng cần xếp riêng và phát hiện điều kiện tiếp cận mà bạn quên nhắc tới.</p>
<p>Bạn có thể đính kèm ảnh trực tiếp vào yêu cầu báo giá. Ảnh chỉ dùng để nhân viên đánh giá, không thay thế cho việc cân đo khi nhận hàng.</p>`,
  },
  {
    slug: "chon-loai-xe-tai-phu-hop-voi-hang-hoa",
    title: "Chọn loại xe tải phù hợp với hàng hóa của bạn",
    excerpt:
      "Thùng kín hay thùng bạt, xe nhẹ hay xe trung — lựa chọn phụ thuộc vào tính chất hàng và điều kiện đường đi, không chỉ khối lượng.",
    categorySlug: "kien-thuc-van-tai",
    publishedAt: "2026-08-08T02:00:00.000Z",
    seoDescription:
      "So sánh xe thùng kín, thùng bạt và các nhóm tải trọng để chọn phương tiện phù hợp với loại hàng cần vận chuyển.",
    body: `<h2>Khối lượng chỉ là một yếu tố</h2>
<p>Nhiều người chọn xe theo khối lượng hàng. Thực tế, ba yếu tố cùng quyết định: khối lượng, thể tích và tính chất hàng. Hàng nhẹ nhưng cồng kềnh có thể lấp đầy thùng xe trước khi chạm giới hạn tải trọng.</p>

<h2>Thùng kín hay thùng bạt</h2>
<h3>Xe thùng kín</h3>
<p>Che chắn hoàn toàn khỏi mưa nắng và bụi. Phù hợp với hàng điện tử, thực phẩm đóng gói, tài liệu, đồ nội thất hoàn thiện. Nhược điểm: chỉ bốc dỡ được từ phía sau, khó xếp hàng quá khổ.</p>

<h3>Xe thùng bạt</h3>
<p>Mở được từ nhiều phía nên bốc dỡ nhanh, xếp được hàng vượt chiều cao thùng. Phù hợp với vật liệu xây dựng, hàng cồng kềnh, hàng cần xe nâng đưa vào từ bên hông. Che chắn kém hơn thùng kín.</p>

<h2>Các nhóm tải trọng</h2>
<p>Hệ thống phân theo ba nhóm chính:</p>
<ul>
<li><strong>Xe tải nhẹ</strong> — hàng khối lượng nhỏ, giao nhận trong nội thành. Cơ động trong hẻm nhỏ.</li>
<li><strong>Xe tải trung</strong> — khối lượng vừa, phù hợp cả nội thành lẫn liên tỉnh gần.</li>
<li><strong>Xe tải nặng</strong> — khối lượng lớn, tuyến liên tỉnh đường dài. Cần lưu ý đường vào có đủ rộng không.</li>
</ul>
<p>Tải trọng cụ thể của từng nhóm được xác nhận khi báo giá, tùy phương tiện thực tế điều phối được.</p>

<h2>Yếu tố dễ bị bỏ qua: đường vào</h2>
<p>Chọn xe lớn để chở hết trong một chuyến nghe có vẻ tiết kiệm, nhưng nếu xe không vào được hẻm thì phải trung chuyển — tốn thêm nhân công và thời gian. Ngược lại, chia thành nhiều chuyến xe nhỏ đôi khi rẻ hơn và nhanh hơn.</p>
<p>Hãy mô tả đường vào ở cả hai đầu khi yêu cầu báo giá. Nhân viên vận hành sẽ cân nhắc phương án tổng thể thay vì chỉ nhìn vào khối lượng.</p>

<h2>Khi nào cần phương tiện chuyên dụng</h2>
<p>Hàng quá khổ, quá tải hoặc cần thiết bị hỗ trợ riêng — như máy móc công nghiệp, kết cấu thép dài — cần khảo sát thực tế trước khi chốt phương án. Trong trường hợp này, gửi ảnh và kích thước chi tiết ngay từ đầu sẽ tiết kiệm thời gian cho cả hai bên.</p>`,
  },
];
