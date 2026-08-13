import { describe, it, expect } from "vitest";
import {
  QUOTE_STATUSES,
  canTransition,
  assertTransition,
  isTerminal,
  isEditable,
  isVisibleToCustomer,
  allowedTransitions,
  quoteActorOf,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_HINTS,
  QUOTE_STATUS_TONE,
  type QuoteStatus,
} from "@/modules/quotes/state-machine";
import { createActor, GUEST } from "@/modules/auth/actor";
import { AppError } from "@/lib/errors";

const TERMINAL: QuoteStatus[] = ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"];

function actor(roles: Parameters<typeof createActor>[0]["roles"]) {
  return createActor({
    userId: "u1",
    email: "a@local.test",
    name: "Người dùng",
    roles,
    sessionId: "s1",
    authenticatedAt: new Date(),
  });
}

describe("cấu trúc state machine báo giá", () => {
  it("có đủ 9 trạng thái theo §13.3", () => {
    expect(QUOTE_STATUSES).toHaveLength(9);
  });

  it("mọi trạng thái đều có nhãn, gợi ý và tông màu", () => {
    for (const status of QUOTE_STATUSES) {
      expect(QUOTE_STATUS_LABELS[status]).toBeTruthy();
      expect(QUOTE_STATUS_HINTS[status]).toBeTruthy();
      expect(QUOTE_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it("mọi trạng thái không kết thúc đều tới được trạng thái kết thúc", () => {
    for (const status of QUOTE_STATUSES) {
      if (isTerminal(status)) continue;

      const visited = new Set<QuoteStatus>();
      const queue: QuoteStatus[] = [status];
      let reaches = false;

      while (queue.length > 0) {
        const current = queue.shift() as QuoteStatus;
        if (visited.has(current)) continue;
        visited.add(current);
        if (isTerminal(current)) {
          reaches = true;
          break;
        }
        queue.push(...allowedTransitions(current).map((t) => t.to));
      }

      expect(reaches, `${status} không tới được trạng thái kết thúc`).toBe(true);
    }
  });
});

describe("bảo vệ revision đã chấp nhận (§13.3)", () => {
  it.each(TERMINAL)("%s là trạng thái kết thúc", (status) => {
    expect(isTerminal(status)).toBe(true);
  });

  it("báo giá đã chấp nhận KHÔNG quay về nháp để sửa", () => {
    expect(canTransition("ACCEPTED", "DRAFT", "APPROVER").allowed).toBe(false);
  });

  it("báo giá đã chấp nhận KHÔNG gửi lại được", () => {
    expect(canTransition("ACCEPTED", "SENT", "APPROVER").allowed).toBe(false);
  });

  it("chỉ sửa được nội dung khi còn ở bản nháp", () => {
    expect(isEditable("DRAFT")).toBe(true);
    for (const status of ["PENDING_APPROVAL", "SENT", "VIEWED", "NEGOTIATING", "ACCEPTED"] as const) {
      expect(isEditable(status), `${status} không được sửa trực tiếp`).toBe(false);
    }
  });
});

describe("tách người lập và người duyệt", () => {
  it("người lập KHÔNG tự duyệt báo giá của mình", () => {
    expect(canTransition("PENDING_APPROVAL", "SENT", "PREPARER").allowed).toBe(false);
  });

  it("chỉ người có quyền duyệt mới gửi được báo giá đang chờ duyệt", () => {
    expect(canTransition("PENDING_APPROVAL", "SENT", "APPROVER").allowed).toBe(true);
  });

  it("người duyệt trả bản nháp về cho người lập, kèm lý do", () => {
    expect(canTransition("PENDING_APPROVAL", "DRAFT", "APPROVER").allowed).toBe(false);
    expect(
      canTransition("PENDING_APPROVAL", "DRAFT", "APPROVER", { reason: "Giá cước chưa đúng tuyến" })
        .allowed
    ).toBe(true);
  });

  it("khách hàng không can thiệp được vào giai đoạn chờ duyệt", () => {
    for (const target of QUOTE_STATUSES) {
      expect(canTransition("PENDING_APPROVAL", target, "CUSTOMER").allowed).toBe(false);
    }
  });
});

describe("quyền của khách hàng", () => {
  it("chỉ khách chấp nhận được báo giá", () => {
    expect(canTransition("SENT", "ACCEPTED", "CUSTOMER").allowed).toBe(true);
    expect(canTransition("SENT", "ACCEPTED", "PREPARER").allowed).toBe(false);
    expect(canTransition("SENT", "ACCEPTED", "APPROVER").allowed).toBe(false);
  });

  it("khách từ chối phải nêu lý do", () => {
    expect(canTransition("SENT", "DECLINED", "CUSTOMER").allowed).toBe(false);
    expect(canTransition("SENT", "DECLINED", "CUSTOMER", { reason: "Giá cao hơn dự kiến" }).allowed).toBe(
      true
    );
  });

  it("khách không tự gửi báo giá cho mình", () => {
    expect(canTransition("DRAFT", "SENT", "CUSTOMER").allowed).toBe(false);
  });

  it("khách không thấy bản nháp và bản chờ duyệt", () => {
    expect(isVisibleToCustomer("DRAFT")).toBe(false);
    expect(isVisibleToCustomer("PENDING_APPROVAL")).toBe(false);
    expect(isVisibleToCustomer("CANCELLED")).toBe(false);
  });

  it("khách thấy được báo giá đã gửi và các trạng thái sau đó", () => {
    for (const status of ["SENT", "VIEWED", "NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED"] as const) {
      expect(isVisibleToCustomer(status), `${status} phải hiển thị cho khách`).toBe(true);
    }
  });
});

describe("thương lượng", () => {
  it("hai bên đều mở được thương lượng từ báo giá đã gửi", () => {
    expect(canTransition("SENT", "NEGOTIATING", "CUSTOMER").allowed).toBe(true);
    expect(canTransition("SENT", "NEGOTIATING", "PREPARER").allowed).toBe(true);
  });

  it("nhân viên gửi revision mới sau khi thương lượng", () => {
    expect(canTransition("NEGOTIATING", "SENT", "PREPARER").allowed).toBe(true);
  });

  it("revision mới vượt ngưỡng thì quay lại chờ duyệt", () => {
    expect(canTransition("NEGOTIATING", "PENDING_APPROVAL", "PREPARER").allowed).toBe(true);
  });

  it("khách chấp nhận thẳng từ trạng thái thương lượng", () => {
    expect(canTransition("NEGOTIATING", "ACCEPTED", "CUSTOMER").allowed).toBe(true);
  });
});

describe("hết hạn tự động", () => {
  it("chỉ hệ thống đánh dấu hết hạn", () => {
    expect(canTransition("SENT", "EXPIRED", "SYSTEM").allowed).toBe(true);
    expect(canTransition("SENT", "EXPIRED", "APPROVER").allowed).toBe(false);
    expect(canTransition("SENT", "EXPIRED", "CUSTOMER").allowed).toBe(false);
  });

  it("bản nháp không tự hết hạn", () => {
    expect(canTransition("DRAFT", "EXPIRED", "SYSTEM").allowed).toBe(false);
  });
});

describe("quoteActorOf", () => {
  it("khách chưa đăng nhập là CUSTOMER", () => {
    expect(quoteActorOf(GUEST)).toBe("CUSTOMER");
  });

  it("khách hàng đã đăng nhập là CUSTOMER", () => {
    expect(quoteActorOf(actor(["CUSTOMER"]))).toBe("CUSTOMER");
  });

  it("dispatcher lập được báo giá nhưng không duyệt", () => {
    expect(quoteActorOf(actor(["DISPATCHER"]))).toBe("PREPARER");
  });

  it("admin có quyền duyệt", () => {
    expect(quoteActorOf(actor(["ADMIN"]))).toBe("APPROVER");
  });

  it("kế toán chỉ đọc báo giá nên không phải người lập", () => {
    // ACCOUNTANT có quote.read_all nhưng không có quote.create.
    expect(quoteActorOf(actor(["ACCOUNTANT"]))).toBe("CUSTOMER");
  });

  it("tài xế không dính dáng tới báo giá", () => {
    expect(quoteActorOf(actor(["DRIVER"]))).toBe("CUSTOMER");
  });
});

describe("assertTransition", () => {
  it("không ném lỗi khi hợp lệ", () => {
    expect(() => assertTransition("DRAFT", "SENT", "PREPARER")).not.toThrow();
  });

  it("ném INVALID_STATE_TRANSITION kèm lý do đọc được", () => {
    try {
      assertTransition("ACCEPTED", "DRAFT", "APPROVER");
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
      expect((error as AppError).message).toMatch(/kết thúc/i);
    }
  });
});
