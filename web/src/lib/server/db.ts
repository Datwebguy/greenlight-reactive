import "server-only";
import { list, put } from "@vercel/blob";

/**
 * The agent's decision log, including holds, which leave no trace on-chain. Each decision is one small JSON file in
 * Vercel Blob, filed under its account and named so that a listing returns the newest first. Optional: without the
 * store the agent still trades and everything else is read from the chains.
 */
const enabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const MAX_TS = 9_999_999_999_999;

export interface DecisionRow {
  chainId: number;
  account: string;
  owner: string;
  source: "near-tee" | "openai";
  action: "buy" | "sell" | "hold";
  orderText: string | null;
  confidence: number | null;
  reason: string;
  priceCents: number;
  remainingCents: number;
  latencyMs: number;
  chatId: string | null;
  signer: string | null;
  tx: string | null;
  outcome: string;
}

const folder = (chainId: number, account: string) => `decisions/${chainId}-${account.toLowerCase()}/`;

export async function recordDecision(d: DecisionRow): Promise<void> {
  if (!enabled) return;
  const now = Date.now();
  const name = `${String(MAX_TS - now).padStart(13, "0")}.json`;
  await put(folder(d.chainId, d.account) + name, JSON.stringify({ ...d, createdAt: new Date(now).toISOString() }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

function timeFromPath(pathname: string): number {
  const n = Number(pathname.split("/").pop()!.replace(".json", ""));
  return Number.isFinite(n) ? (MAX_TS - n) / 1000 : 0;
}

export async function lastDecisionAt(chainId: number, account: string): Promise<number | null> {
  if (!enabled) return null;
  const { blobs } = await list({ prefix: folder(chainId, account), limit: 1 });
  return blobs[0] ? timeFromPath(blobs[0].pathname) : null;
}

export async function recentDecisions(
  accounts: { chainId: number; address: string }[],
  limit = 20,
): Promise<(DecisionRow & { createdAt: string })[]> {
  if (!enabled) return [];
  const lists = await Promise.all(accounts.map((a) => list({ prefix: folder(a.chainId, a.address), limit })));
  const blobs = lists
    .flatMap((l) => l.blobs)
    .sort((a, b) => a.pathname.split("/").pop()!.localeCompare(b.pathname.split("/").pop()!))
    .slice(0, limit);
  const rows = await Promise.all(
    blobs.map(async (b) => {
      try {
        const r = await fetch(b.url, { cache: "force-cache" });
        return (await r.json()) as DecisionRow & { createdAt: string };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is DecisionRow & { createdAt: string } => r !== null);
}

export const hasDecisionLog = enabled;
