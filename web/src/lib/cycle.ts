import type { TimelineItem } from "./server/account";

export interface CycleStep {
  chainId: number;
  title: string;
  detail: string;
  time: number;
  tx: string;
}

export interface Cycle {
  kind: "trade" | "freeze" | "join";
  steps: CycleStep[];
  /** Seconds from the scorer's decision on Reactive Network to the last chain that applied it. */
  deliverySeconds: number | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const px = (p: number) => `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Of<K extends TimelineItem["kind"]> = Extract<TimelineItem, { kind: K }>;

/** The most recent complete cycle in an owner's history, newest kind first: a judged trade, a freeze, or joining. */
export function latestCycle(items: TimelineItem[]): Cycle | null {
  const limits = items.filter((t): t is Of<"limit"> => t.kind === "limit");
  const synced = items.filter((t): t is Of<"synced"> => t.kind === "synced");
  const arrivals = (lim: Of<"limit">) => synced.filter((s) => s.seq === lim.seq);
  const finish = (lim: Of<"limit">, title: string, steps: CycleStep[], kind: Cycle["kind"]): Cycle => {
    const got = arrivals(lim);
    for (const a of got) {
      steps.push({
        chainId: a.chainId,
        title: a.frozen ? "Account frozen" : `New limit applied: ${usd(a.limitCents)}`,
        detail: `${Math.max(0, a.time - lim.time)}s after the decision`,
        time: a.time,
        tx: a.tx,
      });
    }
    const delivery = got.length ? Math.max(...got.map((a) => a.time - lim.time)) : null;
    return { kind, steps, deliverySeconds: delivery === null ? null : Math.max(0, delivery) };
  };

  // A judged trade that changed the limit.
  const scored = items.filter((t): t is Of<"scored"> => t.kind === "scored");
  for (let i = scored.length - 1; i >= 0; i--) {
    const s = scored[i];
    const lim = limits.find((l) => l.tx === s.tx);
    if (!lim) continue;
    const trade = items.find(
      (t): t is Of<"trade"> => t.kind === "trade" && t.tradeId === s.tradeId && t.account.toLowerCase() === s.account.toLowerCase(),
    );
    const steps: CycleStep[] = [];
    if (trade) {
      steps.push({
        chainId: trade.chainId,
        title: `${trade.side === "buy" ? "Bought" : "Sold"} ${usd(trade.amountCents)} of ETH at ${px(trade.price)}`,
        detail: trade.verified ? "Decision signed by the AI enclave" : "Approved by the owner",
        time: trade.time,
        tx: trade.tx,
      });
    }
    steps.push({
      chainId: s.chainId,
      title: `Judged: ${s.pnlCents >= 0 ? "a win" : "a loss"} of ${s.returnBps >= 0 ? "+" : ""}${(s.returnBps / 100).toFixed(2)}%`,
      detail: `Price moved from ${px(s.entryPrice)} to ${px(s.exitPrice)}`,
      time: s.time,
      tx: s.tx,
    });
    return finish(lim, "", steps, lim.frozen ? "freeze" : "trade");
  }

  // The owner froze or unfroze the agent.
  const owner = items.filter((t): t is Of<"owner"> => t.kind === "owner");
  for (let i = owner.length - 1; i >= 0; i--) {
    const o = owner[i];
    const lim = limits.find((l) => (l.reason === 7 || l.reason === 8) && l.time >= o.time);
    if (!lim) continue;
    return finish(
      lim,
      "",
      [
        {
          chainId: o.chainId,
          title: o.frozen ? "Owner pressed freeze" : "Owner unfroze the agent",
          detail: "One transaction on one chain",
          time: o.time,
          tx: o.tx,
        },
        {
          chainId: lim.chainId,
          title: o.frozen ? "Scorer froze the agent everywhere" : "Scorer restarted the agent at its lowest limit",
          detail: `${Math.max(0, lim.time - o.time)}s later, on Reactive Network`,
          time: lim.time,
          tx: lim.tx,
        },
      ],
      "freeze",
    );
  }

  // The account was opened and linked.
  const joined = items.filter((t): t is Of<"joined"> => t.kind === "joined");
  const first = limits.find((l) => l.reason === 1);
  if (joined.length && first) {
    const j = joined[0];
    return finish(
      first,
      "",
      [
        { chainId: j.chainId, title: "Account opened", detail: "The owner signed the rules once", time: j.time, tx: j.tx },
        {
          chainId: first.chainId,
          title: "Scorer linked the account",
          detail: `${Math.max(0, first.time - j.time)}s later, on Reactive Network`,
          time: first.time,
          tx: first.tx,
        },
      ],
      "join",
    );
  }
  return null;
}

/** Median of the scorer-to-chain delivery times across every change. */
export function medianDelivery(items: TimelineItem[]): { median: number; count: number } | null {
  const limits = items.filter((t): t is Of<"limit"> => t.kind === "limit");
  const synced = items.filter((t): t is Of<"synced"> => t.kind === "synced");
  const samples: number[] = [];
  for (const l of limits) for (const s of synced) if (s.seq === l.seq) samples.push(Math.max(0, s.time - l.time));
  if (!samples.length) return null;
  samples.sort((a, b) => a - b);
  const m = samples.length % 2 ? samples[(samples.length - 1) / 2] : (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2;
  return { median: m, count: samples.length };
}
