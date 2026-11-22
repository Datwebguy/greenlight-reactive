import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { readOwner } from "@/lib/server/account";
import { recentDecisions } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return NextResponse.json({ error: "not an address" }, { status: 400 });
  const owner = getAddress(address);
  const view = await readOwner(owner);
  const decisions = await recentDecisions(view.accounts.map((a) => ({ chainId: a.chainId, address: a.address }))).catch(
    () => [],
  );
  return NextResponse.json(
    { ...view, decisions },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } },
  );
}
