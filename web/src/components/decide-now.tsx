"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Address } from "viem";
import { useSignMessage } from "wagmi";
import { decideMessage } from "@/lib/decide";
import { chainLabel } from "./chain-chip";
import { Button } from "./ui";

interface Result {
  chainId: number;
  outcome: string;
  action?: "buy" | "sell" | "hold";
  reason?: string;
}

function say(r: Result): { title: string; tone: "go" | "wait" | "mute" } {
  const where = chainLabel(r.chainId);
  if (r.outcome === "executed") return { title: `${r.action === "sell" ? "Sold" : "Bought"} on ${where}`, tone: "go" };
  if (r.outcome.startsWith("waiting for owner")) return { title: `Wants to ${r.action} on ${where}, waiting for your yes or no`, tone: "wait" };
  if (r.outcome === "held") return { title: `Chose to wait on ${where}`, tone: "mute" };
  if (r.outcome === "frozen") return { title: `Paused on ${where}`, tone: "mute" };
  if (r.outcome === "daily limit used") return { title: `Today's limit is used up on ${where}`, tone: "mute" };
  if (r.outcome === "decided a moment ago") return { title: `Decided a moment ago on ${where}`, tone: "mute" };
  return { title: `Could not decide on ${where} right now. Please try again shortly.`, tone: "mute" };
}

/** Lets the owner ask the agent for a decision now, instead of waiting for its next scheduled round. */
export function DecideNow({ owner }: { owner: Address }) {
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setError(null);
    setResults(null);
    try {
      setBusy("Confirm in your wallet. It's a free signature, nothing is sent.");
      const time = Math.floor(Date.now() / 1000);
      const signature = await signMessageAsync({ message: decideMessage(owner, time) });
      setBusy("The agent is reading the market…");
      const res = await fetch("/api/agent/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, time, signature }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Please try again.");
      setResults(body.results);
      if (body.results.length === 0) setError("The hosted agent isn't trading for this account. Turn the AI on under Manage.");
      await qc.invalidateQueries();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(/reject|denied|cancel/i.test(msg) ? "You cancelled in your wallet." : msg.split("\n")[0]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-go-soft/60 px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-go text-white dark:text-[#052e16]">
            <Sparkles size={20} />
          </span>
          <div>
            <div className="text-[17px] font-semibold tracking-tight">Ask the agent now</div>
            <p className="mt-0.5 max-w-xl text-[14px] text-ink-2">
              It decides on its own every few minutes. Ask now to see its next move straight away, with its reason.
            </p>
          </div>
        </div>
        <Button disabled={!!busy} onClick={ask} className="shrink-0">
          {busy ? "Deciding…" : "Decide now"}
        </Button>
      </div>
      {busy && <p className="text-[14px] text-ink-2">{busy}</p>}
      {error && <p className="text-[14px] text-stop">{error}</p>}
      <AnimatePresence>
        {results?.map((r, i) => {
          const s = say(r);
          return (
            <motion.div
              key={`${r.chainId}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="border-t border-line pt-4"
            >
              <div className={`text-[15px] font-semibold ${s.tone === "go" ? "text-go-deep" : s.tone === "wait" ? "text-wait" : "text-ink"}`}>{s.title}</div>
              {r.reason && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-2">{r.reason}</p>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
