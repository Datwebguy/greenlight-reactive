import Link from "next/link";
import { ChainChip } from "@/components/chain-chip";
import { LimitMeter } from "@/components/limit-meter";
import { greenlightScorerAbi } from "@/lib/abi";
import { lasna } from "@/lib/config";
import { medianDelivery } from "@/lib/cycle";
import { ago, dollars, short } from "@/lib/format";
import { allAccounts, readOwner, type OwnerView } from "@/lib/server/account";
import { clientFor } from "@/lib/server/logs";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

async function scorerResting(): Promise<boolean | null> {
  if (!lasna.scorer) return null;
  try {
    const watching = await clientFor(lasna.chain.id).readContract({
      address: lasna.scorer,
      abi: greenlightScorerAbi,
      functionName: "watchingPrice",
    });
    return !watching;
  } catch {
    return null;
  }
}

export default async function LivePage() {
  const accounts = await allAccounts().catch(() => []);
  const demo = process.env.NEXT_PUBLIC_DEMO_OWNER?.toLowerCase();
  const owners = [...new Set(accounts.map((a) => a.owner.toLowerCase()))]
    .sort((a, b) => (a === demo ? -1 : b === demo ? 1 : 0))
    .slice(0, 12);
  const [views, resting] = await Promise.all([
    Promise.all(owners.map((o) => readOwner(o as Address).catch(() => null))),
    scorerResting(),
  ]);
  const live = views.filter((v): v is OwnerView => v !== null && v.accounts.length > 0);
  const allItems = live.flatMap((v) => v.timeline);
  const judged = allItems.filter((t) => t.kind === "scored").length;
  const delivery = medianDelivery(allItems);

  return (
    <div className="pt-10">
      <h1 className="text-[32px] font-semibold tracking-tight">Live</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
        Every Greenlight agent on the test networks, read straight from the chains. Open one to see each trade, each verdict
        and how fast every change reached every chain.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Owners", value: String(live.length) },
          { label: "Trades judged", value: String(judged) },
          { label: "Change to every chain", value: delivery ? `${delivery.median}s typical` : "—" },
          {
            label: "Scorer on Reactive Network",
            value: resting === null ? "—" : resting ? "Resting" : "Judging trades",
            sub: resting ? "No trades waiting, so it is not paying to follow prices" : "Following Chainlink until each trade is judged",
          },
        ].map((s) => (
          <div key={s.label} className="bg-card px-5 py-4">
            <dt className="text-[12px] text-mute">{s.label}</dt>
            <dd className="num mt-1 text-[20px] font-semibold">{s.value}</dd>
            {"sub" in s && s.sub && <dd className="mt-0.5 text-[12px] leading-snug text-mute">{s.sub}</dd>}
          </div>
        ))}
      </dl>

      {live.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-card px-6 py-14 text-center">
          <p className="text-[16px] font-medium">No agents yet</p>
          <p className="mt-1 text-[14px] text-mute">Be the first to open an account.</p>
          <Link href="/app" className="mt-5 inline-flex rounded-xl bg-go px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-go-deep">
            Open your account
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {live.map((v) => {
            const a = v.accounts[0];
            const frozen = v.accounts.some((x) => x.frozen) || Boolean(v.book?.frozen);
            const limit = v.book?.limitCents ?? a.limitCents;
            const last = v.timeline.at(-1);
            return (
              <li key={v.owner}>
                <Link
                  href={`/owner/${v.owner}`}
                  className="block rounded-2xl border border-line bg-card p-6 shadow-card transition hover:border-line-2 hover:shadow-[0_8px_24px_-12px_rgb(16_21_28/0.18)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${frozen ? "bg-stop" : "bg-go"}`} />
                      <span className="text-[13px] font-semibold">{frozen ? "Frozen" : "Trading"}</span>
                      {v.owner.toLowerCase() === demo && (
                        <span className="rounded-full bg-go-soft px-2 py-0.5 text-[11px] font-semibold text-go-deep">Demo</span>
                      )}
                    </div>
                    <span className="flex gap-1">
                      {[...new Set(v.accounts.map((x) => x.chainId))].map((c) => (
                        <ChainChip key={c} chainId={c} />
                      ))}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[12px] text-mute">Earned daily limit</div>
                      <div className="num text-[28px] font-semibold leading-tight">{dollars(limit)}</div>
                    </div>
                    <div className="text-right text-[13px] text-ink-2">
                      {v.book?.wins ?? 0} won · {v.book?.losses ?? 0} lost
                      <div className="num text-[12px] text-mute">Owner {short(v.owner)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <LimitMeter limitCents={limit} floorCents={a.policy.floorCents} ceilingCents={a.policy.ceilingCents} frozen={frozen} />
                  </div>
                  {last && <div className="mt-4 text-[12px] text-mute">Last activity {ago(last.time)}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
