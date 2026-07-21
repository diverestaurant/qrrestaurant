import { describe, expect, it, vi } from "vitest";
import { confirmPayment } from "./confirm-payment";

const command = { paymentId: "00000000-0000-4000-8000-000000000903", cashReceivedMinor: 2000, idempotencyKey: "00000000-0000-4000-8000-000000000706" };

describe("confirmPayment", () => {
  it("requires enough cash and never confirms an underpayment", async () => {
    const confirm = vi.fn();
    await expect(confirmPayment({ ...command, cashReceivedMinor: 1000 }, { getPayment: async () => ({ branchId: "b", state: "PENDING", method: "CASH", amountMinor: 1200, outstandingMinor: 1200 }), confirm })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("requires a reference for non-cash confirmation", async () => {
    const confirm = vi.fn();
    await expect(confirmPayment({ paymentId: command.paymentId, idempotencyKey: command.idempotencyKey }, { getPayment: async () => ({ branchId: "b", state: "PENDING", method: "CARD", amountMinor: 1200, outstandingMinor: 1200 }), confirm })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does not offer a second confirmation after an unknown or completed outcome", async () => {
    const confirm = vi.fn();
    await expect(confirmPayment(command, { getPayment: async () => ({ branchId: "b", state: "CONFIRMED", method: "CASH", amountMinor: 1200, outstandingMinor: 1200 }), confirm })).rejects.toMatchObject({ code: "CONFLICT", retryable: true });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("passes only the trusted payment amount to persistence", async () => {
    const confirm = vi.fn().mockResolvedValue({ paymentId: command.paymentId, state: "CONFIRMED", changeMinor: 800 });
    await expect(confirmPayment(command, { getPayment: async () => ({ branchId: "b", state: "PENDING", method: "CASH", amountMinor: 1200, outstandingMinor: 1200 }), confirm })).resolves.toEqual({ paymentId: command.paymentId, state: "CONFIRMED", changeMinor: 800 });
    expect(confirm).toHaveBeenCalledWith(command, { branchId: "b", amountMinor: 1200 });
  });
});
