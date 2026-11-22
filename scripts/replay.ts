/**
 * Replays everything Greenlight has done on the test networks, straight from the chains. No keys, no setup.
 *
 *   npm run replay                 every owner
 *   npm run replay -- 0xOwner...   one owner
 *   npm run replay -- --deployment testnet-v1   the first deployment
 *
 * For each owner it prints, in time order: accounts opened, trades the AI made (and whether the enclave signed
 * them), the scorer's verdicts on Reactive Network, limit changes and freezes, and when each change reached each
 * chain, with the delay in seconds and a link to every transaction.
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, parseAbiItem, type AbiEvent, type Address, type Log } from "viem";
import { chains, lasna } from "./networks.ts";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const depIdx = args.indexOf("--deployment");
const deployment = depIdx >= 0 ? args.splice(depIdx, 2)[1] : "testnet";
const d = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${deployment}.json`), "utf8"));
const onlyOwner = args[0]?.toLowerCase();

const explorer: Record<number, string> = {
  [lasna.viem.id]: "https://lasna.reactscan.net/tx/",
  84532: "https://sepolia.basescan.org/tx/",
  1301: "https://sepolia.uniscan.xyz/tx/",
};
const label: Record<number, string> = { [lasna.viem.id]: "Reactive", 84532: "Base", 1301: "Unichain" };
const reasons = ["", "linked", "rules updated", "raised after a winning streak", "cut after a loss", "frozen after a losing streak", "frozen after too large a loss", "frozen by the owner", "unfrozen by the owner", "re-sent on request"];

const ev = {
  created: parseAbiItem("event AccountCreated(address indexed owner, address indexed account, (uint64,uint64,uint64,uint32,uint16,uint16,uint8,uint8,uint64) policy)"),
  trade: parseAbiItem("event TradeExecuted(uint64 indexed tradeId, uint8 side, uint64 amountCents, uint256 price, uint64 timestamp, bool verified, bool ownerApproved)"),
  request: parseAbiItem("event ApprovalRequested(uint64 indexed id, (uint8,uint64,uint64,uint64,uint64) order, bool verified, bool overLimit)"),
  synced: parseAbiItem("event Synced(uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason)"),
  ownerAction: parseAbiItem("event OwnerAction(uint64 indexed count, bool frozen)"),
  scored: parseAbiItem("event TradeScored(address indexed owner, uint256 chainId, address account, uint64 tradeId, uint256 entryPrice, uint256 exitPrice, int256 returnBps, int256 pnlCents)"),
  limit: parseAbiItem("event LimitUpdated(address indexed owner, uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason)"),
};

type Row = { time: number; chainId: number; tx: string; text: string; owner: string; seq?: number; reason?: number; kind: string };

const clients = new Map<number, ReturnType<typeof createPublicClient>>();
function client(chainId: number) {
  if (!clients.has(chainId)) {
    const net = chainId === lasna.viem.id ? lasna : chains.find((c) => c.viem.id === chainId)!;
    // Unichain's official node keeps full history (1,000 blocks per query); fast public nodes drop it.
    const url = chainId === 1301 ? (process.env.UNICHAIN_SEPOLIA_HISTORY_RPC_URL ?? "https://sepolia.unichain.org") : net.rpcUrl;
    clients.set(chainId, createPublicClient({ chain: net.viem, transport: http(url, { retryCount: 3 }) }));
  }
  return clients.get(chainId)!;
}
const span = (chainId: number) => (chainId === 84532 ? 49_999n : chainId === 1301 ? 999n : 9_999n);

async function logs(chainId: number, address: Address, events: AbiEvent[], fromBlock: bigint) {
  const c = client(chainId);
  const head = (await c.getBlockNumber()) - 3n;
  const out: Log[] = [];
  for (let from = fromBlock; from <= head; ) {
    const to = from + span(chainId) > head ? head : from + span(chainId);
    out.push(...((await c.getLogs({ address, events, fromBlock: from, toBlock: to, strict: true })) as Log[]));
    from = to + 1n;
  }
  const times = new Map<bigint, number>();
  for (const n of new Set(out.map((l) => l.blockNumber!))) times.set(n, Number((await c.getBlock({ blockNumber: n })).timestamp));
  return out.map((l) => ({ ...(l as Log & { eventName: string; args: Record<string, any> }), time: times.get(l.blockNumber!)! }));
}

const usd = (c: bigint | number) => `$${(Number(c) / 100).toFixed(2)}`;
const rows: Row[] = [];
const accountOwner = new Map<string, string>();

for (const net of chains) {
  const entry = d.chains?.[net.viem.id];
  if (!entry?.factory) continue;
  const from = BigInt(entry.venue.block);
  // The current factory and every earlier one: their accounts keep running.
  const factories = [entry.factory, ...(entry.previousFactories ?? [])].map((f: { address: Address }) => f.address);
  const created = (await Promise.all(factories.map((f: Address) => logs(net.viem.id, f, [ev.created], from)))).flat();
  for (const l of created) {
    const owner = String(l.args.owner).toLowerCase();
    accountOwner.set(`${net.viem.id}:${String(l.args.account).toLowerCase()}`, owner);
    rows.push({ time: l.time, chainId: net.viem.id, tx: l.transactionHash!, owner, kind: "open", text: `Account opened (${l.args.account})` });
    for (const a of await logs(net.viem.id, l.args.account as Address, [ev.trade, ev.request, ev.synced, ev.ownerAction], from)) {
      const x = a.args;
      const text =
        a.eventName === "TradeExecuted"
          ? `AI ${x.side === 0 ? "bought" : "sold"} ${usd(x.amountCents)} of ETH at $${(Number(x.price) / 1e8).toFixed(2)}${x.verified ? ", signed by the NEAR enclave and checked on-chain" : x.ownerApproved ? ", approved by the owner" : ""}`
          : a.eventName === "ApprovalRequested"
            ? `AI asked the owner to approve a trade (${x.verified ? "over the limit" : "not signed by the enclave"})`
            : a.eventName === "Synced"
              ? `Update #${x.seq} applied: ${x.frozen ? "frozen" : `limit ${usd(x.limitCents)}`}`
              : `Owner ${x.frozen ? "froze" : "unfroze"} the agent`;
      rows.push({ time: a.time, chainId: net.viem.id, tx: a.transactionHash!, owner, kind: a.eventName, seq: a.eventName === "Synced" ? Number(x.seq) : undefined, reason: a.eventName === "Synced" ? Number(x.reason) : undefined, text });
    }
  }
}

for (const l of await logs(lasna.viem.id, d.scorer.address, [ev.scored, ev.limit], BigInt(d.scorer.block))) {
  const x = l.args;
  const owner = String(x.owner).toLowerCase();
  const text =
    l.eventName === "TradeScored"
      ? `Scorer judged trade #${x.tradeId}: ${Number(x.returnBps) >= 0 ? "+" : ""}${(Number(x.returnBps) / 100).toFixed(2)}% (${Number(x.pnlCents) > 0 || Number(x.returnBps) > 0 ? "win" : Number(x.pnlCents) < 0 || Number(x.returnBps) < 0 ? "loss" : "even"}), $${(Number(x.entryPrice) / 1e8).toFixed(2)} -> $${(Number(x.exitPrice) / 1e8).toFixed(2)}`
      : `Scorer decision #${x.seq}: ${reasons[Number(x.reason)]}, ${x.frozen ? "FROZEN" : `limit ${usd(x.limitCents)}`}`;
  rows.push({ time: l.time, chainId: lasna.viem.id, tx: l.transactionHash!, owner, kind: l.eventName, seq: l.eventName === "LimitUpdated" ? Number(x.seq) : undefined, reason: l.eventName === "LimitUpdated" ? Number(x.reason) : undefined, text });
}

rows.sort((a, b) => a.time - b.time || (a.chainId === lasna.viem.id ? 1 : 0) - (b.chainId === lasna.viem.id ? 1 : 0));
const owners = [...new Set(rows.map((r) => r.owner))].filter((o) => !onlyOwner || o === onlyOwner);
for (const owner of owners) {
  console.log(`\nOwner ${owner}`);
  const mine = rows.filter((r) => r.owner === owner);
  const decided = new Map(mine.filter((r) => r.kind === "LimitUpdated").map((r) => [r.seq, r]));
  const delays: number[] = [];
  for (const r of mine) {
    let extra = "";
    // A delivery of that decision, not a later copy of the same state sent to an account that joined afterwards.
    const d = r.kind === "Synced" ? decided.get(r.seq) : undefined;
    if (d && d.reason === r.reason) {
      const s = r.time - d.time;
      delays.push(s);
      extra = `  (${s}s after the scorer's decision)`;
    }
    console.log(`  ${new Date(r.time * 1000).toISOString().replace("T", " ").slice(0, 19)}  ${label[r.chainId].padEnd(8)} ${r.text}${extra}`);
    console.log(`  ${" ".repeat(19)}  ${" ".repeat(8)} ${explorer[r.chainId]}${r.tx}`);
  }
  if (delays.length) {
    delays.sort((a, b) => a - b);
    console.log(`  Scorer decision to chain: median ${delays[Math.floor(delays.length / 2)]}s over ${delays.length} update(s), slowest ${delays.at(-1)}s`);
  }
}
