export type SessionState = "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED";
export type OrderState = "SUBMITTED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type PaymentState = "PENDING" | "CONFIRMED" | "FAILED";

const sessionTransitions: Record<SessionState, SessionState[]> = { OPEN: ["PAYMENT_REQUESTED", "CANCELLED"], PAYMENT_REQUESTED: ["PAYMENT_PENDING", "PAID", "CANCELLED"], PAYMENT_PENDING: ["PAID", "CANCELLED"], PAID: ["CLOSED"], CLOSED: [], CANCELLED: [] };
const orderTransitions: Record<OrderState, OrderState[]> = { SUBMITTED: ["ACCEPTED", "REJECTED", "CANCELLED"], ACCEPTED: ["PREPARING", "CANCELLED"], PREPARING: ["READY", "CANCELLED"], READY: ["SERVED"], SERVED: ["COMPLETED"], COMPLETED: [], REJECTED: [], CANCELLED: [] };
const paymentTransitions: Record<PaymentState, PaymentState[]> = { PENDING: ["CONFIRMED", "FAILED"], CONFIRMED: [], FAILED: [] };

export function isAllowedTransition<T extends string>(from: T, to: T, graph: Record<T, T[]>) { return graph[from]?.includes(to) ?? false; }
export function canTransitionSession(from: SessionState, to: SessionState) { return isAllowedTransition(from, to, sessionTransitions); }
export function canTransitionOrder(from: OrderState, to: OrderState) { return isAllowedTransition(from, to, orderTransitions); }
export function canTransitionPayment(from: PaymentState, to: PaymentState) { return isAllowedTransition(from, to, paymentTransitions); }

export function assertExpectedVersion(actual: number, expected: number) { if (actual !== expected) throw new Error(`Stale state: expected ${expected}, received ${actual}`); }

export function derivePaymentAggregate(confirmedMinor: number, amountDueMinor: number): "UNPAID" | "PARTIALLY_PAID" | "PAID" { if (confirmedMinor <= 0) return "UNPAID"; if (confirmedMinor < amountDueMinor) return "PARTIALLY_PAID"; if (confirmedMinor === amountDueMinor) return "PAID"; throw new Error("Payment allocation exceeds amount due"); }
