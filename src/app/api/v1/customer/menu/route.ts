import { NextResponse } from "next/server";
import { toErrorEnvelope } from "@/lib/errors";
import { readPublicMenu } from "@/modules/menu/infrastructure/public-menu-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const data = await readPublicMenu({ restaurantSlug: url.searchParams.get("restaurantSlug") ?? "dive-demo", branchSlug: url.searchParams.get("branchSlug") ?? "main" });
    const environment = process.env.VERCEL_ENV ?? "local";
    return NextResponse.json({ ok: true, data, meta: { source: "supabase", environment, productionConnected: environment === "production" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const body = toErrorEnvelope(error);
    const status = body.error.code === "NOT_FOUND" ? 404 : body.error.code === "VALIDATION_ERROR" ? 400 : 503;
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
