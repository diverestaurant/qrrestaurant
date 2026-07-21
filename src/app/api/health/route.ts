import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "dive-restaurant",
    mode: process.env.VERCEL_ENV ?? "local",
    timestamp: new Date().toISOString(),
  });
}
