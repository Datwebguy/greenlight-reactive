"use client";

import { Quote, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { EthLogo } from "../brand";
import { ChainChip } from "../chain-chip";
import { Gauge } from "../gauge";
import { Ticker } from "../motion";

export interface ConsoleData {
  name: string;
  href: string;
  frozen: boolean;
  limitCents: number;
  floorCents: number;
  ceilingCents: number;
  wins: number;
  losses: number;
  chains: number[];
  price: number | null;
  thought: { action: string; reason: string; signed: boolean; ago: string } | null;
}

const pill = "inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-[13px] font-medium text-ink shadow-card backdrop-blur";

/** The live agent, floating: its earned limit as a ring, its facts as pills around it, and what it last thought. */
export function AgentConsole({ d }: { d: ConsoleData | null }) {
  if (!d) {
    return <p className="text-center text-[15px] text-ink-2">The live agent is starting up. Its first decision comes within ten minutes.</p>;
  }
  return (
    <div className="relative mx-auto max-w-[520px] overflow-visible">
      <div className="relative mx-auto grid place-items-center py-4">
        <div aria-hidden className="absolute h-[300px] w-[300px] rounded-full opacity-70 blur-3xl" style={{ background: "var(--glow)" }} />
        {/* orbiting lights */}
        <div aria-hidden className="absolute h-[360px] w-[360px] rounded-full border border-line" style={{ animation: "orbit 28s linear infinite" }}>
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-go shadow-[0_0_12px_var(--go)]" />
          <span className="absolute bottom-[14%] left-[6%] h-1.5 w-1.5 rounded-full bg-go/60" />
        </div>
        <div aria-hidden className="absolute h-[420px] w-[420px] rounded-full border border-dashed border-line" style={{ animation: "orbit 46s linear infinite reverse" }}>
          <span className="absolute top-1/2 -right-1 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-go shadow-[0_0_16px_var(--go)]" />
        </div>
        <Gauge limitCents={d.limitCents} floorCents={d.floorCents} ceilingCents={d.ceilingCents} frozen={d.frozen} size={300}>
          <div>
            <div className="text-[12px] font-medium text-mute">{d.name} has earned</div>
            <Ticker value={d.limitCents / 100} format={(n) => `$${n.toFixed(2)}`} className="num block text-[46px] leading-tight font-semibold tracking-tight" />
            <div className="text-[13px] text-mute">a day, out of ${Math.round(d.ceilingCents / 100)}</div>
          </div>
        </Gauge>

        <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className={`${pill} absolute top-0 left-1/2 -translate-x-1/2`}>
          <span className={`h-2 w-2 rounded-full ${d.frozen ? "bg-stop" : "live-dot bg-go"}`} />
          {d.frozen ? "Frozen" : "Trading live"}
        </motion.span>
        <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75 }} className={`${pill} absolute top-1/3 -left-2 sm:-left-6`}>
          <span className="num">{d.wins} won · {d.losses} lost</span>
        </motion.span>
        <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }} className={`${pill} absolute top-1/2 -right-2 sm:-right-6`}>
          <EthLogo size={16} />
          <span className="num">{d.price ? `$${d.price.toFixed(2)}` : "ETH"}</span>
        </motion.span>
        <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }} className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1.5">
          {d.chains.map((c) => (
            <ChainChip key={c} chainId={c} />
          ))}
        </motion.span>
      </div>

      <motion.figure initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6 }} className="mt-6 px-2">
        {d.thought ? (
          <>
            <blockquote className="relative pl-8 text-[16px] leading-relaxed text-ink">
              <Quote size={20} className="absolute top-0.5 left-0 text-go" />
              <span className="font-semibold">{d.thought.action}.</span> {d.thought.reason}
            </blockquote>
            <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-8 text-[13px] text-mute">
              <span>{d.thought.ago}</span>
              {d.thought.signed && (
                <span className="inline-flex items-center gap-1 font-medium text-go-deep">
                  <ShieldCheck size={14} /> Signed in a secure enclave
                </span>
              )}
              <Link href={d.href} className="font-semibold text-ink hover:text-go-deep">
                See everything it did →
              </Link>
            </figcaption>
          </>
        ) : (
          <p className="text-center text-[14px] text-ink-2">It decides every ten minutes. Its next thought appears here.</p>
        )}
      </motion.figure>
    </div>
  );
}
