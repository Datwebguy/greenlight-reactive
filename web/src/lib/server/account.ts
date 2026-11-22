import "server-only";
import { getAbiItem, type AbiEvent, type Address } from "viem";
import { greenlightAccountAbi, greenlightFactoryAbi, greenlightScorerAbi, venueTokenAbi } from "../abi";
import { chainById, lasna, tradingChains } from "../config";
import { clientFor, readLogs, timeOf, type TimedLog } from "./logs";

export interface PolicyView {
  startLimitCents: number;
  ceilingCents: number;
  floorCents: number;
  scoreWindow: number;
  maxSlippageBps: number;
  stepBps: number;
  raiseAfterWins: number;
  freezeAfterLosses: number;
  maxLossCents: number;
}

export interface RequestView {
  id: number;
  side: "buy" | "sell";
  amountCents: number;
  refPriceCents: number;
  deadline: number;
  verified: boolean;
  overLimit: boolean;
  tx: string;
  time: number;
}

export interface AccountView {
  chainId: number;
  chainName: string;
  address: Address;
  owner: Address;
  agent: Address;
  teeSigner: Address;
  modelId: string;
  policy: PolicyView;
  limitCents: number;
  remainingCents: number;
  frozen: boolean;
  ownerFrozen: boolean;
  scorerFrozen: boolean;
  appliedSeq: number;
  nextNonce: number;
  usd: number;
  eth: number;
  gas: number;
  openRequests: RequestView[];
}

export interface BookView {
  limitCents: number;
  seq: number;
  winStreak: number;
  lossStreak: number;
  wins: number;
  losses: number;
  pnlCents: number;
  lossSinceResetCents: number;
  frozen: boolean;
}

export type TimelineItem =
  | { kind: "joined"; chainId: number; time: number; tx: string; account: Address }
  | {
      kind: "trade";
      chainId: number;
      time: number;
      tx: string;
      account: Address;
      tradeId: number;
      side: "buy" | "sell";
      amountCents: number;
      price: number;
      verified: boolean;
      ownerApproved: boolean;
    }
  | {
      kind: "request";
      chainId: number;
      time: number;
      tx: string;
      account: Address;
      id: number;
      side: "buy" | "sell";
      amountCents: number;
      verified: boolean;
      overLimit: boolean;
    }
  | { kind: "resolved"; chainId: number; time: number; tx: string; account: Address; id: number; approved: boolean }
  | {
      kind: "scored";
      chainId: number;
      time: number;
      tx: string;
      account: Address;
      tradeChainId: number;
      tradeId: number;
      entryPrice: number;
      exitPrice: number;
      returnBps: number;
      pnlCents: number;
    }
  | { kind: "limit"; chainId: number; time: number; tx: string; seq: number; limitCents: number; frozen: boolean; reason: number }
  | { kind: "synced"; chainId: number; time: number; tx: string; account: Address; seq: number; limitCents: number; frozen: boolean; reason: number }
  | { kind: "owner"; chainId: number; time: number; tx: string; account: Address; frozen: boolean }
  | { kind: "policy"; chainId: number; time: number; tx: string; account: Address; version: number };

export interface Delivery {
  seq: number;
  reason: number;
  /** When the scorer decided, on Reactive Network. */
  decidedAt: number;
  decidedTx: string;
  /** The owner's own action that caused it, if any (freeze, unfreeze, policy). */
  origin?: { chainId: number; time: number; tx: string };
  arrivals: { chainId: number; account: Address; time: number; tx: string }[];
}

export interface OwnerView {
  owner: Address;
  book: BookView | null;
  accounts: AccountView[];
  timeline: TimelineItem[];
  deliveries: Delivery[];
  price: { value: number; updatedAt: number } | null;
}

const ev = (abi: readonly unknown[], name: string) => getAbiItem({ abi: abi as never, name: name as never }) as unknown as AbiEvent;

const accountEvents = [
  "TradeExecuted",
  "ApprovalRequested",
  "RequestResolved",
  "Synced",
  "OwnerAction",
  "PolicySet",
].map((n) => ev(greenlightAccountAbi, n));
const scorerEvents = ["TradeScored", "LimitUpdated"].map((n) => ev(greenlightScorerAbi, n));

const n = (v: unknown) => Number(v as bigint);
const sideOf = (v: unknown): "buy" | "sell" => (n(v) === 0 ? "buy" : "sell");

/** Every Greenlight account `owner` opened, on every chain. */
export async function accountsOf(owner: Address): Promise<{ chainId: number; address: Address; tx: string; time: number }[]> {
  const out: { chainId: number; address: Address; tx: string; time: number }[] = [];
  await Promise.all(
    tradingChains
      .filter((c) => c.factory)
      .map(async (c) => {
        const logs = await readLogs({
          chainId: c.chain.id,
          address: c.factory!,
          events: [ev(greenlightFactoryAbi, "AccountCreated")],
          fromBlock: c.fromBlock,
          args: { owner },
        });
        for (const l of logs) {
          out.push({ chainId: c.chain.id, address: l.args.account as Address, tx: l.transactionHash!, time: timeOf(l) });
        }
      }),
  );
  return out.sort((a, b) => a.time - b.time);
}

/** Every account opened on every chain, newest first. */
export async function allAccounts(): Promise<{ chainId: number; owner: Address; address: Address; agent?: Address; time: number }[]> {
  const out: { chainId: number; owner: Address; address: Address; time: number }[] = [];
  await Promise.all(
    tradingChains
      .filter((c) => c.factory)
      .map(async (c) => {
        const logs = await readLogs({
          chainId: c.chain.id,
          address: c.factory!,
          events: [ev(greenlightFactoryAbi, "AccountCreated")],
          fromBlock: c.fromBlock,
        });
        for (const l of logs) {
          out.push({ chainId: c.chain.id, owner: l.args.owner as Address, address: l.args.account as Address, time: timeOf(l) });
        }
      }),
  );
  return out.sort((a, b) => b.time - a.time);
}

export async function readAccount(chainId: number, address: Address): Promise<AccountView> {
  const net = chainById(chainId)!;
  const client = clientFor(chainId);
  const call = (functionName: string) => ({ address, abi: greenlightAccountAbi, functionName }) as const;
  const names = [
    "owner",
    "agent",
    "teeSigner",
    "modelId",
    "policy",
    "limitCents",
    "remainingToday",
    "frozen",
    "ownerFrozen",
    "scorerFrozen",
    "appliedSeq",
    "nextNonce",
    "usd",
    "weth",
  ] as const;
  const res = await client.multicall({ contracts: names.map((f) => call(f)) as never, allowFailure: false });
  const r = Object.fromEntries(names.map((k, i) => [k, res[i]])) as unknown as Record<(typeof names)[number], unknown>;
  const p = r.policy as readonly bigint[];
  const [usd, eth, gas] = await Promise.all([
    client.readContract({ address: r.usd as Address, abi: venueTokenAbi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: r.weth as Address, abi: venueTokenAbi, functionName: "balanceOf", args: [address] }),
    client.getBalance({ address }),
  ]);

  const logs = await readLogs({ chainId, address, events: accountEvents, fromBlock: net.fromBlock });
  const resolved = new Set(logs.filter((l) => l.eventName === "RequestResolved").map((l) => n(l.args.id)));
  const now = Date.now() / 1000;
  const openRequests: RequestView[] = logs
    .filter((l) => l.eventName === "ApprovalRequested" && !resolved.has(n(l.args.id)))
    .map((l) => {
      const o = l.args.order as Record<string, bigint>;
      return {
        id: n(l.args.id),
        side: sideOf(o.side),
        amountCents: n(o.amountCents),
        refPriceCents: n(o.refPriceCents),
        deadline: n(o.deadline),
        verified: Boolean(l.args.verified),
        overLimit: Boolean(l.args.overLimit),
        tx: l.transactionHash!,
        time: timeOf(l),
      };
    })
    .filter((q) => q.deadline > now);

  return {
    chainId,
    chainName: net.chain.name,
    address,
    owner: r.owner as Address,
    agent: r.agent as Address,
    teeSigner: r.teeSigner as Address,
    modelId: r.modelId as string,
    policy: {
      startLimitCents: n(p[0]),
      ceilingCents: n(p[1]),
      floorCents: n(p[2]),
      scoreWindow: n(p[3]),
      maxSlippageBps: n(p[4]),
      stepBps: n(p[5]),
      raiseAfterWins: n(p[6]),
      freezeAfterLosses: n(p[7]),
      maxLossCents: n(p[8]),
    },
    limitCents: n(r.limitCents),
    remainingCents: n(r.remainingToday),
    frozen: Boolean(r.frozen),
    ownerFrozen: Boolean(r.ownerFrozen),
    scorerFrozen: Boolean(r.scorerFrozen),
    appliedSeq: n(r.appliedSeq),
    nextNonce: n(r.nextNonce),
    usd: Number(usd) / 1e6,
    eth: Number(eth) / 1e18,
    gas: Number(gas) / 1e18,
    openRequests,
  };
}

function toItems(logs: TimedLog[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const l of logs) {
    const base = { chainId: l.chainId, time: timeOf(l), tx: l.transactionHash! };
    const a = l.args;
    const account = l.address as Address;
    switch (l.eventName) {
      case "TradeExecuted":
        items.push({
          ...base,
          kind: "trade",
          account,
          tradeId: n(a.tradeId),
          side: sideOf(a.side),
          amountCents: n(a.amountCents),
          price: n(a.price) / 1e8,
          verified: Boolean(a.verified),
          ownerApproved: Boolean(a.ownerApproved),
        });
        break;
      case "ApprovalRequested": {
        const o = a.order as Record<string, bigint>;
        items.push({
          ...base,
          kind: "request",
          account,
          id: n(a.id),
          side: sideOf(o.side),
          amountCents: n(o.amountCents),
          verified: Boolean(a.verified),
          overLimit: Boolean(a.overLimit),
        });
        break;
      }
      case "RequestResolved":
        items.push({ ...base, kind: "resolved", account, id: n(a.id), approved: Boolean(a.approved) });
        break;
      case "Synced":
        items.push({
          ...base,
          kind: "synced",
          account,
          seq: n(a.seq),
          limitCents: n(a.limitCents),
          frozen: Boolean(a.frozen),
          reason: n(a.reason),
        });
        break;
      case "OwnerAction":
        items.push({ ...base, kind: "owner", account, frozen: Boolean(a.frozen) });
        break;
      case "PolicySet":
        items.push({ ...base, kind: "policy", account, version: n(a.version) });
        break;
      case "TradeScored":
        items.push({
          ...base,
          kind: "scored",
          account: a.account as Address,
          tradeChainId: n(a.chainId),
          tradeId: n(a.tradeId),
          entryPrice: n(a.entryPrice) / 1e8,
          exitPrice: n(a.exitPrice) / 1e8,
          returnBps: n(a.returnBps),
          pnlCents: n(a.pnlCents),
        });
        break;
      case "LimitUpdated":
        items.push({
          ...base,
          kind: "limit",
          seq: n(a.seq),
          limitCents: n(a.limitCents),
          frozen: Boolean(a.frozen),
          reason: n(a.reason),
        });
        break;
    }
  }
  return items;
}

const OWNER_REASONS = new Set([2, 7, 8]); // policy, owner froze, owner unfroze

export async function readOwner(owner: Address): Promise<OwnerView> {
  const list = await accountsOf(owner);
  const [accounts, scorerLogs, accountLogs, book, price] = await Promise.all([
    Promise.all(list.map((a) => readAccount(a.chainId, a.address))),
    lasna.scorer
      ? readLogs({ chainId: lasna.chain.id, address: lasna.scorer, events: scorerEvents, fromBlock: lasna.fromBlock, args: { owner } })
      : Promise.resolve([] as TimedLog[]),
    Promise.all(
      list.map((a) =>
        readLogs({ chainId: a.chainId, address: a.address, events: accountEvents, fromBlock: chainById(a.chainId)!.fromBlock }),
      ),
    ).then((x) => x.flat()),
    readBook(owner),
    readPrice(),
  ]);

  const timeline = [
    ...list.map((a) => ({ kind: "joined" as const, chainId: a.chainId, time: a.time, tx: a.tx, account: a.address })),
    ...toItems(scorerLogs),
    ...toItems(accountLogs),
  ].sort((x, y) => x.time - y.time || x.chainId - y.chainId);

  const deliveries: Delivery[] = [];
  const ownerActs = timeline.filter((t) => t.kind === "owner" || t.kind === "policy");
  for (const lim of timeline.filter((t): t is Extract<TimelineItem, { kind: "limit" }> => t.kind === "limit")) {
    const arrivals = timeline
      .filter((t): t is Extract<TimelineItem, { kind: "synced" }> => t.kind === "synced" && t.seq === lim.seq && t.reason === lim.reason)
      .map((t) => ({ chainId: t.chainId, account: t.account, time: t.time, tx: t.tx }));
    let origin: Delivery["origin"];
    if (OWNER_REASONS.has(lim.reason)) {
      const o = [...ownerActs].reverse().find((t) => t.time <= lim.time);
      if (o) origin = { chainId: o.chainId, time: o.time, tx: o.tx };
    }
    deliveries.push({ seq: lim.seq, reason: lim.reason, decidedAt: lim.time, decidedTx: lim.tx, origin, arrivals });
  }

  return { owner, book, accounts, timeline, deliveries, price };
}

export async function readBook(owner: Address): Promise<BookView | null> {
  if (!lasna.scorer) return null;
  const b = (await clientFor(lasna.chain.id).readContract({
    address: lasna.scorer,
    abi: greenlightScorerAbi,
    functionName: "bookOf",
    args: [owner],
  })) as Record<string, unknown>;
  if (!b.exists) return null;
  return {
    limitCents: n(b.limitCents),
    seq: n(b.seq),
    winStreak: n(b.winStreak),
    lossStreak: n(b.lossStreak),
    wins: n(b.wins),
    losses: n(b.losses),
    pnlCents: n(b.pnlCents),
    lossSinceResetCents: n(b.lossSinceResetCents),
    frozen: Boolean(b.frozen),
  };
}

const feedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export async function readPrice(chainId = tradingChains[0].chain.id): Promise<{ value: number; updatedAt: number } | null> {
  const net = chainById(chainId)!;
  try {
    const [, answer, , updatedAt] = await clientFor(chainId).readContract({
      address: net.priceFeed,
      abi: feedAbi,
      functionName: "latestRoundData",
    });
    return { value: Number(answer) / 1e8, updatedAt: Number(updatedAt) };
  } catch {
    return null;
  }
}
