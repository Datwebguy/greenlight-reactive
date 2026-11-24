import { NextResponse } from "next/server";
import { scorerFunds } from "@/lib/server/scorer-funds";

export const dynamic = "force-dynamic";

/** Whether the scorer on Reactive Network is funded and reacting. */
export async function GET() {
  const scorer = await scorerFunds().catch(() => null);
  return NextResponse.json({ scorer }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
