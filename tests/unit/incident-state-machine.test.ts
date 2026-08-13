import { describe, it, expect } from "vitest";
import {
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TONE,
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  allowedIncidentTransitions,
  assertIncidentTransition,
  canTransitionIncident,
  defaultSeverityFor,
  isIncidentOpen,
  shouldHoldShipment,
} from "@/modules/incidents/state-machine";
import { AppError } from "@/lib/errors";

describe("cấu trúc vòng đời sự cố", () => {
  it("mọi trạng thái đều có nhãn tiếng Việt và tông màu", () => {
    for (const status of INCIDENT_STATUSES) {
      expect(INCIDENT_STATUS_LABELS[status], `thiếu nhãn ${status}`).toBeTruthy();
      expect(INCIDENT_STATUS_TONE[status], `thiếu tông màu ${status}`).toBeTruthy();
    }
  });

  it("mọi loại và mức độ đều có nhãn", () => {
    for (const type of INCIDENT_TYPES) {
      expect(INCIDENT_TYPE_LABELS[type], type).toBeTruthy();
    }
    for (const severity of INCIDENT_SEVERITIES) {
      expect(INCIDENT_SEVERITY_LABELS[severity], severity).toBeTruthy();
    }
  });

  it("mọi đích đến trong bảng chuyển đều hợp lệ", () => {
    for (const status of INCIDENT_STATUSES) {
      for (const transition of allowedIncidentTransitions(status)) {
        expect(INCIDENT_STATUSES).toContain(transition.to);
      }
    }
  });

  it("CLOSED là trạng thái kết thúc", () => {
    expect(allowedIncidentTransitions("CLOSED")).toHaveLength(0);
  });

  it("mọi trạng thái chưa đóng đều tới được RESOLVED hoặc CLOSED", () => {
    for (const status of INCIDENT_STATUSES) {
      if (status === "CLOSED") continue;

      const visited = new Set<string>();
      const queue: (typeof INCIDENT_STATUSES)[number][] = [status];
      let reachesEnd = false;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        if (current === "CLOSED") {
          reachesEnd = true;
          break;
        }
        queue.push(...allowedIncidentTransitions(current).map((t) => t.to));
      }

      expect(reachesEnd, `${status} không khép lại được`).toBe(true);
    }
  });
});

describe("canTransitionIncident", () => {
  it("đánh dấu đã xử lý bắt buộc có kết luận", () => {
    expect(canTransitionIncident("INVESTIGATING", "RESOLVED").allowed).toBe(false);
    expect(canTransitionIncident("INVESTIGATING", "RESOLVED", { resolution: "   " }).allowed).toBe(
      false
    );
    expect(
      canTransitionIncident("INVESTIGATING", "RESOLVED", { resolution: "Đã thay lốp, xe chạy lại" })
        .allowed
    ).toBe(true);
  });

  it("mở lại được sự cố đã xử lý mà chưa đóng", () => {
    expect(canTransitionIncident("RESOLVED", "ACTION_REQUIRED").allowed).toBe(true);
  });

  it("sự cố đã đóng thì không mở lại", () => {
    for (const status of INCIDENT_STATUSES) {
      if (status === "CLOSED") continue;
      expect(canTransitionIncident("CLOSED", status).allowed, status).toBe(false);
    }
  });

  it("không nhảy thẳng từ OPEN sang CLOSED — phải qua RESOLVED", () => {
    // Đóng mà không có kết luận là mất dấu vết xử lý.
    expect(canTransitionIncident("OPEN", "CLOSED").allowed).toBe(false);
  });

  it("chuyển sang chính nó bị từ chối", () => {
    expect(canTransitionIncident("OPEN", "OPEN").allowed).toBe(false);
  });

  it("assert ném AppError đúng mã lỗi", () => {
    try {
      assertIncidentTransition("CLOSED", "OPEN");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
    }
  });
});

describe("isIncidentOpen", () => {
  it("chỉ RESOLVED và CLOSED được coi là đã khép lại", () => {
    expect(isIncidentOpen("OPEN")).toBe(true);
    expect(isIncidentOpen("INVESTIGATING")).toBe(true);
    expect(isIncidentOpen("ACTION_REQUIRED")).toBe(true);
    expect(isIncidentOpen("RESOLVED")).toBe(false);
    expect(isIncidentOpen("CLOSED")).toBe(false);
  });
});

describe("defaultSeverityFor", () => {
  it("tai nạn và mất hàng luôn ở mức cao nhất", () => {
    expect(defaultSeverityFor("ACCIDENT")).toBe("CRITICAL");
    expect(defaultSeverityFor("LOSS")).toBe("CRITICAL");
  });

  it("chậm trễ không phải mức cao nhất", () => {
    expect(defaultSeverityFor("DELAY")).not.toBe("CRITICAL");
  });

  it("mọi loại sự cố đều có mức mặc định hợp lệ", () => {
    for (const type of INCIDENT_TYPES) {
      expect(INCIDENT_SEVERITIES, type).toContain(defaultSeverityFor(type));
    }
  });
});

describe("shouldHoldShipment", () => {
  it("tai nạn và mất hàng thì dừng chuyến ngay", () => {
    expect(shouldHoldShipment("ACCIDENT", "MEDIUM")).toBe(true);
    expect(shouldHoldShipment("LOSS", "LOW")).toBe(true);
  });

  it("mức rất nghiêm trọng thì dừng bất kể loại gì", () => {
    for (const type of INCIDENT_TYPES) {
      expect(shouldHoldShipment(type, "CRITICAL"), type).toBe(true);
    }
  });

  it("chậm trễ hay không liên hệ được khách thì KHÔNG dừng chuyến", () => {
    // Chuyến vẫn đang chạy; tự dừng sẽ làm hỏng dữ liệu vận hành.
    expect(shouldHoldShipment("DELAY", "MEDIUM")).toBe(false);
    expect(shouldHoldShipment("CUSTOMER_UNAVAILABLE", "MEDIUM")).toBe(false);
    expect(shouldHoldShipment("ACCESS_ISSUE", "LOW")).toBe(false);
  });

  it("mức mặc định của tai nạn kéo theo dừng chuyến", () => {
    expect(shouldHoldShipment("ACCIDENT", defaultSeverityFor("ACCIDENT"))).toBe(true);
  });
});
