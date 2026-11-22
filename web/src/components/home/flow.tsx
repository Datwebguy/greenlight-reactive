"use client";

import { Brain, Gavel, Network, PenLine } from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    icon: PenLine,
    title: "You sign the rules once",
    body: "A starting daily limit, the most it can ever grow to and the least it can be cut to. One transaction.",
  },
  {
    icon: Brain,
    title: "The AI trades inside the limit",
    body: "A model in a secure enclave decides and signs its answer. Your account checks the signature before money moves.",
  },
  {
    icon: Gavel,
    title: "Every trade gets a verdict",
    body: "Ten minutes later, a contract on Reactive Network checks it against the market. Wins raise the limit, losses cut it.",
  },
  {
    icon: Network,
    title: "Every chain follows in seconds",
    body: "The new limit, or a freeze after a bad run, reaches every chain the agent trades on. Only you can restart it.",
  },
];

/** Four circular steps on one line, with a light travelling from the first to the last. */
export function Flow() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute top-8 right-[12.5%] left-[12.5%] hidden h-px bg-line-2 lg:block">
        <motion.span
          className="absolute -top-[2px] h-[5px] w-28 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, var(--go), transparent)" }}
          animate={{ left: ["-8%", "100%"] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
        />
      </div>
      <ol className="relative grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="text-center lg:px-2"
          >
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border border-line-2 bg-paper text-go shadow-card">
              <s.icon size={24} />
              <span className="num absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-go text-[11px] font-semibold text-white dark:text-[#052e16]">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-6 text-[18px] font-semibold tracking-tight">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-[280px] text-[15px] leading-relaxed text-ink-2">{s.body}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
