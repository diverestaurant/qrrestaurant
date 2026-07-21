import { NextResponse } from "next/server";
import { correlationId } from "@/lib/errors";
import { logger } from "@/server/observability/logger";
import { getHealthSupabaseClient } from "@/server/supabase/health";

const headers = { "Cache-Control": "no-store" };

function serviceSummary() {
  return {
    service: "dive-restaurant",
    mode: process.env.VERCEL_ENV ?? "local",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const requestId = correlationId();
  if (new URL(request.url).searchParams.get("check") !== "readiness") {
    return NextResponse.json({ ok: true, ...serviceSummary(), checks: { application: "ok" }, correlationId: requestId }, { headers: { ...headers, "X-Correlation-Id": requestId } });
  }

  const startedAt = performance.now();
  try {
    const database = await getHealthSupabaseClient().from("restaurants")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(1_200));
    if (database.error) throw database.error;
    const durationMs = Math.round(performance.now() - startedAt);
    return NextResponse.json({
      ok: true,
      ...serviceSummary(),
      checks: { application: "ok", database: "ok" },
      durationMs,
      correlationId: requestId,
    }, { headers: { ...headers, "X-Correlation-Id": requestId } });
  } catch {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error("Readiness check failed", { action: "health.readiness", correlationId: requestId, durationMs, result: "unavailable" });
    return NextResponse.json({
      ok: false,
      ...serviceSummary(),
      checks: { application: "ok", database: "unavailable" },
      durationMs,
      correlationId: requestId,
    }, { status: 503, headers: { ...headers, "X-Correlation-Id": requestId } });
  }
}
