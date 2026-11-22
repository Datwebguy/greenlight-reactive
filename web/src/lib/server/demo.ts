import "server-only";
import type { Address } from "viem";
import { latestCycle, medianDelivery } from "../cycle";
import { readOwner } from "./account";
import { recentDecisions } from "./db";

export const demoOwner = process.env.NEXT_PUBLIC_DEMO_OWNER as Address | undefined;

/** Everything the home page shows about the demo agent, read from the chains and the decision log. */
export async function demoData() {
  if (!demoOwner) return null;
  try {
    const view = await readOwner(demoOwner);
    if (!view.accounts.length) return null;
    const decisions = await recentDecisions(view.accounts.map((a) => ({ chainId: a.chainId, address: a.address })), 30).catch(
      () => [],
    );
    const signed = decisions.length ? decisions.filter((x) => x.source === "near-tee").length / decisions.length : null;
    const trades = view.timeline.filter((t) => t.kind === "trade").length;
    const judged = view.timeline.filter((t) => t.kind === "scored").length;
    return {
      view,
      decision: decisions[0] ?? null,
      decisions: decisions.slice(0, 8),
      signedShare: signed,
      cycle: latestCycle(view.timeline),
      delivery: medianDelivery(view.timeline),
      trades,
      judged,
    };
  } catch {
    return null;
  }
}
