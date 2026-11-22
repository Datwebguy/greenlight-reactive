import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Address } from "viem";
import { chainBrand } from "@/components/brand";
import { Gauge } from "@/components/gauge";
import { Stats } from "@/components/home/sections";
import { Reveal } from "@/components/motion";
import { greenlightScorerAbi } from "@/lib/abi";
import { lasna } from "@/lib/config";
import { medianDelivery } from "@/lib/cycle";
import { ago, dollars } from "@/lib/format";
import { agentName } from "@/lib/names";
import { allAccounts, readOwner, type OwnerView } from "@/lib/server/account";
import { clientFor } from "@/lib/server/logs";

export const dynamic = "force-dynamic";

async function scorerBusy(): Promise<boolean | null> {
  if (!lasna.scorer) return null;
  try {
    return (await clientFor(lasna.chain.id).readContract({
      address: lasna.scorer,
      abi: greenlightScorerAbi,
      functionName: "watchingPrice",
    })) as boolean;
  } catch {
    return null;
  }
}

export default async function LivePage() {
  const accounts = await allAccounts().catch(() => []);
  const featured = process.env.NEXT_PUBLIC_DEMO_OWNER?.toLowerCase();
  const owners = [...new Set(accounts.map((a) => a.owner.toLowerCase()))]
    .sort((a, b) => (a === featured ? -1 : b === featured ? 1 : 0))
    .slice(0, 20);
  const [views, busy] = await Promise.all([
    Promise.all(owners.map((o) => readOwner(o as Address).catch(() => null))),
    scorerBusy(),
  ]);
  const live = views.filter((v): v is OwnerView => v !== null && v.accounts.length > 0);
  const items = live.flatMap((v) => v.timeline);
  const judged = items.filter((t) => t.kind === "scored").length;
  const delivery = medianDelivery(items);

  const stats = [
    { label: "Agents trading", value: live.length, note: "Each with its own rules and earned limit" },
    ...(judged > 0 ? [{ label: "Trades judged", value: judged, note: "Every verdict made on Reactive Network" }] : []),
    ...(delivery ? [{ label: "Change to every chain", value: delivery.median, suffix: "s", note: "Typical time for a new limit to arrive" }] : []),
  ];

  return (
    <div className="pt-16">
      <Reveal>
        <p className="text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">Live</p>
        <h1 className="mt-3 max-w-3xl text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[56px]">
          Every agent, earning its limit in the open.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">
          Each agent below trades by its owner&apos;s rules. Open one to see what it decided, how every trade was judged, and
          how quickly each change reached every chain.
        </p>
      </Reveal>

      <div className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2 text-[14px] backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${busy ? "live-dot bg-go" : "bg-mute"}`} />
        {busy === null
          ? "Checking the scorer…"
          : busy
            ? "The scorer is judging trades right now"
            : "The scorer is resting: no trades are waiting, so it costs nothing"}
      </div>

      <section className="mt-14">
        <Stats items={stats} />
      </section>

      <section className="mt-16">
        {live.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[18px] font-semibold">No agents yet</p>
            <p className="mt-2 text-[15px] text-mute">Be the first to give an AI a limit it has to earn.</p>
            <Link href="/app" className="mt-6 inline-flex rounded-full bg-go px-6 py-3 text-[15px] font-semibold text-white hover:bg-go-deep dark:text-[#052e16]">
              Open your account
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {live.map((v, i) => {
              const a = v.accounts[0];
              const frozen = v.accounts.some((x) => x.frozen) || Boolean(v.book?.frozen);
              const limit = v.book?.limitCents ?? a.limitCents;
              const last = v.timeline.at(-1);
              return (
                <li key={v.owner}>
                  <Reveal delay={Math.min(i, 6) * 0.05}>
                    <Link href={`/owner/${v.owner}`} className="group flex items-center gap-5 py-6 sm:gap-8">
                      <Gauge limitCents={limit} floorCents={a.policy.floorCents} ceilingCents={a.policy.ceilingCents} frozen={frozen} size={84}>
                        <span className="num text-[13px] font-semibold">{dollars(limit).replace(".00", "")}</span>
                      </Gauge>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[20px] font-semibold tracking-tight">{agentName(v.owner)}</span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                              frozen ? "bg-stop-soft text-stop" : "bg-go-soft text-go-deep"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${frozen ? "bg-stop" : "live-dot bg-go"}`} />
                            {frozen ? "Frozen" : "Trading"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-ink-2">
                          <span className="num">Earned limit {dollars(limit)} a day</span>
                          <span className="num">
                            {v.book?.wins ?? 0} won · {v.book?.losses ?? 0} lost
                          </span>
                          {last && <span className="text-mute">Active {ago(last.time)}</span>}
                        </div>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        {[...new Set(v.accounts.map((x) => x.chainId))].map((c) => {
                          const b = chainBrand[c];
                          return b ? <b.Logo key={c} size={22} /> : null;
                        })}
                      </div>
                      <ArrowRight size={20} className="shrink-0 text-mute transition group-hover:translate-x-1 group-hover:text-go-deep" />
                    </Link>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
