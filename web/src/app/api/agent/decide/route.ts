import { NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { decideMessage } from "@/lib/decide";
import { decideNow } from "@/lib/server/agent";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** An owner asks the hosted agent to decide now. The signed message proves the request comes from the owner. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { owner?: string; time?: number; signature?: Hex } | null;
  if (!body?.owner || !isAddress(body.owner) || !body.signature || typeof body.time !== "number") {
    return NextResponse.json({ error: "Missing details" }, { status: 400 });
  }
  if (Math.abs(Date.now() / 1000 - body.time) > 300) return NextResponse.json({ error: "This request has expired" }, { status: 400 });
  const ok = await verifyMessage({ address: body.owner as Address, message: decideMessage(body.owner, body.time), signature: body.signature }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Only the owner can ask" }, { status: 401 });
  return NextResponse.json({ results: await decideNow(body.owner as Address) });
}
