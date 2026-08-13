import { describe, it, expect } from "vitest";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  allowedInvoiceTransitions,
  assertInvoiceTransition,
  canAcceptPayment,
  canReversePayment,
  canTransitionInvoice,
  deriveStatus,
  isClosed,
  isEditable,
} from "@/modules/invoices/state-machine";
import { AppError } from "@/lib/errors";

const NOW = new Date("2026-09-15T10:00:00Z");
const FUTURE = new Date("2026-09-30T00:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");

describe("cấu trúc vòng đời hóa đơn", () => {
  it("mọi trạng thái có nhãn và tông màu", () => {
    for (const status of INVOICE_STATUSES) {
      expect(INVOICE_STATUS_LABELS[status], status).toBeTruthy();
      expect(INVOICE_STATUS_TONE[status], status).toBeTruthy();
    }
  });

  it("mọi phương thức thanh toán có nhãn", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method], method).toBeTruthy();
    }
  });

  it("chỉ hóa đơn nháp mới sửa được", () => {
    expect(isEditable("DRAFT")).toBe(true);
    for (const status of INVOICE_STATUSES) {
      if (status === "DRAFT") continue;
      expect(isEditable(status), status).toBe(false);
    }
  });

  it("PAID và VOID là trạng thái khép lại", () => {
    expect(isClosed("PAID")).toBe(true);
    expect(isClosed("VOID")).toBe(true);
    expect(isClosed("OVERDUE")).toBe(false);
  });
});

describe("deriveStatus — trạng thái suy ra từ số tiền", () => {
  it("trả đủ thì PAID", () => {
    expect(
      deriveStatus({
        current: "ISSUED",
        totalAmount: "1000000",
        paidAmount: "1000000",
        dueAt: FUTURE,
        now: NOW,
      })
    ).toBe("PAID");
  });

  it("trả thừa cũng là PAID", () => {
    expect(
      deriveStatus({
        current: "PARTIALLY_PAID",
        totalAmount: "1000000",
        paidAmount: "1200000",
        dueAt: FUTURE,
        now: NOW,
      })
    ).toBe("PAID");
  });

  it("trả một phần, còn hạn thì PARTIALLY_PAID", () => {
    expect(
      deriveStatus({
        current: "ISSUED",
        totalAmount: "1000000",
        paidAmount: "400000",
        dueAt: FUTURE,
        now: NOW,
      })
    ).toBe("PARTIALLY_PAID");
  });

  it("chưa trả gì, còn hạn thì giữ ISSUED", () => {
    expect(
      deriveStatus({
        current: "ISSUED",
        totalAmount: "1000000",
        paidAmount: "0",
        dueAt: FUTURE,
        now: NOW,
      })
    ).toBe("ISSUED");
  });

  it("quá hạn mà chưa trả đủ thì OVERDUE, kể cả khi đã trả một phần", () => {
    expect(
      deriveStatus({
        current: "PARTIALLY_PAID",
        totalAmount: "1000000",
        paidAmount: "100000",
        dueAt: PAST,
        now: NOW,
      })
    ).toBe("OVERDUE");
  });

  it("trả đủ thì KHÔNG còn là quá hạn dù đã qua hạn", () => {
    expect(
      deriveStatus({
        current: "OVERDUE",
        totalAmount: "1000000",
        paidAmount: "1000000",
        dueAt: PAST,
        now: NOW,
      })
    ).toBe("PAID");
  });

  it("không có hạn thanh toán thì không bao giờ quá hạn", () => {
    expect(
      deriveStatus({
        current: "ISSUED",
        totalAmount: "1000000",
        paidAmount: "0",
        dueAt: null,
        now: NOW,
      })
    ).toBe("ISSUED");
  });

  it("DRAFT và VOID không bị suy ra đè lên — là quyết định của con người", () => {
    for (const current of ["DRAFT", "VOID"] as const) {
      expect(
        deriveStatus({
          current,
          totalAmount: "1000000",
          paidAmount: "1000000",
          dueAt: PAST,
          now: NOW,
        }),
        current
      ).toBe(current);
    }
  });

  it("hóa đơn 0 đồng không tự thành PAID khi chưa có khoản nào", () => {
    // Tránh trường hợp hóa đơn rỗng bị đánh dấu đã thu tiền.
    expect(
      deriveStatus({ current: "ISSUED", totalAmount: "0", paidAmount: "0", dueAt: FUTURE, now: NOW })
    ).toBe("ISSUED");
  });
});

describe("canTransitionInvoice", () => {
  it("nháp phát hành được", () => {
    expect(canTransitionInvoice("DRAFT", "ISSUED").allowed).toBe(true);
  });

  it("hủy bắt buộc có lý do", () => {
    expect(canTransitionInvoice("ISSUED", "VOID").allowed).toBe(false);
    expect(canTransitionInvoice("ISSUED", "VOID", { reason: "Khách hủy đơn" }).allowed).toBe(true);
  });

  it("hóa đơn đã thu đủ tiền KHÔNG hủy được", () => {
    const result = canTransitionInvoice("PAID", "VOID", { reason: "muốn hủy" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/hoàn tiền/);
  });

  it("hóa đơn đã hủy là trạng thái cuối", () => {
    for (const status of INVOICE_STATUSES) {
      if (status === "VOID") continue;
      expect(canTransitionInvoice("VOID", status).allowed, status).toBe(false);
    }
  });

  it("không phát hành lại hóa đơn đã phát hành", () => {
    expect(canTransitionInvoice("ISSUED", "ISSUED").allowed).toBe(false);
    expect(canTransitionInvoice("PARTIALLY_PAID", "ISSUED").allowed).toBe(false);
  });

  it("mọi đích đến trong bảng chuyển đều hợp lệ", () => {
    for (const status of INVOICE_STATUSES) {
      for (const transition of allowedInvoiceTransitions(status)) {
        expect(INVOICE_STATUSES).toContain(transition.to);
      }
    }
  });

  it("assert ném AppError đúng mã", () => {
    try {
      assertInvoiceTransition("PAID", "VOID", { reason: "x" });
      throw new Error("Mong đợi ném lỗi");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_STATE_TRANSITION");
    }
  });
});

describe("canAcceptPayment", () => {
  it("hóa đơn nháp chưa nhận thanh toán", () => {
    // Khách chưa nhận được chứng từ nào để mà trả.
    const result = canAcceptPayment("DRAFT");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/chưa phát hành/);
  });

  it("hóa đơn đã hủy không nhận thanh toán", () => {
    expect(canAcceptPayment("VOID").allowed).toBe(false);
  });

  it("hóa đơn đã trả đủ không nhận thêm", () => {
    expect(canAcceptPayment("PAID").allowed).toBe(false);
  });

  it.each(["ISSUED", "PARTIALLY_PAID", "OVERDUE"] as const)("%s nhận được thanh toán", (status) => {
    expect(canAcceptPayment(status).allowed).toBe(true);
  });
});

describe("canReversePayment", () => {
  it("khoản chờ đối chiếu và đã xác nhận đều đảo được", () => {
    expect(canReversePayment("PENDING").allowed).toBe(true);
    expect(canReversePayment("CONFIRMED").allowed).toBe(true);
  });

  it("không đảo hai lần", () => {
    expect(canReversePayment("REVERSED").allowed).toBe(false);
  });

  it("mọi trạng thái thanh toán đều xử lý được, không văng lỗi", () => {
    for (const status of PAYMENT_STATUSES) {
      expect(() => canReversePayment(status), status).not.toThrow();
    }
  });
});
