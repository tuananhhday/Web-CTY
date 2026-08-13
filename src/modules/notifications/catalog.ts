/**
 * Danh mục sự kiện thông báo (§21).
 *
 * Module thuần. Đây là nơi duy nhất quyết định một `eventKey` biến thành thông báo gì —
 * thêm sự kiện mới ở service mà quên khai báo ở đây thì worker sẽ báo lỗi rõ ràng thay vì
 * âm thầm bỏ qua.
 *
 * Nội dung viết trực tiếp bằng tiếng Việt thay vì đọc `NotificationTemplate` từ database:
 * bảng template dành cho nội dung doanh nghiệp tự sửa được (email marketing, wording theo
 * mùa vụ). Thông báo giao dịch trong ứng dụng thì cần ổn định và đi cùng code — sửa nội
 * dung phải qua review như sửa code, không phải sửa một dòng trong database.
 */

export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

/** Ai nhận thông báo này. */
export type Audience =
  /** Chủ đơn hàng / người gửi yêu cầu. */
  | "CUSTOMER"
  /** Tài xế đang được phân công. */
  | "DRIVER";

export interface NotificationContent {
  title: string;
  body: string;
  /**
   * Đường dẫn nội bộ khi bấm vào, THEO TỪNG NHÓM người nhận.
   *
   * Khách và tài xế xem cùng một chuyến ở hai khu vực khác nhau: `/tai-khoan/don-hang/...`
   * và `/tai-xe/chuyen/...`. Một link dùng chung sẽ dẫn tài xế tới trang họ không có quyền
   * vào — đúng lỗi đã gặp khi kiểm chứng worker lần đầu.
   */
  linkUrl: Partial<Record<Audience, string>>;
  severity: NotificationSeverity;
  audience: Audience[];
}

/** Payload tối thiểu mà mọi sự kiện shipment/quote/request đều mang theo. */
export interface EventPayload {
  trackingCode?: string;
  code?: string;
  quoteCode?: string;
  fromStatus?: string;
  toStatus?: string;
  outcome?: string;
  [key: string]: unknown;
}

type Builder = (payload: EventPayload) => NotificationContent | null;

/** Liên kết tới một chuyến, mỗi nhóm người nhận đi vào khu vực của mình. */
function shipmentLinks(payload: EventPayload): Partial<Record<Audience, string>> {
  if (!payload.trackingCode) return {};
  return {
    CUSTOMER: `/tai-khoan/don-hang/${payload.trackingCode}`,
    DRIVER: `/tai-xe/chuyen/${payload.trackingCode}`,
  };
}

function customerLink(path: string, code: string | undefined): Partial<Record<Audience, string>> {
  return code ? { CUSTOMER: `${path}/${code}` } : {};
}

/**
 * Danh mục sự kiện.
 *
 * Builder trả `null` nghĩa là sự kiện có thật nhưng lần này không cần báo cho ai — ví dụ
 * chuyển trạng thái nội bộ mà khách không quan tâm. Khác hẳn với sự kiện chưa khai báo,
 * vốn là lỗi lập trình.
 */
const CATALOG: Record<string, Builder> = {
  // --- Yêu cầu dịch vụ (§21) ---
  "request.submitted": (payload) => ({
    title: "Đã nhận yêu cầu của bạn",
    body: `Yêu cầu ${payload.code ?? ""} đã được tiếp nhận. Chúng tôi sẽ phản hồi trong thời gian sớm nhất.`,
    linkUrl: customerLink("/tai-khoan/yeu-cau", payload.code),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),

  "request.need_more_info": (payload) => ({
    title: "Cần bổ sung thông tin",
    body: `Yêu cầu ${payload.code ?? ""} cần thêm thông tin để chúng tôi báo giá chính xác.`,
    linkUrl: customerLink("/tai-khoan/yeu-cau", payload.code),
    severity: "WARNING",
    audience: ["CUSTOMER"],
  }),

  // --- Báo giá ---
  "quote.sent": (payload) => ({
    title: "Bạn có báo giá mới",
    body: `Báo giá ${payload.code ?? ""} đã sẵn sàng. Vui lòng xem và phản hồi.`,
    linkUrl: customerLink("/tai-khoan/bao-gia", payload.code),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "quote.revised": (payload) => ({
    title: "Báo giá đã được cập nhật",
    body: `Báo giá ${payload.code ?? ""} có phiên bản mới. Phiên bản cũ không còn hiệu lực.`,
    linkUrl: customerLink("/tai-khoan/bao-gia", payload.code),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "quote.expiring": (payload) => ({
    title: "Báo giá sắp hết hạn",
    body: `Báo giá ${payload.code ?? ""} sắp hết hiệu lực. Phản hồi sớm để giữ mức giá này.`,
    linkUrl: customerLink("/tai-khoan/bao-gia", payload.code),
    severity: "WARNING",
    audience: ["CUSTOMER"],
  }),

  /*
   * Khách chấp nhận hoặc từ chối báo giá là việc của NHÂN VIÊN, không phải của khách —
   * báo lại cho chính người vừa bấm nút là thừa.
   *
   * Chưa gửi cho nhân viên vì chưa quyết định được người nhận: gửi cho tất cả dispatcher
   * thì ồn, gửi cho người lập báo giá thì hỏng khi người đó nghỉ. Trong lúc chờ, hàng chờ
   * điều phối đã hiển thị ngay khối "Báo giá đã chốt, chờ tạo đơn" nên thông tin không mất.
   */
  "quote.accepted": () => null,
  "quote.declined": () => null,

  // --- Đơn hàng ---
  "shipment.created": (payload) => ({
    title: "Đơn hàng đã được tạo",
    body: `Đơn ${payload.trackingCode ?? ""} đã được lập từ báo giá bạn chấp nhận.`,
    linkUrl: shipmentLinks(payload),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),

  "shipment.confirmed": (payload) => ({
    title: "Đơn hàng đã xác nhận",
    body: `Đơn ${payload.trackingCode ?? ""} đã được xác nhận và đang chờ sắp xếp phương tiện.`,
    linkUrl: shipmentLinks(payload),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),

  "shipment.driver_assigned": (payload) => ({
    title: "Đã phân công tài xế",
    body: `Đơn ${payload.trackingCode ?? ""} đã có xe và tài xế phụ trách.`,
    linkUrl: shipmentLinks(payload),
    severity: "INFO",
    audience: ["CUSTOMER", "DRIVER"],
  }),

  "shipment.en_route_to_pickup": (payload) => ({
    title: "Xe đang tới điểm lấy hàng",
    body: `Tài xế đang trên đường tới lấy hàng cho đơn ${payload.trackingCode ?? ""}.`,
    linkUrl: shipmentLinks(payload),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "shipment.at_delivery": (payload) => ({
    title: "Xe đã tới điểm giao",
    body: `Đơn ${payload.trackingCode ?? ""} đã tới điểm giao. Vui lòng chuẩn bị nhận hàng.`,
    linkUrl: shipmentLinks(payload),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "shipment.in_transit": (payload) => ({
    title: "Hàng đang trên đường",
    body: `Đơn ${payload.trackingCode ?? ""} đang được vận chuyển.`,
    linkUrl: shipmentLinks(payload),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "shipment.completed": (payload) => ({
    title: "Đã giao hàng thành công",
    body: `Đơn ${payload.trackingCode ?? ""} đã hoàn tất. Cảm ơn bạn đã sử dụng dịch vụ.`,
    linkUrl: shipmentLinks(payload),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),

  "shipment.on_hold": (payload) => ({
    title: "Đơn hàng tạm dừng",
    body: `Đơn ${payload.trackingCode ?? ""} đang tạm dừng. Chúng tôi sẽ liên hệ với bạn.`,
    linkUrl: shipmentLinks(payload),
    severity: "WARNING",
    audience: ["CUSTOMER"],
  }),

  "shipment.incident": (payload) => ({
    title: "Chuyến hàng gặp sự cố",
    body: `Đơn ${payload.trackingCode ?? ""} đang gặp sự cố. Bộ phận điều phối đang xử lý.`,
    linkUrl: shipmentLinks(payload),
    severity: "ERROR",
    audience: ["CUSTOMER"],
  }),

  "shipment.failed": (payload) => ({
    title: "Chuyến hàng không thực hiện được",
    body: `Đơn ${payload.trackingCode ?? ""} không thực hiện được. Xem chi tiết lý do trong đơn hàng.`,
    linkUrl: shipmentLinks(payload),
    severity: "ERROR",
    audience: ["CUSTOMER"],
  }),

  "shipment.cancelled": (payload) => ({
    title: "Đơn hàng đã hủy",
    body: `Đơn ${payload.trackingCode ?? ""} đã được hủy.`,
    linkUrl: shipmentLinks(payload),
    severity: "WARNING",
    audience: ["CUSTOMER"],
  }),

  "shipment.proof_of_delivery_recorded": (payload) => ({
    title: "Đã có biên bản giao hàng",
    body: `Biên bản giao hàng cho đơn ${payload.trackingCode ?? ""} đã được lập.`,
    linkUrl: shipmentLinks(payload),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),

  // --- Hỗ trợ ---
  "ticket.replied": (payload) => ({
    title: "Yêu cầu hỗ trợ có phản hồi",
    body: `Phiếu hỗ trợ ${payload.code ?? ""} vừa có phản hồi mới.`,
    linkUrl: customerLink("/tai-khoan/ho-tro", payload.code),
    severity: "INFO",
    audience: ["CUSTOMER"],
  }),

  "ticket.resolved": (payload) => ({
    title: "Yêu cầu hỗ trợ đã xử lý xong",
    body: `Phiếu hỗ trợ ${payload.code ?? ""} đã được đánh dấu hoàn tất.`,
    linkUrl: customerLink("/tai-khoan/ho-tro", payload.code),
    severity: "SUCCESS",
    audience: ["CUSTOMER"],
  }),
};

/**
 * Trạng thái đơn hàng KHÔNG sinh thông báo cho khách.
 *
 * Đây là các bước nội bộ trong quá trình xếp dỡ. Báo hết thì khách nhận cả chục thông báo
 * trong một chuyến và sẽ tắt thông báo — mất luôn cả những cái quan trọng.
 */
const SILENT_SHIPMENT_STATUSES = [
  "scheduled",
  "at_pickup",
  "pickup_inspection",
  "packing",
  "loading",
  "secured_on_vehicle",
  "unloading",
  "delivered_pending_confirmation",
];

export class UnknownEventError extends Error {
  constructor(eventKey: string) {
    super(`Sự kiện chưa khai báo trong danh mục thông báo: ${eventKey}`);
    this.name = "UnknownEventError";
  }
}

/**
 * Dựng nội dung thông báo từ một sự kiện outbox.
 *
 * @throws UnknownEventError khi `eventKey` chưa được khai báo — lỗi lập trình, không phải
 *         lỗi runtime cần retry.
 */
export function buildNotification(
  eventKey: string,
  payload: EventPayload
): NotificationContent | null {
  const builder = CATALOG[eventKey];
  if (builder) return builder(payload);

  // Sự kiện shipment.* của các bước nội bộ: có thật nhưng cố ý không báo.
  const status = eventKey.startsWith("shipment.") ? eventKey.slice("shipment.".length) : null;
  if (status && SILENT_SHIPMENT_STATUSES.includes(status)) return null;

  // Sự kiện request.* của các bước nội bộ.
  if (eventKey.startsWith("request.")) return null;

  throw new UnknownEventError(eventKey);
}

export function isKnownEvent(eventKey: string): boolean {
  try {
    buildNotification(eventKey, {});
    return true;
  } catch {
    return false;
  }
}

/** Danh sách sự kiện đã khai báo — dùng cho tài liệu và test. */
export const DECLARED_EVENT_KEYS = Object.keys(CATALOG);
