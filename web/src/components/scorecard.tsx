"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { txUrl } from "@/lib/config";
import { verdict } from "@/lib/cycle";
import { dollars, price, when } from "@/lib/format";
import type { TimelineItem } from "@/lib/server/account";
import { chainBrand } from "./brand";

type Trade = Extract<TimelineItem, { kind: "trade" }>;
type Scored = Extract<TimelineItem, { kind: "scored" }>;

export interface ScoreRow {
  trade: Trade | null;
  scored: Scored;
}

/** Pair every verdict with the trade it judged. */
export function scoreRows(items: TimelineItem[]): ScoreRow[] {
  const trades = items.filter((t): t is Trade => t.kind === "trade");
  return items
    .filter((t): t is Scored => t.kind === "scored")
    .map((s) => ({
      scored: s,
      trade:
        trades.find((t) => t.tradeId === s.tradeId && t.chainId === s.tradeChainId && t.account.toLowerCase() === s.account.toLowerCase()) ??
        null,
    }))
    .reverse();
}

function Reasoning({ trade }: { trade: Trade }) {
  const q = useQuery<{ signed: boolean; reason: string | null }>({
    queryKey: ["decision", trade.chainId, trade.tx],
    queryFn: async () => (await fetch(`/api/decision/${trade.chainId}/${trade.tx}`)).json(),
    staleTime: Infinity,
  });
  if (q.isLoading) return <p className="text-[14px] text-mute">Reading the decision from the chain…</p>;
  if (!q.data?.reason) return <p className="text-[14px] text-mute">This trade was approved by the owner, so there is no AI reasoning attached.</p>;
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-ink">“{q.data.reason}”</p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-go-deep">
        <ShieldCheck size={14} /> Read from the trade transaction itself. Signed in a secure enclave and checked by the account before the trade ran.
      </p>
    </div>
  );
}

/** The agent's public track record: every judged trade, its result and its proof. */
export function Scorecard({ items }: { items: TimelineItem[] }) {
  const rows = scoreRows(items);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const wins = rows.filter((r) => verdict(r.scored, r.trade?.side) === "a win").length;
  const losses = rows.filter((r) => verdict(r.scored, r.trade?.side) === "a loss").length;
  const pnl = rows.reduce((s, r) => s + r.scored.pnlCents, 0);
  const signed = rows.filter((r) => r.trade?.verified).length;
  const shown = all ? rows : rows.slice(0, 8);

  return (
    <section className="border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight">Scorecard</h2>
          <p className="mt-1 max-w-xl text-[15px] text-ink-2">
            Every trade the agent made, the verdict it received on Reactive Network, and the proof. Nobody can edit this record.
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          { k: "Trades judged", v: String(rows.length) },
          { k: "Won", v: rows.length ? `${wins} of ${rows.length}` : "0" },
          { k: "Result", v: `${pnl < 0 ? "−" : "+"}${dollars(Math.abs(pnl))}`, tone: pnl < 0 ? "text-stop" : "text-go-deep" },
          { k: "Signed by the AI enclave", v: rows.length ? `${signed} of ${rows.length}` : "0" },
        ].map((s) => (
          <div key={s.k}>
            <dt className="text-[13px] text-mute">{s.k}</dt>
            <dd className={`num mt-1 text-[28px] leading-tight font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</dd>
          </div>
        ))}
      </dl>
      {losses > 0 && wins === 0 && rows.length > 0 && (
        <p className="mt-4 text-[14px] text-mute">Every loss cut the agent&apos;s limit, exactly as the owner&apos;s rules say.</p>
      )}

      {rows.length === 0 ? (
        <p className="mt-10 py-8 text-center text-[15px] text-mute">No trades have been judged yet. Each one appears here about ten minutes after it is made.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {shown.map(({ scored: s, trade: t }) => {
            const v = verdict(s, t?.side);
            const b = chainBrand[s.tradeChainId];
            const key = s.tx + s.tradeId;
            const isOpen = open === key;
            return (
              <li key={key} className="py-5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                      v === "a win" ? "bg-go-soft text-go-deep" : v === "a loss" ? "bg-stop-soft text-stop" : "bg-line text-ink-2"
                    }`}
                  >
                    {v === "a win" ? "W" : v === "a loss" ? "L" : "="}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold">
                      {t ? `${t.side === "buy" ? "Bought" : "Sold"} ${dollars(t.amountCents)} of ETH` : `Trade ${s.tradeId}`}
                      <span className="font-normal text-ink-2"> at {price(s.entryPrice)}, judged at {price(s.exitPrice)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-mute">
                      {b && (
                        <span className="inline-flex items-center gap-1.5">
                          <b.Logo size={14} /> {b.label}
                        </span>
                      )}
                      <span>{when(s.time)}</span>
                      <span className={v === "a win" ? "text-go-deep" : v === "a loss" ? "text-stop" : ""}>
                        {s.returnBps >= 0 ? "+" : ""}
                        {(s.returnBps / 100).toFixed(2)}% · {v === "a win" ? "won" : v === "a loss" ? "lost" : "even"}
                      </span>
                      {t?.verified && (
                        <span className="inline-flex items-center gap-1 text-go-deep">
                          <ShieldCheck size={13} /> Signed decision
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] font-semibold">
                    {t && (
                      <button onClick={() => setOpen(isOpen ? null : key)} className="rounded-full border border-line-2 px-3.5 py-1.5 text-ink hover:border-ink/40">
                        {isOpen ? "Hide reasoning" : "Why it traded"}
                      </button>
                    )}
                    {t && (
                      <a href={txUrl(t.chainId, t.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-ink hover:text-go-deep">
                        Trade <ArrowUpRight size={13} />
                      </a>
                    )}
                    <a href={txUrl(s.chainId, s.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-ink hover:text-go-deep">
                      Verdict <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && t && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 ml-14 max-w-2xl">
                        <Reasoning trade={t} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 8 && (
        <button onClick={() => setAll(!all)} className="mt-4 rounded-full border border-line-2 px-4 py-2 text-[13px] font-semibold hover:border-ink/40">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
