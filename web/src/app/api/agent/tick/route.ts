import { NextResponse } from "next/server";
import { runAgent } from "@/lib/server/agent";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Runs one round of decisions. Called on a schedule; each account is decided at most once per interval. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runAgent(240_000);
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
