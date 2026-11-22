"use client";

import { ArrowRight, Hand, Minus, Plus, Server, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Reveal, Ticker } from "../motion";

/** Measured numbers, set in the open with thin dividers. */
export function Stats({ items }: { items: { label: string; value: number; suffix?: string; decimals?: number; note: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-y-10 lg:flex lg:justify-between lg:divide-x lg:divide-line">
      {items.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.08} className="px-2 lg:flex-1 lg:px-8 lg:first:pl-0 lg:last:pr-0">
          <Ticker
            value={s.value}
            format={(n) => `${n.toFixed(s.decimals ?? 0)}${s.suffix ?? ""}`}
            className="num block text-[52px] leading-none font-semibold tracking-tight text-ink"
          />
          <div className="mt-3 text-[15px] font-semibold text-ink">{s.label}</div>
          <div className="mt-1 max-w-[240px] text-[13px] leading-snug text-mute">{s.note}</div>
        </Reveal>
      ))}
    </div>
  );
}

const control = [
  { icon: Hand, title: "Big or unchecked trades wait for you", body: "Anything over today's limit, or any decision the enclave did not sign, waits for your yes or no." },
  { icon: ShieldAlert, title: "One button stops it everywhere", body: "Freeze the agent from any chain and it stops on all of them within seconds. Withdraw whenever you like." },
  { icon: Server, title: "Nothing depends on a server", body: "Scoring runs as a contract on Reactive Network. It keeps judging and adjusting even if this website goes offline." },
];

/** A full-width band in the brand's deep green. */
export function Control() {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-[#06120c] py-24 text-white dark:bg-[#0a1a12]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-[#4ade80] uppercase">You stay in charge</p>
          <h2 className="mt-3 max-w-2xl text-[36px] leading-tight font-semibold tracking-tight sm:text-[48px]">
            The agent only gets the room its results have earned.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-12 sm:grid-cols-3">
          {control.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#4ade80]/12 text-[#4ade80]">
                <c.icon size={22} />
              </span>
              <h3 className="mt-5 text-[19px] font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

const faq = [
  { q: "Is this real money?", a: "Not yet. Greenlight runs on test networks with test dollars and test ether, but every price comes from Chainlink and every step is a real transaction anyone can check." },
  { q: "What does the AI actually decide?", a: "Whether to buy, sell or wait, and how much, within what is left of today's limit. It explains every decision in plain words, including the times it chose to wait." },
  { q: "How does it earn a higher limit?", a: "By being right. After a run of winning trades the limit rises by the step you chose, never above your highest. Each losing trade cuts it, never below your lowest." },
  { q: "What if the AI is unavailable or keeps losing?", a: "If the secure model is unavailable, a backup can still suggest trades, but those always wait for your approval. If the agent keeps losing, it freezes itself on every chain." },
  { q: "What happens if the AI goes offline?", a: "Nothing bad. The AI only proposes trades. Judging them, moving the limit and freezing the agent run as a contract on Reactive Network, so they keep working without the AI or this website." },
  { q: "Who can move my funds?", a: "Only you. The agent can place trades inside its limit and nothing else: it cannot withdraw, change your rules, approve its own requests or unfreeze itself." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {faq.map((f, i) => (
        <div key={f.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-6 py-6 text-left text-[18px] font-semibold tracking-tight transition hover:text-go-deep"
            aria-expanded={open === i}
          >
            {f.q}
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-2 text-mute">
              {open === i ? <Minus size={16} /> : <Plus size={16} />}
            </span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-ink-2">{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export function FinalCta() {
  return (
    <Reveal className="relative text-center">
      <div aria-hidden className="absolute inset-x-0 top-1/2 mx-auto h-56 w-2/3 -translate-y-1/2 rounded-full " style={{ background: "radial-gradient(closest-side, var(--glow), transparent 75%)" }} />
      <h2 className="relative mx-auto max-w-3xl text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[60px]">
        Give your agent a limit it has to earn.
      </h2>
      <p className="relative mx-auto mt-5 max-w-xl text-[17px] text-ink-2">
        Set the rules once. Greenlight takes care of the rest, on every chain, around the clock.
      </p>
      <Link
        href="/app"
        className="group relative mt-10 inline-flex items-center gap-2 rounded-full bg-go px-7 py-4 text-[16px] font-semibold text-white transition hover:bg-go-deep dark:text-[#052e16]"
      >
        Open your account <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
      </Link>
    </Reveal>
  );
}
