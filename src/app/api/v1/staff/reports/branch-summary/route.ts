import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { getServerSupabaseClient } from "@/server/supabase/server";

const querySchema = z.object({ branchId: z.uuid() });
type ReportRow = { branch_id: string; branch_name: string; active_tables: number | string; open_sessions: number | string; outstanding_service_requests: number | string; unavailable_menu_items: number | string; total_due_minor: number | string; total_paid_minor: number | string };

function safeCount(value: number | string) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new AppError("INTERNAL_ERROR", "The report contains an invalid count.");
  return count;
}

export async function GET(request: Request) {
  const requestId = correlationId();
  try {
    const branchId = querySchema.parse({ branchId: new URL(request.url).searchParams.get("branchId") }).branchId;
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const result = await supabase.rpc("read_branch_summary", { p_branch_id: branchId }).maybeSingle();
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to load the branch report.", true);
    if (!result.data) throw new AppError("FORBIDDEN", "You do not have access to this branch report.");
    const row = result.data as ReportRow;
    const data = { branchId: row.branch_id, branchName: row.branch_name, activeTables: safeCount(row.active_tables), openSessions: safeCount(row.open_sessions), outstandingServiceRequests: safeCount(row.outstanding_service_requests), unavailableMenuItems: safeCount(row.unavailable_menu_items), totalDueMinor: safeCount(row.total_due_minor), totalPaidMinor: safeCount(row.total_paid_minor) };
    return NextResponse.json({ ok: true, data, meta: { correlationId: requestId, freshness: "fresh" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "branchId must be a valid UUID.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
