import { NextResponse } from "next/server";
import { allAccounts } from "@/lib/server/account";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ accounts: await allAccounts() });
}
