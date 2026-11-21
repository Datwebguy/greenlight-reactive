import "server-only";
import { createPublicClient, http, type AbiEvent, type Address, type Log, type PublicClient } from "viem";
import { lasna, tradingChains } from "../config";

const clients = new Map<number, PublicClient>();

export function clientFor(chainId: number): PublicClient {
  let c = clients.get(chainId);
  if (!c) {
    const net = chainId === lasna.chain.id ? lasna : tradingChains.find((t) => t.chain.id === chainId);
    if (!net) throw new Error(`Unknown chain ${chainId}`);
    c = createPublicClient({ chain: net.chain, transport: http(net.rpcUrl, { retryCount: 2, timeout: 15_000 }) });
    clients.set(chainId, c);
  }
  return c;
}

function spanFor(chainId: number): bigint {
  if (chainId === lasna.chain.id) return lasna.logSpan;
  return tradingChains.find((t) => t.chain.id === chainId)!.logSpan;
}

export type TimedLog = Log<bigint, number, false> & {
  chainId: number;
  eventName: string;
  args: Record<string, unknown>;
  blockTimestamp?: number | bigint | string;
};

interface CacheEntry {
  scannedTo: bigint;
  logs: TimedLog[];
  busy?: Promise<unknown>;
}

// Logs already read, kept between requests on a warm server so each request only scans new blocks.
const cache = new Map<string, CacheEntry>();

/**
 * All logs of `events` emitted by `address` since `fromBlock`, read in windows the RPC accepts.
 * `args` narrows indexed fields, e.g. `{ owner }`.
 */
export async function readLogs(opts: {
  chainId: number;
  address: Address;
  events: readonly AbiEvent[];
  fromBlock: bigint;
  args?: Record<string, unknown>;
}): Promise<TimedLog[]> {
  const { chainId, address, events, fromBlock, args } = opts;
  const key = [chainId, address.toLowerCase(), events.map((e) => e.name).join(","), JSON.stringify(args ?? {})].join(
    "|",
  );
  let entry = cache.get(key);
  if (!entry) {
    entry = { scannedTo: fromBlock - 1n, logs: [] };
    cache.set(key, entry);
  }
  const e = entry;
  const client = clientFor(chainId);
  const scan = async () => {
    const head = await client.getBlockNumber();
    const span = spanFor(chainId);
    let from = e.scannedTo + 1n;
    while (from <= head) {
      const to = from + span > head ? head : from + span;
      const found = (await client.getLogs({
        address,
        events,
        args: args as never,
        fromBlock: from,
        toBlock: to,
        strict: true,
      })) as unknown as TimedLog[];
      for (const l of found) e.logs.push({ ...l, chainId });
      e.scannedTo = to;
      from = to + 1n;
    }
  };
  // Scans of the same key run one after another, so no window is read twice.
  const next = (e.busy ?? Promise.resolve()).then(scan);
  e.busy = next.catch(() => undefined);
  await next;
  return entry.logs;
}

export function timeOf(log: TimedLog): number {
  const t = log.blockTimestamp;
  if (t === undefined) return 0;
  return typeof t === "string" ? Number(BigInt(t)) : Number(t);
}
