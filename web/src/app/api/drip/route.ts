import { NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { dripMessage } from "@/lib/drip";
import { drip } from "@/lib/server/drip";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Free test ETH for a new visitor, proven by a free signature from their wallet. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { wallet?: string; time?: number; signature?: Hex } | null;
  if (!body?.wallet || !isAddress(body.wallet) || !body.signature || typeof body.time !== "number") {
    return NextResponse.json({ error: "Missing details" }, { status: 400 });
  }
  if (Math.abs(Date.now() / 1000 - body.time) > 300) return NextResponse.json({ error: "This request has expired. Please try again." }, { status: 400 });
  const ok = await verifyMessage({ address: body.wallet as Address, message: dripMessage(body.wallet, body.time), signature: body.signature }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Please confirm the request in your wallet." }, { status: 401 });
  try {
    const r = await drip(body.wallet as Address);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  } catch (e) {
    console.error("drip failed", (e as Error).message);
    return NextResponse.json({ ok: false, error: "Sending didn't go through. Please try again in a moment." }, { status: 500 });
  }
}
