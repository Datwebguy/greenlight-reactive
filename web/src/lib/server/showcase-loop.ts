import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, unichainSepolia } from "viem/chains";

/**
 * One owner action and everything Reactive Network does about it, timed. The owner pauses (or restarts) the agent on
 * Base; the scorer on Lasna reacts; the update lands on the owner's accounts on Base and Unichain. Used by the site's
 * one-tap check and by the benchmark script, so both report the same thing the same way.
 */

const lasna = defineChain({
  id: 5318007,
  name: "Reactive Lasna",
  nativeCurrency: { name: "REACT", symbol: "REACT", decimals: 18 },
  rpcUrls: { default: { http: ["https://lasna-rpc.rnk.dev/"] } },
});

export const loopChains = {
  base: { chain: baseSepolia, rpc: "https://base-sepolia-rpc.publicnode.com", explorer: "https://sepolia.basescan.org" },
  unichain: { chain: unichainSepolia, rpc: "https://sepolia.unichain.org", explorer: "https://sepolia.uniscan.xyz" },
  lasna: { chain: lasna, rpc: "https://lasna-rpc.rnk.dev/", explorer: "https://lasna.reactscan.net" },
} as const;

const accountAbi = parseAbi(["function freeze()", "function unfreeze()", "function appliedSeq() view returns (uint64)", "function ownerFrozen() view returns (bool)"]);
const synced = parseAbiItem("event Synced(uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason)");
const limitUpdated = parseAbiItem("event LimitUpdated(address indexed owner, uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason)");

export interface LoopStep {
  network: "Base Sepolia" | "Reactive Lasna" | "Unichain Sepolia";
  what: string;
  tx: Hex;
  url: string;
  /** Block time, in seconds since the epoch. */
  time: number;
  /** Seconds after the scorer's decision, by block time (callbacks only). */
  afterDecisionS?: number;
  /** Milliseconds after the owner's transaction was confirmed, as seen by this client. */
  seenAfterMs: number;
}

export interface LoopResult {
  action: "freeze" | "unfreeze";
  steps: LoopStep[];
  complete: boolean;
}

const clients = new Map<string, PublicClient>();
function client(key: keyof typeof loopChains): PublicClient {
  if (!clients.has(key)) {
    const c = loopChains[key];
    clients.set(key, createPublicClient({ chain: c.chain, transport: http(c.rpc, { retryCount: 2, timeout: 10_000 }) }) as PublicClient);
  }
  return clients.get(key)!;
}

/** Block time; load-balanced nodes can report a log a moment before they serve its block, so ask again briefly. */
async function blockTime(key: keyof typeof loopChains, block: bigint): Promise<number> {
  for (let i = 0; ; i++) {
    try {
      return Number((await client(key).getBlock({ blockNumber: block })).timestamp);
    } catch (e) {
      if (i >= 8) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Runs one freeze or restart from `ownerKey` on its Base account and follows it to every chain. */
export async function runLoop(opts: {
  ownerKey: Hex;
  scorer: Address;
  base: Address;
  unichain: Address;
  action: "freeze" | "unfreeze";
  timeoutMs?: number;
}): Promise<LoopResult> {
  const owner = privateKeyToAccount(opts.ownerKey);
  const [lasnaFrom, baseFrom, uniFrom] = await Promise.all([
    client("lasna").getBlockNumber(),
    client("base").getBlockNumber(),
    client("unichain").getBlockNumber(),
  ]);
  const wallet = createWalletClient({ account: owner, chain: baseSepolia, transport: http(loopChains.base.rpc) });
  const hash = await wallet.writeContract({ address: opts.base, abi: accountAbi, functionName: opts.action });
  const receipt = await client("base").waitForTransactionReceipt({ hash });
  const t0 = Date.now();
  if (receipt.status !== "success") throw new Error("The owner's transaction did not go through");

  const steps: LoopStep[] = [
    {
      network: "Base Sepolia",
      what: opts.action === "freeze" ? "Owner paused the agent" : "Owner restarted the agent",
      tx: hash,
      url: `${loopChains.base.explorer}/tx/${hash}`,
      time: await blockTime("base", receipt.blockNumber),
      seenAfterMs: 0,
    },
  ];

  const deadline = t0 + (opts.timeoutMs ?? 40_000);
  let decision: { tx: Hex; seq: bigint; time: number } | null = null;
  const landed: Partial<Record<"base" | "unichain", LoopStep>> = {};
  while (Date.now() < deadline && !(decision && landed.base && landed.unichain)) {
    await new Promise((r) => setTimeout(r, 400));
    if (!decision) {
      const logs = await client("lasna")
        .getLogs({ address: opts.scorer, event: limitUpdated, args: { owner: owner.address }, fromBlock: lasnaFrom })
        .catch(() => []);
      const l = logs.find((x) => x.args.frozen === (opts.action === "freeze"));
      if (l) {
        decision = { tx: l.transactionHash!, seq: l.args.seq!, time: await blockTime("lasna", l.blockNumber!) };
        steps.push({
          network: "Reactive Lasna",
          what: opts.action === "freeze" ? "Scorer froze the agent everywhere" : "Scorer restarted the agent everywhere",
          tx: decision.tx,
          url: `${loopChains.lasna.explorer}/tx/${decision.tx}`,
          time: decision.time,
          seenAfterMs: Date.now() - t0,
        });
      }
    }
    if (!decision) continue;
    for (const [key, address, from, network] of [
      ["base", opts.base, baseFrom, "Base Sepolia"],
      ["unichain", opts.unichain, uniFrom, "Unichain Sepolia"],
    ] as const) {
      if (landed[key]) continue;
      const logs = await client(key).getLogs({ address, event: synced, fromBlock: from }).catch(() => []);
      const l = logs.find((x) => x.args.seq! >= decision!.seq);
      if (!l) continue;
      const time = await blockTime(key, l.blockNumber!);
      landed[key] = {
        network,
        what: opts.action === "freeze" ? "Agent frozen here" : "Agent trading again here",
        tx: l.transactionHash!,
        url: `${loopChains[key].explorer}/tx/${l.transactionHash}`,
        time,
        afterDecisionS: Math.max(0, time - decision.time),
        seenAfterMs: Date.now() - t0,
      };
    }
  }
  if (landed.base) steps.push(landed.base);
  if (landed.unichain) steps.push(landed.unichain);
  return { action: opts.action, steps, complete: steps.length === 4 };
}
