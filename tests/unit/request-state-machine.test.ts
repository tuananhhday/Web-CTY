import { describe, it, expect } from "vitest";
import {
  REQUEST_STATUSES,
  canTransition,
  assertTransition,
  isTerminal,
  isEditableByCustomer,
  allowedTransitions,
  transitionActorOf,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_HINTS,
  REQUEST_STATUS_TONE,
  type RequestStatus,
} from "@/modules/service-requests/state-machine";
import { createActor, GUEST } from "@/modules/auth/actor";
import { AppError } from "@/lib/errors";

const TERMINAL: RequestStatus[] = ["CONVERTED_TO_SHIPMENT", "REJECTED", "EXPIRED", "CANCELLED"];

describe("cấu trúc state machine", () => {
  it("có đủ 11 trạng thái theo §11", () => {
    expect(REQUEST_STATUSES).toHaveLength(11);
  });

  it("mọi trạng thái đều có nhãn, gợi ý và tông màu", () => {
    for (const status of REQUEST_STATUSES) {
      expect(REQUEST_STATUS_LABELS[status], `thiếu nhãn cho ${status}`).toBeTruthy();
      expect(REQUEST_STATUS_HINTS[status], `thiếu gợi ý cho ${status}`).toBeTruthy();
      expect(REQUEST_STATUS_TONE[status], `thiếu tông màu cho ${status}`).toBeTruthy();
    }
  });

  it("mọi đích đến trong bảng chuyển đều là trạng thái hợp lệ", () => {
    for (const status of REQUEST_STATUSES) {
      for (const transition of allowedTransitions(status)) {
        expect(REQUEST_STATUSES).toContain(transition.to);
      }
    }
  });

  it("không có trạng thái nào chuyển về chính nó", () => {
    for (const status of REQUEST_STATUSES) {
      expect(allowedTransitions(status).map((t) => t.to)).not.toContain(status);
    }
  });

  it("mọi trạng thái không kết thúc đều tới được ít nhất một trạng thái kết thúc", () => {
    // Chống tạo ra trạng thái "kẹt": vào rồi không bao giờ đóng được yêu cầu.
    for (const status of REQUEST_STATUSES) {
      if (isTerminal(status)) continue;

      const visited = new Set<RequestStatus>();
      const queue: RequestStatus[] = [status];
      let reachesTerminal = false;

      while (queue.length > 0) {
        const current = queue.shift() as RequestStatus;
        if (visited.has(current)) continue;
        visited.add(current);

        if (isTerminal(current)) {
          reachesTerminal = true;
          break;
        }
        queue.push(...allowedTransitions(current).map((t) => t.to));
      }

      expect(reachesTerminal, `${status} không tới được trạng thái kết thúc nào`).toBe(true);
    }
  });
});

describe("trạng thái kết thúc", () => {
  it.each(TERMINAL)("%s không chuyển đi đâu được", (status) => {
    expect(isTerminal(status)).toBe(true);
    expect(allowedTransitions(status)).toHaveLength(0);
  });

  it.each(TERMINAL)("%s từ chối mọi bước chuyển, kể cả của nhân viên", (status) => {
    for (const target of REQUEST_STATUSES) {
      if (target === status) continue;
      expect(canTransition(status, target, "STAFF").allowed).toBe(false);
    }
  });

  it("lịch sử không bị viết lại: đơn đã tạo shipment không quay về nháp", () => {
    expect(canTransition("CONVERTED_TO_SHIPMENT", "DRAFT", "STAFF").allowed).toBe(false);
  });
});

describe("luồng nghiệp vụ chính", () => {
  it("khách gửi yêu cầu từ bản nháp", () => {
    expect(canTransition("DRAFT", "SUBMITTED", "CUSTOMER").allowed).toBe(true);
  });

  it("khách KHÔNG tự chuyển yêu cầu sang đang xem xét", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW", "CUSTOMER").allowed).toBe(false);
  });

  it("nhân viên tiếp nhận rồi báo giá", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW", "STAFF").allowed).toBe(true);
    expect(canTransition("UNDER_REVIEW", "QUOTED", "STAFF").allowed).toBe(true);
  });

  it("khách KHÔNG tự tạo báo giá cho mình", () => {
    expect(canTransition("UNDER_REVIEW", "QUOTED", "CUSTOMER").allowed).toBe(false);
  });

  it("chỉ khách hàng mới chấp nhận được báo giá", () => {
    expect(canTransition("QUOTED", "ACCEPTED", "CUSTOMER").allowed).toBe(true);
    expect(canTransition("QUOTED", "ACCEPTED", "STAFF").allowed).toBe(false);
  });

  it("chỉ nhân viên tạo được đơn hàng từ yêu cầu đã chấp nhận", () => {
    expect(canTransition("ACCEPTED", "CONVERTED_TO_SHIPMENT", "STAFF").allowed).toBe(true);
    expect(canTransition("ACCEPTED", "CONVERTED_TO_SHIPMENT", "CUSTOMER").allowed).toBe(false);
  });

  it("không nhảy cóc từ đã gửi thẳng sang tạo đơn hàng", () => {
    expect(canTransition("SUBMITTED", "CONVERTED_TO_SHIPMENT", "STAFF").allowed).toBe(false);
  });

  it("không nhảy cóc từ đã gửi thẳng sang báo giá", () => {
    expect(canTransition("SUBMITTED", "QUOTED", "STAFF").allowed).toBe(false);
  });

  it("khách bổ sung thông tin xong thì quay lại hàng chờ xử lý", () => {
    expect(canTransition("NEED_MORE_INFO", "UNDER_REVIEW", "CUSTOMER").allowed).toBe(true);
  });

  it("thương lượng xong nhân viên gửi báo giá phiên bản mới", () => {
    expect(canTransition("NEGOTIATING", "QUOTED", "STAFF").allowed).toBe(true);
  });
});

describe("bắt buộc nhập lý do", () => {
  it.each([
    ["SUBMITTED", "REJECTED", "STAFF"],
    ["UNDER_REVIEW", "REJECTED", "STAFF"],
    ["SUBMITTED", "NEED_MORE_INFO", "STAFF"],
    ["QUOTED", "CANCELLED", "CUSTOMER"],
  ] as const)("%s → %s thiếu lý do thì bị từ chối", (from, to, by) => {
    expect(canTransition(from, to, by).allowed).toBe(false);
    expect(canTransition(from, to, by, { reason: "   " }).allowed).toBe(false);
    expect(canTransition(from, to, by, { reason: "Hàng không nhận vận chuyển" }).allowed).toBe(true);
  });

  it("bước chuyển bình thường không đòi lý do", () => {
    expect(canTransition("DRAFT", "SUBMITTED", "CUSTOMER").allowed).toBe(true);
  });
});

describe("hết hạn tự động", () => {
  it("chỉ hệ thống mới chuyển sang hết hạn", () => {
    expect(canTransition("QUOTED", "EXPIRED", "SYSTEM").allowed).toBe(true);
    expect(canTransition("QUOTED", "EXPIRED", "STAFF").allowed).toBe(false);
    expect(canTransition("QUOTED", "EXPIRED", "CUSTOMER").allowed).toBe(false);
  });

  it("bản nháp không tự hết hạn", () => {
    expect(canTransition("DRAFT", "EXPIRED", "SYSTEM").allowed).toBe(false);
  });
});

describe("assertTransition", () => {
  it("không ném lỗi khi hợp lệ", () => {
    expect(() => assertTransition("DRAFT", "SUBMITTED", "CUSTOMER")).not.toThrow();
  });

  it("ném INVALID_STATE_TRANSITION kèm lý do đọc được", () => {
    try {
      assertTransition("SUBMITTED", "CONVERTED_TO_SHIPMENT", "STAFF");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
      expect((error as AppError).message).toContain("SUBMITTED");
    }
  });

  it("thông báo lỗi nêu rõ khi thiếu lý do", () => {
    try {
      assertTransition("UNDER_REVIEW", "REJECTED", "STAFF");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect((error as AppError).message).toMatch(/lý do/i);
    }
  });
});

describe("isEditableByCustomer", () => {
  it("khách sửa được bản nháp và khi được yêu cầu bổ sung", () => {
    expect(isEditableByCustomer("DRAFT")).toBe(true);
    expect(isEditableByCustomer("NEED_MORE_INFO")).toBe(true);
  });

  it("khách KHÔNG sửa được sau khi đã gửi hoặc đã có báo giá", () => {
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "ACCEPTED"] as const) {
      expect(isEditableByCustomer(status)).toBe(false);
    }
  });
});

describe("transitionActorOf", () => {
  it("khách chưa đăng nhập tính là CUSTOMER", () => {
    expect(transitionActorOf(GUEST)).toBe("CUSTOMER");
  });

  it("khách hàng đã đăng nhập tính là CUSTOMER", () => {
    const customer = createActor({
      userId: "u1",
      email: "a@local.test",
      name: "A",
      roles: ["CUSTOMER"],
      sessionId: "s1",
      authenticatedAt: new Date(),
    });
    expect(transitionActorOf(customer)).toBe("CUSTOMER");
  });

  it("người có quyền request.manage tính là STAFF", () => {
    const dispatcher = createActor({
      userId: "u2",
      email: "b@local.test",
      name: "B",
      roles: ["DISPATCHER"],
      sessionId: "s2",
      authenticatedAt: new Date(),
    });
    expect(transitionActorOf(dispatcher)).toBe("STAFF");
  });

  it("kế toán chỉ đọc được yêu cầu nên vẫn tính là CUSTOMER trong state machine", () => {
    // ACCOUNTANT có request.read_all nhưng KHÔNG có request.manage.
    const accountant = createActor({
      userId: "u3",
      email: "c@local.test",
      name: "C",
      roles: ["ACCOUNTANT"],
      sessionId: "s3",
      authenticatedAt: new Date(),
    });
    expect(transitionActorOf(accountant)).toBe("CUSTOMER");
  });
});
