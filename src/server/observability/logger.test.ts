import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/server/observability/logger";

afterEach(() => vi.restoreAllMocks());

describe("privacy-safe structured logger", () => {
  it("redacts sensitive context and keeps operational fields", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logger.info("Synthetic health check", {
      action: "health.readiness",
      actorId: "synthetic-actor",
      authorization: "Bearer local-secret",
      customerEmail: "synthetic@local.test",
      durationMs: 42,
    });
    const payload = JSON.parse(String(output.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: "info",
      message: "Synthetic health check",
      action: "health.readiness",
      actorId: "synthetic-actor",
      authorization: "[REDACTED]",
      customerEmail: "[REDACTED]",
      durationMs: 42,
    });
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
