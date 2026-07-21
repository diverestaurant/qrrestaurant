export type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "STALE_STATE" | "UNKNOWN_OUTCOME" | "RATE_LIMITED" | "INTERNAL_ERROR";

export type ErrorEnvelope = { ok: false; error: { code: ErrorCode; message: string; retryable: boolean; correlationId: string; fieldErrors?: Record<string, string[]> } };

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly retryable = false, public readonly fieldErrors?: Record<string, string[]>) { super(message); this.name = "AppError"; }
}

export function correlationId() { return crypto.randomUUID(); }

export function toErrorEnvelope(error: unknown, id = correlationId()): ErrorEnvelope {
  if (error instanceof AppError) return { ok: false, error: { code: error.code, message: error.message, retryable: error.retryable, correlationId: id, fieldErrors: error.fieldErrors } };
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Try again or ask a staff member for help.", retryable: true, correlationId: id } };
}
