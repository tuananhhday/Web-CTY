import { describe, it, expect } from "vitest";
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  TICKET_TYPES,
  allowedTicketTransitions,
  assertTicketTransition,
  canTransitionTicket,
  defaultPriorityFor,
  isOverdue,
  isTicketClosed,
  needsStaffAttention,
  slaDueAt,
  statusAfterMessage,
  type TicketStatus,
} from "@/modules/support/state-machine";
import { AppError } from "@/lib/errors";

const NOW = new Date("2026-09-01T10:00:00Z");

describe("cấu trúc vòng đời phiếu", () => {
  it("mọi trạng thái đều có nhãn tiếng Việt và tông màu", () => {
    for (const status of TICKET_STATUSES) {
      expect(TICKET_STATUS_LABELS[status], `thiếu nhãn cho ${status}`).toBeTruthy();
      expect(TICKET_STATUS_TONE[status], `thiếu tông màu cho ${status}`).toBeTruthy();
    }
  });

  it("mọi đích đến trong bảng chuyển đều hợp lệ", () => {
    for (const status of TICKET_STATUSES) {
      for (const transition of allowedTicketTransitions(status)) {
        expect(TICKET_STATUSES).toContain(transition.to);
      }
    }
  });

  it("CLOSED là trạng thái kết thúc", () => {
    expect(allowedTicketTransitions("CLOSED")).toHaveLength(0);
    expect(isTicketClosed("CLOSED")).toBe(true);
  });

  it("mọi trạng thái chưa đóng đều tới được CLOSED", () => {
    for (const status of TICKET_STATUSES) {
      if (status === "CLOSED") continue;
      const targets = allowedTicketTransitions(status).map((transition) => transition.to);
      expect(targets, `${status} không đóng được`).toContain("CLOSED");
    }
  });
});

describe("statusAfterMessage — trạng thái suy ra từ hành động", () => {
  it("khách nhắn thì tới lượt nhân viên", () => {
    expect(statusAfterMessage("WAITING_FOR_CUSTOMER", "CUSTOMER", "CUSTOMER_VISIBLE")).toBe(
      "WAITING_FOR_STAFF"
    );
    expect(statusAfterMessage("OPEN", "CUSTOMER", "CUSTOMER_VISIBLE")).toBe("WAITING_FOR_STAFF");
  });

  it("nhân viên trả lời khách thì tới lượt khách", () => {
    expect(statusAfterMessage("WAITING_FOR_STAFF", "STAFF", "CUSTOMER_VISIBLE")).toBe(
      "WAITING_FOR_CUSTOMER"
    );
  });

  it("ghi chú NỘI BỘ của nhân viên KHÔNG đổi trạng thái", () => {
    // Trao đổi giữa nhân viên với nhau; khách vẫn đang chờ câu trả lời như trước.
    for (const status of ["OPEN", "WAITING_FOR_STAFF", "WAITING_FOR_CUSTOMER"] as TicketStatus[]) {
      expect(statusAfterMessage(status, "STAFF", "INTERNAL"), status).toBe(status);
    }
  });

  it("phiếu đã đóng thì không đổi trạng thái dù ai nhắn", () => {
    expect(statusAfterMessage("CLOSED", "CUSTOMER", "CUSTOMER_VISIBLE")).toBe("CLOSED");
    expect(statusAfterMessage("CLOSED", "STAFF", "CUSTOMER_VISIBLE")).toBe("CLOSED");
  });

  it("khách nhắn vào phiếu đã xử lý thì mở lại hàng chờ nhân viên", () => {
    expect(statusAfterMessage("RESOLVED", "CUSTOMER", "CUSTOMER_VISIBLE")).toBe(
      "WAITING_FOR_STAFF"
    );
  });
});

describe("canTransitionTicket", () => {
  it("nhân viên đánh dấu đã xử lý, bắt buộc kèm giải thích", () => {
    expect(canTransitionTicket("WAITING_FOR_STAFF", "RESOLVED", "STAFF").allowed).toBe(false);
    expect(
      canTransitionTicket("WAITING_FOR_STAFF", "RESOLVED", "STAFF", { note: "Đã hoàn tiền" })
        .allowed
    ).toBe(true);
  });

  it("khách KHÔNG tự đánh dấu phiếu đã xử lý", () => {
    expect(
      canTransitionTicket("WAITING_FOR_STAFF", "RESOLVED", "CUSTOMER", { note: "xong rồi" })
        .allowed
    ).toBe(false);
  });

  it("khách mở lại được phiếu đã xử lý khi chưa hài lòng", () => {
    expect(
      canTransitionTicket("RESOLVED", "WAITING_FOR_STAFF", "CUSTOMER", {
        note: "Vẫn chưa nhận được tiền",
      }).allowed
    ).toBe(true);
  });

  it("nhân viên không tự mở lại thay khách", () => {
    expect(
      canTransitionTicket("RESOLVED", "WAITING_FOR_STAFF", "STAFF", { note: "mở lại" }).allowed
    ).toBe(false);
  });

  it("cả hai bên đều đóng được phiếu", () => {
    expect(canTransitionTicket("RESOLVED", "CLOSED", "CUSTOMER").allowed).toBe(true);
    expect(canTransitionTicket("RESOLVED", "CLOSED", "STAFF").allowed).toBe(true);
  });

  it("phiếu đã đóng thì không mở lại được", () => {
    for (const status of TICKET_STATUSES) {
      if (status === "CLOSED") continue;
      expect(canTransitionTicket("CLOSED", status, "STAFF").allowed, status).toBe(false);
    }
  });

  it("chuyển sang chính nó bị từ chối", () => {
    expect(canTransitionTicket("OPEN", "OPEN", "STAFF").allowed).toBe(false);
  });

  it("assert ném AppError kèm lý do đọc được", () => {
    try {
      assertTicketTransition("CLOSED", "OPEN", "STAFF");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
    }
  });
});

describe("SLA nội bộ", () => {
  it("mức khẩn cấp có hạn ngắn hơn mức thấp", () => {
    const urgent = slaDueAt("URGENT", NOW).getTime();
    const low = slaDueAt("LOW", NOW).getTime();
    expect(urgent).toBeLessThan(low);
  });

  it("hạn luôn nằm ở tương lai", () => {
    for (const priority of ["LOW", "NORMAL", "HIGH", "URGENT"] as const) {
      expect(slaDueAt(priority, NOW).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("quá hạn khi chưa phản hồi và đã qua mốc", () => {
    expect(
      isOverdue(
        {
          status: "WAITING_FOR_STAFF",
          slaDueAt: new Date(NOW.getTime() - 1000),
          firstRespondedAt: null,
        },
        NOW
      )
    ).toBe(true);
  });

  it("đã phản hồi lần đầu thì không còn tính quá hạn", () => {
    expect(
      isOverdue(
        {
          status: "WAITING_FOR_STAFF",
          slaDueAt: new Date(NOW.getTime() - 1000),
          firstRespondedAt: new Date(NOW.getTime() - 2000),
        },
        NOW
      )
    ).toBe(false);
  });

  it("phiếu đang chờ KHÁCH không tính là nhân viên chậm", () => {
    expect(
      isOverdue(
        {
          status: "WAITING_FOR_CUSTOMER",
          slaDueAt: new Date(NOW.getTime() - 10_000),
          firstRespondedAt: null,
        },
        NOW
      )
    ).toBe(false);
  });

  it("phiếu đã đóng không tính quá hạn", () => {
    expect(
      isOverdue(
        { status: "CLOSED", slaDueAt: new Date(NOW.getTime() - 10_000), firstRespondedAt: null },
        NOW
      )
    ).toBe(false);
  });
});

describe("needsStaffAttention", () => {
  it("chỉ OPEN và WAITING_FOR_STAFF cần nhân viên xử lý", () => {
    expect(needsStaffAttention("OPEN")).toBe(true);
    expect(needsStaffAttention("WAITING_FOR_STAFF")).toBe(true);
    expect(needsStaffAttention("WAITING_FOR_CUSTOMER")).toBe(false);
    expect(needsStaffAttention("RESOLVED")).toBe(false);
    expect(needsStaffAttention("CLOSED")).toBe(false);
  });
});

describe("defaultPriorityFor", () => {
  it("khiếu nại và bồi thường được ưu tiên cao", () => {
    expect(defaultPriorityFor("COMPLAINT")).toBe("HIGH");
    expect(defaultPriorityFor("COMPENSATION")).toBe("HIGH");
  });

  it("mọi loại phiếu đều có mức ưu tiên mặc định", () => {
    for (const type of TICKET_TYPES) {
      expect(defaultPriorityFor(type), type).toBeTruthy();
    }
  });

  it("không loại nào mặc định là URGENT — mức đó do nhân viên nâng lên", () => {
    for (const type of TICKET_TYPES) {
      expect(defaultPriorityFor(type), type).not.toBe("URGENT");
    }
  });
});
