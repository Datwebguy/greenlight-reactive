import { NextResponse } from "next/server";
import { readOwner } from "@/lib/server/account";
import { demoOwner } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** The live agent's state in one line, for a status badge (shields.io endpoint format). Read from the chains. */
export async function GET() {
  let message = "starting";
  let color = "138a4a";
  try {
    if (demoOwner) {
      const v = await readOwner(demoOwner);
      const b = v.book;
      if (b) {
        const limit = `$${(b.limitCents / 100).toFixed(2)} a day`;
        message = b.frozen ? `frozen · ${b.wins} won, ${b.losses} lost` : `${limit} earned · ${b.wins} won, ${b.losses} lost`;
        if (b.frozen) color = "b91c1c";
      }
    }
  } catch {
    message = "reading the chains";
  }
  return NextResponse.json(
    { schemaVersion: 1, label: "live agent", message, color, labelColor: "06120c" },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
