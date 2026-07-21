import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import { getServerSupabaseClient } from "@/server/supabase/server";

const querySchema = z.object({
  branchId: z.uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reportSchema = z.object({
  branchId: z.uuid(),
  branchName: z.string(),
  timezone: z.string(),
  currency: z.string().length(3),
  fromDate: z.string(),
  toDate: z.string(),
  sessions: money,
  completedSessions: money,
  orders: money,
  itemQuantity: money,
  grossOrderMinor: money,
  discountsMinor: money,
  netBilledMinor: money,
  confirmedPaymentsMinor: money,
  outstandingMinor: money,
  averageTicketMinor: money,
  serviceRequests: money,
  paymentMethods: z.array(z.object({ method: z.string(), paymentCount: money, amountMinor: money })),
  reconciliationExceptions: z.array(z.object({ sessionId: z.uuid(), businessDate: z.string(), tableLabel: z.string(), state: z.string(), dueMinor: money, paidMinor: money, confirmedAllocationsMinor: money, issues: z.array(z.string()) })),
});

export async function GET(request: Request) {
  const requestId = correlationId();
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({ branchId: url.searchParams.get("branchId"), from: url.searchParams.get("from"), to: url.searchParams.get("to") });
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
    const result = await supabase.rpc("read_branch_operations_report", { p_branch_id: query.branchId, p_from_date: query.from, p_to_date: query.to });
    if (result.error?.code === "22023") throw new AppError("VALIDATION_ERROR", result.error.message);
    if (result.error?.code === "42501") throw new AppError("FORBIDDEN", result.error.message);
    if (result.error) throw new AppError("INTERNAL_ERROR", "Unable to load the operations report.", true);
    if (!result.data) throw new AppError("FORBIDDEN", "You do not have access to this Branch report.");
    const data = reportSchema.parse(result.data);
    return NextResponse.json({ ok: true, data, meta: { correlationId: requestId, freshness: "fresh" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Branch and bounded ISO report dates are required.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
