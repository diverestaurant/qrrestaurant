import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import type { CustomerOrderView } from "@/contracts/view-models";
import { executeIdempotentCommand } from "@/server/idempotency/execute-command";
import { submitOrder } from "@/modules/ordering/application/submit-order";
import { submitOrderSchema } from "@/modules/ordering/contracts/commands";
import { getServerSupabaseClient } from "@/server/supabase/server";

type OrderRow = { id: string; display_number: number; state: string; version: number; total_minor: number | string; currency: string; created_at: string };
type OrderItemRow = { order_id: string; name_snapshot: string; unit_price_minor: number | string; quantity: number; note: string | null };

function safeMinor(value: number | string, label: string) {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new AppError("INTERNAL_ERROR", `The order ${label} is invalid.`);
  return minor;
}

async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON."); }
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = submitOrderSchema.parse(await readJson(request));
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can submit an order.");
    const sessionResult = await supabase.from("dining_sessions").select("restaurant_id,branch_id,state,version").eq("id", command.sessionId).maybeSingle();
    if (sessionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read the Session.", true);
    if (!sessionResult.data) throw new AppError("FORBIDDEN", "This Session cannot accept customer orders.");
    const session = sessionResult.data as { restaurant_id: string; branch_id: string };
    const execution = await executeIdempotentCommand({ restaurantId: session.restaurant_id, branchId: session.branch_id, actorId: user.id, commandType: "order.submit", idempotencyKey: command.idempotencyKey, command }, () => submitOrder(command, {
      getSession: async (sessionId) => {
        const result = await supabase.from("dining_sessions").select("state,version").eq("id", sessionId).maybeSingle();
        if (result.error || !result.data) return null;
        const row = result.data as { state: string; version: number };
        return { state: row.state, version: row.version, customerCanWrite: true };
      },
      submit: async (submitCommand) => {
        const result = await supabase.rpc("submit_customer_order", { p_session_id: submitCommand.sessionId, p_items: submitCommand.items, p_expected_session_version: submitCommand.expectedSessionVersion, p_idempotency_key: submitCommand.idempotencyKey }).single();
        if (result.error) {
          if (result.error.code === "42501" || result.error.code === "P0002") throw new AppError("FORBIDDEN", "This Session cannot accept customer orders.");
          if (result.error.code === "P0003") throw new AppError("STALE_STATE", "The Session changed. Refresh before submitting.", true);
          if (result.error.code === "P0004") throw new AppError("CONFLICT", "A menu item is no longer available. Refresh the menu.", true);
          if (result.error.code === "22023") throw new AppError("VALIDATION_ERROR", "The order contains invalid pricing or modifiers.");
          if (result.error.code === "23505") throw new AppError("UNKNOWN_OUTCOME", "The order may already have been submitted. Check the order status before retrying.", true);
          throw new AppError("INTERNAL_ERROR", "Unable to submit the order.", true);
        }
        const row = result.data as { order_id: string; version: number } | null;
        if (!row) throw new AppError("INTERNAL_ERROR", "The order was not created.", true);
        return { orderId: row.order_id, version: row.version };
      },
    }));
    return NextResponse.json({ ok: true, data: execution.result, meta: { replay: execution.replay, correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error instanceof z.ZodError ? new AppError("VALIDATION_ERROR", "Request fields are invalid.") : error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : body.error.code === "STALE_STATE" || body.error.code === "CONFLICT" || body.error.code === "UNKNOWN_OUTCOME" ? 409 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  const requestId = correlationId();
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId || !z.uuid().safeParse(sessionId).success) throw new AppError("VALIDATION_ERROR", "Session id is invalid.");
    const supabase = await getServerSupabaseClient();
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "A customer Session identity is required.");
    const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
    if (user.is_anonymous !== true) throw new AppError("FORBIDDEN", "Only an anonymous customer identity can read customer orders.");

    const ordersResult = await supabase.from("orders").select("id,display_number,state,version,total_minor,currency,created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(20);
    if (ordersResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read customer orders.", true);
    const orders = (ordersResult.data ?? []) as OrderRow[];
    const orderIds = orders.map((order) => order.id);
    const itemsResult = orderIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("order_items").select("order_id,name_snapshot,unit_price_minor,quantity,note").in("order_id", orderIds).order("created_at", { ascending: true });
    if (itemsResult.error) throw new AppError("INTERNAL_ERROR", "Unable to read order items.", true);
    const itemsByOrder = new Map<string, CustomerOrderView["items"]>();
    for (const item of (itemsResult.data ?? []) as OrderItemRow[]) {
      const items = itemsByOrder.get(item.order_id) ?? [];
      items.push({ name: item.name_snapshot, quantity: item.quantity, unitPriceMinor: safeMinor(item.unit_price_minor, "item price"), note: item.note });
      itemsByOrder.set(item.order_id, items);
    }
    const data: CustomerOrderView[] = orders.map((order) => ({ id: order.id, displayNumber: order.display_number, state: order.state, version: order.version, totalMinor: safeMinor(order.total_minor, "total"), currency: order.currency, createdAt: order.created_at, items: itemsByOrder.get(order.id) ?? [] }));
    return NextResponse.json({ ok: true, data, meta: { correlationId: requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error, requestId);
    const status = body.error.code === "UNAUTHORIZED" ? 401 : body.error.code === "FORBIDDEN" ? 403 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
