import { NextResponse } from "next/server";
import { decodeFunctionData, hexToString, isHash, type Hex } from "viem";
import { greenlightAccountAbi } from "@/lib/abi";
import { chainById } from "@/lib/config";
import { clientFor } from "@/lib/server/logs";

/**
 * The AI's decision behind a trade, read from the trade transaction itself: the account receives the model's full,
 * enclave-signed answer as part of the call, so it is on-chain for anyone to read.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ chain: string; tx: string }> }) {
  const { chain, tx } = await ctx.params;
  const chainId = Number(chain);
  if (!chainById(chainId) || !isHash(tx)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const t = await clientFor(chainId).getTransaction({ hash: tx as Hex });
    const call = decodeFunctionData({ abi: greenlightAccountAbi, data: t.input });
    if (call.functionName !== "trade") return NextResponse.json({ error: "not a trade" }, { status: 404 });
    const [order, proof] = call.args as unknown as [
      { side: number; amountCents: bigint; refPriceCents: bigint },
      { response: Hex; signature: Hex },
    ];
    let reason: string | null = null;
    let action: string | null = null;
    if (proof.response && proof.response !== "0x") {
      const body = JSON.parse(hexToString(proof.response));
      const content: string = body.choices?.[0]?.message?.content ?? "";
      const s = content.indexOf("{");
      const e = content.lastIndexOf("}");
      const d = JSON.parse(s >= 0 && e > s ? content.slice(s, e + 1) : content);
      reason = typeof d.reason === "string" ? d.reason : null;
      action = typeof d.action === "string" ? d.action : null;
    }
    return NextResponse.json(
      {
        signed: proof.signature !== "0x" && proof.signature.length > 2,
        action,
        reason,
        side: Number(order.side) === 0 ? "buy" : "sell",
        amountCents: Number(order.amountCents),
      },
      { headers: { "Cache-Control": "public, s-maxage=31536000, immutable" } },
    );
  } catch {
    return NextResponse.json({ error: "unreadable" }, { status: 404 });
  }
}
