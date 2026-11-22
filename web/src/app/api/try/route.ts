import { NextResponse } from "next/server";
import { runShowcase } from "@/lib/server/showcase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** One tap, no wallet: pause the showcase agent and watch the pause reach every chain. */
export async function POST() {
  try {
    const r = await runShowcase();
    return NextResponse.json(r, { status: "error" in r ? 503 : 200 });
  } catch (e) {
    console.error("showcase failed", (e as Error).message);
    return NextResponse.json({ error: "The live check didn't finish. Please try again in a moment." }, { status: 500 });
  }
}
