import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { readOwner } from "@/lib/server/account";
import { recentDecisions } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return NextResponse.json({ error: "not an address" }, { status: 400 });
  const owner = getAddress(address);
  const [view, decisions] = await Promise.all([readOwner(owner), recentDecisions(owner, 40).catch(() => [])]);
  return NextResponse.json({ ...view, decisions });
}
