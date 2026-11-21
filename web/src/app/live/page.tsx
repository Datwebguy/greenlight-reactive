import Link from "next/link";
import { Badge, Card, CardHead } from "@/components/ui";
import { chainById } from "@/lib/config";
import { ago, short } from "@/lib/format";
import { allAccounts } from "@/lib/server/account";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const accounts = await allAccounts().catch(() => []);
  const owners = new Map<string, { owner: string; chains: Set<string>; since: number }>();
  for (const a of accounts) {
    const key = a.owner.toLowerCase();
    const o = owners.get(key) ?? { owner: a.owner, chains: new Set<string>(), since: a.time };
    o.chains.add(chainById(a.chainId)?.chain.name ?? String(a.chainId));
    o.since = Math.min(o.since, a.time);
    owners.set(key, o);
  }
  const demo = process.env.NEXT_PUBLIC_DEMO_OWNER?.toLowerCase();
  const list = [...owners.values()].sort((a, b) =>
    a.owner.toLowerCase() === demo ? -1 : b.owner.toLowerCase() === demo ? 1 : b.since - a.since,
  );

  return (
    <div className="pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Live accounts</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
        Every Greenlight account on the test networks. Open one to see its limit move, the trades behind each change,
        and how quickly each change reached every chain. All of it is read straight from the chains.
      </p>
      <Card className="mt-8">
        <CardHead title={`${list.length} owner${list.length === 1 ? "" : "s"}`} />
        {list.length === 0 ? (
          <p className="px-5 py-12 text-center text-mute">No accounts yet. Be the first to open one.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((o) => (
              <li key={o.owner}>
                <Link href={`/owner/${o.owner}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper">
                  <span className="flex items-center gap-3">
                    <span className="num font-medium">{short(o.owner)}</span>
                    {o.owner.toLowerCase() === demo && <Badge tone="go">Demo</Badge>}
                  </span>
                  <span className="text-[13px] text-mute">
                    {[...o.chains].join(" · ")} · opened {ago(o.since)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
