"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import type { Cycle } from "@/lib/cycle";
import { txUrl } from "@/lib/config";
import { when } from "@/lib/format";
import { chainBrand } from "./brand";

const headings: Record<Cycle["kind"], string> = {
  trade: "A real trade, judged and acted on",
  freeze: "A real freeze, reaching every chain",
  join: "A real account, picked up by the scorer",
};

/** One real cycle as a vertical path: each step is a point on the line, with its proof beside it. */
export function CycleView({ cycle }: { cycle: Cycle }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h3 className="text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">{headings[cycle.kind]}</h3>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
          Every step below is a transaction on a public network. Open any of them to check it for yourself.
        </p>
        {cycle.deliverySeconds !== null && (
          <div className="mt-8">
            <div className="num text-[64px] leading-none font-semibold tracking-tight text-go">{cycle.deliverySeconds}s</div>
            <div className="mt-2 text-[14px] text-mute">from the scorer&apos;s decision to every chain</div>
          </div>
        )}
      </div>
      <ol className="relative">
        <span aria-hidden className="absolute top-3 bottom-3 left-[19px] w-px bg-line-2" />
        {cycle.steps.map((s, i) => {
          const b = chainBrand[s.chainId];
          return (
            <motion.li
              key={s.tx + i}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex gap-5 pb-9 last:pb-0"
            >
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-2 bg-paper">
                {b ? <b.Logo size={20} /> : <span className="num text-[13px]">{i + 1}</span>}
              </span>
              <div className="min-w-0 pt-1.5">
                <div className="text-[17px] font-semibold leading-snug text-ink">{s.title}</div>
                <div className="mt-1 text-[14px] text-ink-2">{s.detail}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 text-[13px] text-mute">
                  <span>
                    {b?.label} · {when(s.time)}
                  </span>
                  <a href={txUrl(s.chainId, s.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink hover:text-go-deep">
                    View proof <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
