"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({ agentHref, children }: { agentHref: string; children: React.ReactNode }) {
  return (
    <section className="relative grid gap-14 pt-16 pb-12 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
      <div>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full bg-go-soft px-3.5 py-1.5 text-[13px] font-semibold text-go-deep"
        >
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-go" />
          Earned autonomy for AI trading
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease }}
          className="mt-7 text-[46px] font-semibold leading-[1.0] tracking-[-0.04em] text-ink sm:text-[72px]"
        >
          Let an AI trade for you, on a limit it has to <span className="text-go">earn</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease }}
          className="mt-7 max-w-xl text-[18px] leading-relaxed text-ink-2"
        >
          Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises, lowers
          or freezes that limit based on how the agent&apos;s trades actually turn out.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-full bg-go px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-go-deep dark:text-[#052e16]"
          >
            Open your account
            <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={agentHref}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-semibold text-ink transition hover:text-go-deep"
          >
            Watch the live agent <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.2, ease }}
      >
        {children}
      </motion.div>
    </section>
  );
}
