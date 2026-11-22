import { BuiltOn } from "@/components/brand";
import { CycleView } from "@/components/cycle-view";
import { Connector } from "@/components/home/connector";
import { AgentConsole, type ConsoleData } from "@/components/home/agent-console";
import { Flow } from "@/components/home/flow";
import { Hero } from "@/components/home/hero";
import { LiveTape, type TapeItem } from "@/components/home/live-tape";
import { Control, Faq, FinalCta, Stats } from "@/components/home/sections";
import { Reveal } from "@/components/motion";
import { txUrl } from "@/lib/config";
import { verdict } from "@/lib/cycle";
import { ago, dollars, price as fmtPrice, reasonText } from "@/lib/format";
import { agentName } from "@/lib/names";
import type { TimelineItem } from "@/lib/server/account";
import { readPrice } from "@/lib/server/account";
import { demoData } from "@/lib/server/demo";

export const revalidate = 30;

function tapeText(t: TimelineItem): Pick<TapeItem, "text" | "tone"> | null {
  switch (t.kind) {
    case "trade":
      return { text: `${t.side === "buy" ? "Bought" : "Sold"} ${dollars(t.amountCents)} of ETH at ${fmtPrice(t.price)}`, tone: "info" };
    case "scored": {
      const v = verdict(t);
      return { text: `Trade judged ${v}, ${t.returnBps >= 0 ? "+" : ""}${(t.returnBps / 100).toFixed(2)}%`, tone: v === "a win" ? "go" : v === "a loss" ? "stop" : "mute" };
    }
    case "limit":
      return {
        text: t.frozen ? reasonText[t.reason] : `${reasonText[t.reason] ?? "Limit updated"}: ${dollars(t.limitCents)}`,
        tone: t.frozen ? "stop" : t.reason === 3 ? "go" : t.reason === 4 ? "wait" : "mute",
      };
    case "owner":
      return { text: t.frozen ? "Owner froze the agent" : "Owner restarted the agent", tone: t.frozen ? "stop" : "go" };
    case "request":
      return { text: `Asked the owner to ${t.side} ${dollars(t.amountCents)} of ETH`, tone: "wait" };
    case "joined":
      return { text: "New account opened", tone: "mute" };
    default:
      return null;
  }
}

export default async function Home() {
  const [demo, price] = await Promise.all([demoData(), readPrice().catch(() => null)]);
  const view = demo?.view;
  const name = view ? agentName(view.owner) : "";
  const href = view ? `/owner/${view.owner}` : "/live";

  let agent: ConsoleData | null = null;
  if (view && view.accounts.length) {
    const a = view.accounts[0];
    const d = demo!.decision;
    agent = {
      name,
      href,
      frozen: view.accounts.some((x) => x.frozen) || Boolean(view.book?.frozen),
      limitCents: view.book?.limitCents ?? a.limitCents,
      floorCents: a.policy.floorCents,
      ceilingCents: a.policy.ceilingCents,
      wins: view.book?.wins ?? 0,
      losses: view.book?.losses ?? 0,
      chains: [...new Set(view.accounts.map((x) => x.chainId))],
      price: price?.value ?? null,
      thought: d
        ? {
            action: d.action === "hold" ? "Waited" : d.action === "buy" ? "Bought" : "Sold",
            reason: d.reason,
            signed: d.source === "near-tee",
            ago: ago(new Date(d.createdAt).getTime() / 1000),
          }
        : null,
    };
  }

  const tape: TapeItem[] = (view?.timeline ?? [])
    .slice(-16)
    .reverse()
    .map((t, i) => {
      const x = tapeText(t);
      return x ? { key: `${t.tx}-${i}`, chainId: t.chainId, href: txUrl(t.chainId, t.tx), ...x } : null;
    })
    .filter((x): x is TapeItem => x !== null);

  const allStats = [
    {
      label: "Change to every chain",
      value: demo?.delivery?.median ?? 0,
      suffix: "s",
      note: demo?.delivery ? `Typical time from the scorer's decision, over ${demo.delivery.count} updates` : "Measured on every update",
    },
    { label: "Trades judged", value: demo?.judged ?? 0, note: "Each one checked against Chainlink by the scorer" },
    {
      label: "Decisions signed",
      value: Math.round((demo?.signedShare ?? 0) * 100),
      suffix: "%",
      note: "Made in a secure enclave and verified on-chain",
    },
    { label: "Servers needed to score", value: 0, note: "Scoring runs as a contract on Reactive Network" },
  ];
  // Only show measurements that exist; a fresh deployment fills these in as the agent trades.
  const stats = allStats.filter(
    (s) => s.label === "Servers needed to score" || (s.label === "Decisions signed" ? demo?.signedShare != null : s.value > 0),
  );

  return (
    <>
      <Hero agentHref={href}>
        <AgentConsole d={agent} />
      </Hero>

      <section className="pt-6 pb-4">
        <p className="mb-6 text-center text-[13px] font-medium text-mute">Built on</p>
        <BuiltOn />
      </section>

      <div className="mt-12">
        <LiveTape items={tape} />
      </div>

      <Connector />
      <section className="pt-10">
        <Stats items={stats} />
      </section>

      <Connector />
      <section id="how" className="scroll-mt-28 pt-10">
        <Reveal className="text-center">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">How it works</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-[36px] leading-tight font-semibold tracking-tight sm:text-[48px]">
            You set the rules. The results set the limit.
          </h2>
        </Reveal>
        <div className="mt-16">
          <Flow />
        </div>
      </section>

      {demo?.cycle && (
        <>
          <Connector />
          <section className="pt-10">
            <Reveal>
              <p className="mb-4 text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">Proof, not promises</p>
            </Reveal>
            <CycleView cycle={demo.cycle} />
          </section>
        </>
      )}

      <section className="pt-28">
        <Control />
      </section>

      <section className="grid gap-12 pt-28 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">Questions</p>
          <h2 className="mt-3 text-[36px] leading-tight font-semibold tracking-tight sm:text-[44px]">Straight answers</h2>
          <p className="mt-4 max-w-sm text-[16px] text-ink-2">Everything you need to know before you give an AI a limit.</p>
        </Reveal>
        <Faq />
      </section>

      <section className="pt-32">
        <FinalCta />
      </section>
    </>
  );
}
