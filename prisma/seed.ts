/**
 * Seed dữ liệu nền tảng (§33).
 *
 * Nguyên tắc:
 *   - Chạy lặp nhiều lần không tạo bản ghi trùng (dùng upsert theo khoá tự nhiên).
 *   - KHÔNG tạo đánh giá, số liệu thành tích, logo đối tác hay bảng giá giả (§1).
 *   - Nội dung doanh nghiệp để trống và đánh dấu trong `pendingFields` để quản trị
 *     viên biết cần cập nhật.
 *   - Mật khẩu tài khoản development đọc từ biến môi trường, không hardcode.
 *   - Không seed dữ liệu cho "Tìm hàng hoá Facebook" và AI định giá ảnh (§33).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma";
import { sanitizeRichText } from "../src/lib/sanitize";
import { staticPages } from "./seed-data/static-pages";
import {
  serviceAreas,
  contactChannels,
  offices,
  newsCategories,
  newsPosts,
} from "./seed-data/cms";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Thiếu DATABASE_URL. Sao chép .env.example thành .env trước khi seed.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// -----------------------------------------------------------------------------
// Dịch vụ — danh mục khởi tạo, doanh nghiệp xác nhận lại trước khi công bố (§1)
// -----------------------------------------------------------------------------
const services: Prisma.ServiceCreateInput[] = [
  {
    slug: "van-chuyen-hang-hoa",
    name: "Vận chuyển hàng hóa",
    shortDescription: "Vận chuyển hàng hóa theo chuyến trong nội thành và liên tỉnh.",
    description:
      "Tiếp nhận yêu cầu vận chuyển hàng hóa, đề xuất phương tiện phù hợp với khối lượng và tính chất hàng, theo dõi trạng thái đến khi giao xong.",
    icon: "Truck",
    highlights: [
      "Xác nhận thông tin hàng hóa trước khi báo giá",
      "Theo dõi trạng thái vận chuyển tập trung",
      "Lưu lịch sử yêu cầu và báo giá",
    ],
    status: "PUBLISHED",
    sortOrder: 1,
    publishedAt: new Date(),
  },
  {
    slug: "chuyen-nha-chuyen-van-phong",
    name: "Chuyển nhà, chuyển văn phòng",
    shortDescription: "Hỗ trợ di chuyển toàn bộ tài sản khi đổi địa điểm ở hoặc làm việc.",
    description:
      "Khảo sát khối lượng đồ đạc, lập danh sách theo nhóm, đề xuất phương án đóng gói, tháo lắp và bốc xếp phù hợp với điều kiện tầng, thang máy và lối tiếp cận.",
    icon: "Warehouse",
    highlights: [
      "Lập danh sách đồ đạc có cấu trúc",
      "Ghi nhận điều kiện tầng và lối tiếp cận",
      "Hỗ trợ đặt lịch khảo sát trực tiếp",
    ],
    isMovingService: true,
    status: "PUBLISHED",
    sortOrder: 2,
    publishedAt: new Date(),
  },
  {
    slug: "thue-xe-tai-theo-chuyen",
    name: "Thuê xe tải theo chuyến",
    shortDescription: "Thuê phương tiện riêng cho một chuyến, chủ động lịch trình.",
    description:
      "Dành cho khách hàng cần xe riêng cho một chuyến vận chuyển cụ thể, chủ động thời gian lấy hàng, lộ trình và điểm giao.",
    icon: "CalendarClock",
    highlights: [
      "Chủ động thời gian và lộ trình",
      "Nhiều nhóm xe theo khối lượng hàng",
      "Báo giá theo chuyến sau khi xác nhận thông tin",
    ],
    status: "PUBLISHED",
    sortOrder: 3,
    publishedAt: new Date(),
  },
  {
    slug: "van-chuyen-doanh-nghiep",
    name: "Vận chuyển cho doanh nghiệp",
    shortDescription: "Giải pháp luân chuyển hàng định kỳ cho khách hàng doanh nghiệp.",
    description:
      "Dành cho doanh nghiệp cần luân chuyển hàng thường xuyên, có đầu mối phối hợp cố định và lịch sử vận chuyển lưu trữ tập trung để đối chiếu.",
    icon: "Building2",
    highlights: [
      "Đầu mối phối hợp cố định",
      "Hỗ trợ nhiều điểm giao nhận trong một yêu cầu",
      "Lưu trữ chứng từ và lịch sử vận chuyển",
    ],
    status: "PUBLISHED",
    sortOrder: 4,
    publishedAt: new Date(),
  },
  {
    slug: "boc-xep-nhan-cong",
    name: "Bốc xếp và nhân công",
    shortDescription: "Cung cấp nhân công bốc xếp, đóng gói và tháo lắp theo yêu cầu.",
    description:
      "Dịch vụ nhân công đi kèm hoặc tách rời khỏi vận chuyển, tính theo giờ, ca hoặc khối lượng tùy điều kiện thực tế tại điểm lấy và điểm giao.",
    icon: "PackageSearch",
    highlights: [
      "Tính theo giờ, ca hoặc khối lượng",
      "Ghi nhận điều kiện tầng và khoảng cách bê hàng",
      "Thống nhất số nhân công trước khi thực hiện",
    ],
    status: "PUBLISHED",
    sortOrder: 5,
    publishedAt: new Date(),
  },
  {
    slug: "hang-cong-kenh",
    name: "Hàng cồng kềnh theo yêu cầu",
    shortDescription: "Vận chuyển hàng kích thước lớn, cần khảo sát phương án riêng.",
    description:
      "Dành cho hàng hóa vượt kích thước hoặc khối lượng thông thường, cần khảo sát thực tế để chọn phương tiện và thiết bị hỗ trợ phù hợp.",
    icon: "MapPinned",
    highlights: [
      "Khảo sát trước khi đề xuất phương án",
      "Đề xuất phương tiện chuyên dụng",
      "Xác nhận chi tiết trước khi báo giá",
    ],
    status: "PUBLISHED",
    sortOrder: 6,
    publishedAt: new Date(),
  },
];

// -----------------------------------------------------------------------------
// Nhóm phương tiện — KHÔNG điền tải trọng vì chưa có dữ liệu thật (§1, §14.1)
// -----------------------------------------------------------------------------
const vehicleTypes: Prisma.VehicleTypeCreateInput[] = [
  {
    slug: "xe-tai-nhe",
    name: "Xe tải nhẹ",
    category: "LIGHT_TRUCK",
    description: "Phù hợp hàng khối lượng nhỏ, giao nhận trong nội thành.",
    suitableFor: ["Hàng tiêu dùng", "Đơn hàng thương mại điện tử", "Giao nhận trong ngày"],
    status: "PUBLISHED",
    sortOrder: 1,
  },
  {
    slug: "xe-tai-trung",
    name: "Xe tải trung",
    category: "MEDIUM_TRUCK",
    description: "Phù hợp khối lượng vừa, tuyến nội thành và liên tỉnh gần.",
    suitableFor: ["Hàng bách hóa", "Vận chuyển theo lô vừa"],
    status: "PUBLISHED",
    sortOrder: 2,
  },
  {
    slug: "xe-tai-nang",
    name: "Xe tải nặng",
    category: "HEAVY_TRUCK",
    description: "Phù hợp khối lượng lớn, tuyến liên tỉnh đường dài.",
    suitableFor: ["Hàng công nghiệp", "Tuyến liên tỉnh đường dài"],
    status: "PUBLISHED",
    sortOrder: 3,
  },
  {
    slug: "xe-thung-kin",
    name: "Xe thùng kín",
    category: "BOX_TRUCK",
    description: "Che chắn hàng khỏi thời tiết, phù hợp hàng cần bảo vệ.",
    bodyType: "CLOSED_BOX",
    suitableFor: ["Hàng tránh mưa nắng", "Hàng dễ hư hỏng do thời tiết"],
    status: "PUBLISHED",
    sortOrder: 4,
  },
  {
    slug: "xe-thung-bat",
    name: "Xe thùng bạt",
    category: "TARPAULIN_TRUCK",
    description: "Linh hoạt bốc dỡ, phù hợp hàng cồng kềnh.",
    bodyType: "TARPAULIN",
    suitableFor: ["Hàng cồng kềnh", "Vật liệu xây dựng", "Hàng cần bốc dỡ nhanh"],
    status: "PUBLISHED",
    sortOrder: 5,
  },
  {
    slug: "phuong-tien-chuyen-dung",
    name: "Phương tiện chuyên dụng",
    category: "SPECIALIZED",
    description: "Dành cho hàng có yêu cầu vận chuyển đặc thù, cần khảo sát riêng.",
    suitableFor: ["Hàng quá khổ", "Hàng cần thiết bị hỗ trợ riêng"],
    status: "PUBLISHED",
    sortOrder: 6,
  },
];

const faqs: Prisma.FaqCreateInput[] = [
  {
    question: "Tôi cần cung cấp thông tin gì để nhận báo giá?",
    answer:
      "Điểm lấy hàng, điểm giao hàng, loại hàng và khối lượng dự kiến. Thông tin càng chi tiết thì báo giá càng nhanh và sát thực tế.",
    category: "Báo giá",
    status: "PUBLISHED",
    sortOrder: 1,
  },
  {
    question: "Chi phí vận chuyển phụ thuộc vào những yếu tố nào?",
    answer:
      "Khoảng cách, loại phương tiện, khối lượng, tính chất hàng hóa và điều kiện bốc xếp tại hai đầu. Mức giá chính thức được xác nhận sau khi kiểm tra đầy đủ thông tin.",
    category: "Báo giá",
    status: "PUBLISHED",
    sortOrder: 2,
  },
  {
    question: "Làm thế nào để tra cứu đơn hàng?",
    answer:
      "Nhập mã vận đơn cùng bước xác minh tại trang Tra cứu. Khi đăng nhập, bạn xem được đầy đủ hành trình, hình ảnh và chứng từ của đơn hàng thuộc tài khoản mình.",
    category: "Đơn hàng",
    status: "PUBLISHED",
    sortOrder: 3,
  },
  {
    question: "Tôi có thể gửi kèm ảnh hàng hóa không?",
    answer:
      "Có. Ảnh hàng hóa giúp nhân viên đánh giá khối lượng, kích thước và điều kiện bốc xếp chính xác hơn khi lập báo giá.",
    category: "Báo giá",
    status: "PUBLISHED",
    sortOrder: 4,
  },
  {
    question: "Khi nào đơn hàng được xác nhận?",
    answer:
      "Sau khi hai bên thống nhất báo giá và thông tin hàng hóa, đơn hàng được tạo và chuyển sang bước điều phối phương tiện.",
    category: "Đơn hàng",
    status: "PUBLISHED",
    sortOrder: 5,
  },
  {
    question: "Tôi theo dõi vị trí xe bằng cách nào?",
    answer:
      "Khi chuyến đang hoạt động và chính sách chia sẻ vị trí được bật, bạn xem được vị trí của xe trên bản đồ trong tài khoản. Đây là vị trí phương tiện, không phải thiết bị gắn trên từng kiện hàng.",
    category: "Đơn hàng",
    status: "PUBLISHED",
    sortOrder: 6,
  },
];

/** Trạng thái/khoá cấu hình hệ thống. Allowlist, tuyệt đối không chứa secret (§24.8). */
const systemSettings: { key: string; value: Prisma.InputJsonValue; isPublic: boolean; description: string }[] = [
  {
    key: "quote.approval_threshold_vnd",
    value: 20_000_000,
    isPublic: false,
    description: "Tổng tiền báo giá vượt ngưỡng này phải có người duyệt (§13.3).",
  },
  {
    key: "quote.max_discount_percent",
    value: 15,
    isPublic: false,
    description: "Mức giảm giá vượt ngưỡng này phải có người duyệt (§13.3).",
  },
  {
    key: "quote.default_validity_days",
    value: 7,
    isPublic: false,
    description: "Số ngày hiệu lực mặc định của một báo giá.",
  },
  {
    key: "tracking.public_requires_verification",
    value: true,
    isPublic: false,
    description: "Tra cứu công khai bắt buộc bước xác minh bổ sung (§16.1).",
  },
  {
    key: "shipment.require_pod_before_complete",
    value: true,
    isPublic: false,
    description: "Bắt buộc có bằng chứng giao hàng trước khi hoàn tất chuyến (§15).",
  },
  {
    key: "support.sla_first_response_hours",
    value: 8,
    isPublic: false,
    description: "Thời hạn phản hồi đầu tiên cho ticket hỗ trợ (§19).",
  },
  {
    key: "site.pricing_is_reference_only",
    value: true,
    isPublic: true,
    description: "Hiển thị cảnh báo bảng giá chỉ mang tính tham khảo (§13.1).",
  },
];

async function seedCompanyProfile() {
  const existing = await db.companyProfile.findFirst();
  if (existing) {
    console.log("  · CompanyProfile đã tồn tại, giữ nguyên dữ liệu quản trị viên đã nhập");
    return;
  }

  // Không tự bịa tên pháp nhân, mã số thuế hay giấy phép (§1).
  await db.companyProfile.create({
    data: {
      legalName: "Cần doanh nghiệp cập nhật",
      brandName: "Cần doanh nghiệp cập nhật",
      slogan: null,
      description: null,
      pendingFields: [
        "legalName",
        "brandName",
        "slogan",
        "description",
        "taxCode",
        "businessLicense",
        "transportLicense",
        "logoKey",
      ],
    },
  });
  console.log("  · Tạo CompanyProfile rỗng, đánh dấu 8 trường chờ cập nhật");
}

async function seedServices() {
  for (const service of services) {
    await db.service.upsert({
      where: { slug: service.slug },
      update: {},
      create: service,
    });
  }
  console.log(`  · ${services.length} dịch vụ`);
}

async function seedVehicleTypes() {
  for (const vehicleType of vehicleTypes) {
    await db.vehicleType.upsert({
      where: { slug: vehicleType.slug },
      update: {},
      create: vehicleType,
    });
  }
  console.log(`  · ${vehicleTypes.length} nhóm phương tiện (chưa có tải trọng thật)`);
}

async function seedFaqs() {
  for (const faq of faqs) {
    const existing = await db.faq.findFirst({ where: { question: faq.question } });
    if (!existing) {
      await db.faq.create({ data: faq });
    }
  }
  console.log(`  · ${faqs.length} câu hỏi thường gặp`);
}

async function seedSystemSettings() {
  for (const setting of systemSettings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: { description: setting.description, isPublic: setting.isPublic },
      create: setting,
    });
  }
  console.log(`  · ${systemSettings.length} khoá cấu hình hệ thống`);
}

async function seedNotificationTemplates() {
  const templates: Prisma.NotificationTemplateCreateInput[] = [
    {
      eventKey: "request.submitted",
      channel: "IN_APP",
      subject: "Đã tiếp nhận yêu cầu {{requestCode}}",
      bodyText:
        "Yêu cầu {{requestCode}} đã được ghi nhận. Nhân viên sẽ liên hệ xác nhận thông tin hàng hóa.",
    },
    {
      eventKey: "quote.sent",
      channel: "IN_APP",
      subject: "Báo giá {{quoteCode}} đã sẵn sàng",
      bodyText: "Báo giá {{quoteCode}} đã được gửi. Vui lòng xem và phản hồi trước {{expiresAt}}.",
    },
    {
      eventKey: "shipment.driver_assigned",
      channel: "IN_APP",
      subject: "Đơn {{trackingCode}} đã có tài xế",
      bodyText: "Đơn hàng {{trackingCode}} đã được phân công tài xế và chuẩn bị khởi hành.",
    },
    {
      eventKey: "shipment.delivered",
      channel: "IN_APP",
      subject: "Đơn {{trackingCode}} đã giao thành công",
      bodyText: "Đơn hàng {{trackingCode}} đã được giao. Bạn có thể xem bằng chứng giao hàng trong tài khoản.",
    },
    {
      eventKey: "invoice.issued",
      channel: "IN_APP",
      subject: "Hóa đơn {{invoiceNumber}} đã phát hành",
      bodyText: "Hóa đơn {{invoiceNumber}} đã được phát hành, hạn thanh toán {{dueAt}}.",
    },
    {
      eventKey: "ticket.replied",
      channel: "IN_APP",
      subject: "Yêu cầu hỗ trợ {{ticketCode}} có phản hồi",
      bodyText: "Yêu cầu hỗ trợ {{ticketCode}} vừa nhận được phản hồi mới.",
    },
  ];

  for (const template of templates) {
    await db.notificationTemplate.upsert({
      where: {
        eventKey_channel_locale_version: {
          eventKey: template.eventKey,
          channel: template.channel as "IN_APP",
          locale: "vi",
          version: 1,
        },
      },
      update: {},
      create: template,
    });
  }
  console.log(`  · ${templates.length} mẫu thông báo`);
}

async function seedServiceAreas() {
  for (const area of serviceAreas) {
    await db.serviceArea.upsert({
      where: { slug: area.slug },
      update: {},
      create: { ...area, status: "PUBLISHED" },
    });
  }
  console.log(`  · ${serviceAreas.length} khu vực phục vụ`);
}

async function seedContactChannels() {
  for (const channel of contactChannels) {
    const existing = await db.contactChannel.findFirst({
      where: { type: channel.type, value: channel.value },
    });
    if (!existing) {
      await db.contactChannel.create({ data: channel });
    }
  }
  console.log(`  · ${contactChannels.length} kênh liên hệ`);
}

async function seedOffices() {
  for (const office of offices) {
    const existing = await db.office.findFirst({ where: { name: office.name } });
    if (!existing) {
      await db.office.create({ data: office });
    }
  }
  console.log(`  · ${offices.length} văn phòng`);
}

async function seedStaticPages() {
  for (const page of staticPages) {
    await db.staticPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        title: page.title,
        // Sanitize ngay khi lưu — dữ liệu trong database luôn sạch (§10).
        content: sanitizeRichText(page.content),
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }
  console.log(`  · ${staticPages.length} trang tĩnh (bản nháp pháp lý chờ duyệt)`);
}

async function seedNews() {
  for (const category of newsCategories) {
    await db.newsCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  for (const post of newsPosts) {
    const category = await db.newsCategory.findUnique({
      where: { slug: post.categorySlug },
      select: { id: true },
    });

    await db.newsPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: sanitizeRichText(post.body),
        categoryId: category?.id ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(post.publishedAt),
        seoDescription: post.seoDescription,
      },
    });
  }
  console.log(`  · ${newsCategories.length} chuyên mục, ${newsPosts.length} bài viết`);
}

/**
 * Bảng giá: tạo catalog và một phiên bản RỖNG đánh dấu "chỉ tham khảo".
 * KHÔNG seed mức giá cụ thể vì chưa có dữ liệu thật từ doanh nghiệp (§1).
 */
async function seedPriceCatalogs() {
  const catalogs = [
    {
      slug: "bang-gia-van-chuyen",
      name: "Bảng giá vận chuyển",
      description: "Giá cước vận chuyển theo nhóm phương tiện và tuyến đường.",
    },
    {
      slug: "bang-gia-boc-xep",
      name: "Bảng giá bốc xếp và nhân công",
      description: "Chi phí nhân công bốc xếp, đóng gói và tháo lắp.",
    },
  ];

  for (const catalog of catalogs) {
    const record = await db.priceCatalog.upsert({
      where: { slug: catalog.slug },
      update: {},
      create: catalog,
    });

    const existingVersion = await db.priceCatalogVersion.findFirst({
      where: { priceCatalogId: record.id, versionNumber: 1 },
    });

    if (!existingVersion) {
      await db.priceCatalogVersion.create({
        data: {
          priceCatalogId: record.id,
          versionNumber: 1,
          effectiveFrom: new Date(),
          status: "PUBLISHED",
          publishedAt: new Date(),
          isReferenceOnly: true,
          note: "Chưa có mức giá chính thức. Doanh nghiệp cần nhập bảng giá thật trong trang quản trị trước khi công bố.",
        },
      });
    }
  }
  console.log(`  · ${catalogs.length} bảng giá (phiên bản rỗng, chờ doanh nghiệp nhập)`);
}

async function main() {
  console.log("\nBắt đầu seed dữ liệu nền tảng...\n");

  await seedCompanyProfile();
  await seedServices();
  await seedVehicleTypes();
  await seedServiceAreas();
  await seedContactChannels();
  await seedOffices();
  await seedFaqs();
  await seedStaticPages();
  await seedNews();
  await seedPriceCatalogs();
  await seedSystemSettings();
  await seedNotificationTemplates();

  if (IS_PRODUCTION) {
    console.log(
      "\nMôi trường production: bỏ qua tài khoản development.\n" +
        "Tài khoản quản trị đầu tiên phải được tạo qua quy trình có kiểm soát.\n"
    );
  } else {
    console.log(
      "\nTài khoản development chưa được tạo ở bước này.\n" +
        "Better Auth sẽ đảm nhiệm việc hash mật khẩu — seed tài khoản triển khai ở Pha 2.\n"
    );
  }

  console.log("Seed hoàn tất.\n");
  console.log("Lưu ý: nội dung doanh nghiệp (tên, MST, hotline, địa chỉ, bảng giá, đội xe)");
  console.log("để trống có chủ đích. Quản trị viên nhập trong trang /quan-tri/cau-hinh.\n");
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
