import "server-only";
import { head, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { createPublicClient, http, type AbiEvent, type Address, type Log, type PublicClient } from "viem";
import { lasna, tradingChains } from "../config";

const clients = new Map<string, PublicClient>();

function netFor(chainId: number) {
  const net = chainId === lasna.chain.id ? lasna : tradingChains.find((t) => t.chain.id === chainId);
  if (!net) throw new Error(`Unknown chain ${chainId}`);
  return net;
}

function makeClient(chainId: number, url: string): PublicClient {
  const key = `${chainId}|${url}`;
  let c = clients.get(key);
  if (!c) {
    c = createPublicClient({ chain: netFor(chainId).chain, transport: http(url, { retryCount: 2, timeout: 15_000 }) });
    clients.set(key, c);
  }
  return c;
}

/** Client for current state (balances, contract reads). */
export function clientFor(chainId: number): PublicClient {
  return makeClient(chainId, netFor(chainId).rpcUrl);
}

/** Client for history. Some fast public nodes drop old history, so history can come from a node that keeps it. */
function historyClient(chainId: number): PublicClient {
  const net = netFor(chainId);
  return makeClient(chainId, ("logRpcUrl" in net && net.logRpcUrl) || net.rpcUrl);
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
  savedTo: bigint;
  busy?: Promise<unknown>;
}

// Logs already read, kept between requests on a warm server so each request only scans new blocks.
const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------- stored copy, so cold starts skip old blocks

const persist = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const storeKey = (key: string) => `history/${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`;
const toJson = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { $big: x.toString() } : x));
const fromJson = (s: string) =>
  JSON.parse(s, (_k, x) => (x && typeof x === "object" && "$big" in x && Object.keys(x).length === 1 ? BigInt(x.$big) : x));

async function loadStored(key: string): Promise<{ scannedTo: bigint; logs: TimedLog[] } | null> {
  if (!persist) return null;
  try {
    const meta = await head(storeKey(key));
    const res = await fetch(`${meta.url}?v=${meta.uploadedAt.getTime()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = fromJson(await res.text());
    return { scannedTo: BigInt(data.scannedTo), logs: data.logs };
  } catch {
    return null;
  }
}

async function saveStored(key: string, e: CacheEntry): Promise<void> {
  if (!persist) return;
  try {
    await put(storeKey(key), toJson({ scannedTo: e.scannedTo, logs: e.logs }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    e.savedTo = e.scannedTo;
  } catch (err) {
    console.warn(`Could not store history: ${(err as Error).message.split("\n")[0]}`);
  }
}

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
  const key = [chainId, address.toLowerCase(), events.map((e) => e.name).join(","), JSON.stringify(args ?? {}), fromBlock].join("|");
  let entry = cache.get(key);
  if (!entry) {
    const stored = await loadStored(key);
    entry = stored
      ? { scannedTo: stored.scannedTo, logs: stored.logs, savedTo: stored.scannedTo }
      : { scannedTo: fromBlock - 1n, logs: [], savedTo: fromBlock - 1n };
    cache.set(key, entry);
  }
  const e = entry;
  const client = historyClient(chainId);
  const span = netFor(chainId).logSpan;
  const scan = async () => {
    // Public RPCs are load-balanced and their nodes can lag a block or two behind each other.
    const headBlock = (await client.getBlockNumber()) - 3n;
    const before = e.logs.length;
    let from = e.scannedTo + 1n;
    while (from <= headBlock) {
      const to = from + span > headBlock ? headBlock : from + span;
      let found: TimedLog[];
      try {
        found = (await client.getLogs({
          address,
          events,
          args: args as never,
          fromBlock: from,
          toBlock: to,
          strict: true,
        })) as unknown as TimedLog[];
      } catch (err) {
        // Keep what has been read; the next request continues from here.
        console.warn(`Log read on chain ${chainId} paused at block ${from}: ${(err as Error).message.split("\n")[0]}`);
        break;
      }
      // Some RPCs omit the block time on logs, or report it as zero; read it from the block instead.
      const hasTime = (l: TimedLog) => Boolean(l.blockTimestamp) && BigInt(l.blockTimestamp as bigint) > 0n;
      const missing = [...new Set(found.filter((l) => !hasTime(l)).map((l) => l.blockNumber!))];
      const times = new Map<bigint, bigint>();
      await Promise.all(missing.map(async (n) => times.set(n, (await client.getBlock({ blockNumber: n })).timestamp)));
      for (const l of found) {
        e.logs.push({ ...l, chainId, blockTimestamp: hasTime(l) ? l.blockTimestamp : times.get(l.blockNumber!) });
      }
      e.scannedTo = to;
      from = to + 1n;
    }
    // Store progress when something new was found, or after a good stretch of empty blocks.
    if (e.logs.length !== before || e.scannedTo - e.savedTo > span * 5n) await saveStored(key, e);
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
