"use client";

import { ArrowUpRight, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "../motion";

interface Step {
  network: string;
  what: string;
  url: string;
  afterDecisionS?: number;
  seenAfterMs: number;
}
interface Answer {
  steps: Step[];
  complete: boolean;
  ranAt: string;
  shared: boolean;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** One tap, no wallet: pause an agent on Base and watch Reactive Network carry the pause to every chain. */
export function LiveCheck() {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/try", { method: "POST" });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error ?? "Please try again in a moment.");
      setAnswer(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ago = answer ? Math.max(0, Math.round((Date.now() - Date.parse(answer.ranAt)) / 1000)) : 0;

  return (
    <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <Reveal>
        <p className="text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">See it for yourself</p>
        <h2 className="mt-3 text-[36px] leading-tight font-semibold tracking-tight sm:text-[44px]">One tap, every chain</h2>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
          No wallet needed. Press the button to pause a real agent on Base, then watch the scorer on Reactive Network carry
          that pause to Base and Unichain. Every step is a real transaction you can open. The agent restarts on its own
          afterwards.
        </p>
        <button
          onClick={run}
          disabled={busy}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-go px-7 py-4 text-[16px] font-semibold text-white transition hover:bg-go-deep disabled:opacity-70 dark:text-[#052e16]"
        >
          <Zap size={18} />
          {busy ? "Following it across chains…" : "Pause it everywhere"}
        </button>
        {error && <p className="mt-4 text-[14px] text-stop">{error}</p>}
      </Reveal>

      <div className="relative min-h-[300px]">
        {!answer && !busy && (
          <ol className="space-y-6 border-l border-line pl-6 text-[15px] text-mute">
            <li>The owner pauses the agent on Base</li>
            <li>The scorer on Reactive Network reacts</li>
            <li>Base applies the pause</li>
            <li>Unichain applies the pause</li>
          </ol>
        )}
        {busy && (
          <div className="flex h-[300px] items-center gap-3 text-[15px] text-ink-2">
            <span className="live-dot h-2.5 w-2.5 rounded-full bg-go" /> Sending the pause and following it to every chain…
          </div>
        )}
        <AnimatePresence>
          {answer && (
            <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 border-l border-line">
              {answer.steps.map((s, i) => (
                <motion.li
                  key={s.url}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.35 }}
                  className="relative py-3 pl-6"
                >
                  <span className="absolute top-[22px] -left-[5px] h-2.5 w-2.5 rounded-full bg-go" />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-[16px] font-semibold">{s.what}</span>
                    <span className="num text-[14px] text-go-deep">
                      {i === 0 ? "start" : s.afterDecisionS !== undefined ? `${s.afterDecisionS}s after the decision` : `+${secs(s.seenAfterMs)}`}
                    </span>
                  </div>
                  <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
                    {s.network} <ArrowUpRight size={13} />
                  </a>
                </motion.li>
              ))}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: answer.steps.length * 0.35 }}
                className="pt-4 pl-6 text-[13px] text-mute"
              >
                {answer.complete ? "Paused on every chain. " : "Still arriving on one chain; open the links to follow it. "}
                {answer.shared ? `This check ran ${ago}s ago for another visitor, so it is shown again. ` : ""}
                The agent has already been restarted.
              </motion.p>
            </motion.ol>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
