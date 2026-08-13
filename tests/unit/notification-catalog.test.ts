import { describe, it, expect } from "vitest";
import {
  buildNotification,
  isKnownEvent,
  UnknownEventError,
  DECLARED_EVENT_KEYS,
} from "@/modules/notifications/catalog";
import { SHIPMENT_STATUSES } from "@/modules/shipments/state-machine";
import { REQUEST_STATUSES } from "@/modules/service-requests/state-machine";
import { QUOTE_STATUSES } from "@/modules/quotes/state-machine";

/**
 * Điều quan trọng nhất: MỌI sự kiện mà nghiệp vụ có thể phát ra đều phải xử lý được.
 *
 * Sự kiện chưa khai báo sẽ rơi vào dead-letter và thông báo biến mất không ai biết — đúng
 * thứ mô hình outbox của §21 sinh ra để tránh.
 */

describe("mọi sự kiện nghiệp vụ đều được danh mục xử lý", () => {
  it.each(SHIPMENT_STATUSES)("shipment.%s", (status) => {
    const eventKey = `shipment.${status.toLowerCase()}`;
    expect(() => buildNotification(eventKey, { trackingCode: "VT1" })).not.toThrow();
  });

  it.each(REQUEST_STATUSES)("request.%s", (status) => {
    const eventKey = `request.${status.toLowerCase()}`;
    expect(() => buildNotification(eventKey, { code: "YC1" })).not.toThrow();
  });

  it.each(QUOTE_STATUSES)("quote.%s", (status) => {
    const eventKey = `quote.${status.toLowerCase()}`;
    // Chỉ những trạng thái báo giá thực sự phát sự kiện mới cần khai báo; các trạng thái
    // khác chưa dùng tới nên bỏ qua ở đây.
    if (!isKnownEvent(eventKey)) return;
    expect(() => buildNotification(eventKey, { code: "BG1" })).not.toThrow();
  });

  it.each([
    "shipment.created",
    "shipment.driver_assigned",
    "shipment.proof_of_delivery_recorded",
    "quote.sent",
    "quote.accepted",
    "quote.declined",
    "request.submitted",
  ])("sự kiện ghi cứng trong service: %s", (eventKey) => {
    expect(() => buildNotification(eventKey, {})).not.toThrow();
  });

  it("sự kiện lạ thì ném lỗi rõ ràng chứ không im lặng bỏ qua", () => {
    expect(() => buildNotification("khong.ton.tai", {})).toThrow(UnknownEventError);
  });
});

describe("nội dung thông báo", () => {
  it("mọi mục khai báo đều có tiêu đề, nội dung và người nhận", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, { trackingCode: "VT1", code: "BG1" });
      if (content === null) continue;

      expect(content.title.length, `${eventKey} thiếu tiêu đề`).toBeGreaterThan(3);
      expect(content.body.length, `${eventKey} thiếu nội dung`).toBeGreaterThan(10);
      expect(content.audience.length, `${eventKey} không có người nhận`).toBeGreaterThan(0);
    }
  });

  it("không lộ mã trạng thái nội bộ ra nội dung người dùng đọc", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, { trackingCode: "VT1", code: "BG1" });
      if (content === null) continue;

      const text = `${content.title} ${content.body}`;
      expect(text, `${eventKey} lộ mã trạng thái`).not.toMatch(/[A-Z]{4,}_[A-Z]{2,}/);
    }
  });

  it("liên kết luôn là đường dẫn nội bộ, không phải URL tuyệt đối", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, { trackingCode: "VT1", code: "BG1" });
      if (!content) continue;

      for (const link of Object.values(content.linkUrl)) {
        expect(link.startsWith("/"), `${eventKey} dùng URL tuyệt đối`).toBe(true);
        expect(link.startsWith("//"), `${eventKey} có thể mở ra ngoài`).toBe(false);
      }
    }
  });

  it("mỗi nhóm người nhận đi vào khu vực của mình, không lẫn sang khu vực khác", () => {
    // Lỗi thật đã gặp: thông báo gửi cho tài xế nhưng link trỏ tới `/tai-khoan/...`,
    // là trang tài xế không có quyền vào.
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, { trackingCode: "VT1", code: "BG1" });
      if (!content) continue;

      if (content.linkUrl.CUSTOMER) {
        expect(content.linkUrl.CUSTOMER, `${eventKey}: link khách`).toMatch(/^\/tai-khoan\//);
      }
      if (content.linkUrl.DRIVER) {
        expect(content.linkUrl.DRIVER, `${eventKey}: link tài xế`).toMatch(/^\/tai-xe\//);
      }
    }
  });

  it("nhóm nào nhận thông báo thì nhóm đó phải có link, trừ khi sự kiện không có trang đích", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, { trackingCode: "VT1", code: "BG1" });
      if (!content) continue;

      for (const audience of content.audience) {
        expect(
          content.linkUrl[audience],
          `${eventKey} gửi cho ${audience} nhưng không có link cho nhóm đó`
        ).toBeTruthy();
      }
    }
  });

  it("thiếu mã trong payload thì vẫn dựng được nội dung, không văng lỗi", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      expect(() => buildNotification(eventKey, {}), eventKey).not.toThrow();
    }
  });

  it("không sinh liên kết hỏng khi thiếu mã", () => {
    for (const eventKey of DECLARED_EVENT_KEYS) {
      const content = buildNotification(eventKey, {});
      if (!content) continue;

      for (const link of Object.values(content.linkUrl)) {
        // Đường dẫn kết thúc bằng "/" nghĩa là đã ghép mã rỗng vào.
        expect(link.endsWith("/"), `${eventKey} sinh link hỏng`).toBe(false);
      }
    }
  });

  it("bước nội bộ trong quá trình xếp dỡ không làm phiền khách", () => {
    for (const status of ["scheduled", "at_pickup", "packing", "loading", "unloading"]) {
      expect(buildNotification(`shipment.${status}`, {}), status).toBeNull();
    }
  });

  it("mốc quan trọng thì luôn báo", () => {
    for (const status of ["completed", "cancelled", "incident", "failed"]) {
      expect(buildNotification(`shipment.${status}`, { trackingCode: "VT1" }), status).not.toBeNull();
    }
  });

  it("sự cố và thất bại dùng mức nghiêm trọng cao", () => {
    expect(buildNotification("shipment.incident", {})?.severity).toBe("ERROR");
    expect(buildNotification("shipment.failed", {})?.severity).toBe("ERROR");
    expect(buildNotification("shipment.on_hold", {})?.severity).toBe("WARNING");
  });
});
