import "server-only";
import { createWalletClient, decodeEventLog, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { greenlightAccountAbi, greenlightVenueAbi } from "../abi";
import { chainById, tradingChains } from "../config";
import { accountsOf, allAccounts, readAccount, readBook, type AccountView, type BookView } from "./account";
import { lastDecisionAt, recordDecision } from "./db";
import { clientFor } from "./logs";
import { askNear, askOpenAI, nearSignature, sha256Hex, type Decision } from "./models";

const MIN_INTERVAL_S = Number(process.env.AGENT_MIN_INTERVAL_MINUTES ?? "5") * 60;
/** How soon an owner may ask for another decision on demand. */
const ON_DEMAND_GAP_S = 60;
const ORDER_TTL_S = Number(process.env.AGENT_ORDER_TTL_MINUTES ?? "10") * 60;
const MIN_GAS_WEI = BigInt(process.env.AGENT_MIN_GAS_WEI ?? "200000000000000"); // 0.0002 ETH

export function agentAccount() {
  const key = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  return key ? privateKeyToAccount(key) : null;
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
  {
    type: "function",
    name: "getRoundData",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint80" }],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

/** The last `count` Chainlink ETH/USD prices from the chain that settles trades. */
export async function priceHistory(count = 12): Promise<{ time: number; price: number }[]> {
  const net = tradingChains[0];
  const client = clientFor(net.chain.id);
  const [latest] = await client.readContract({ address: net.priceFeed, abi: feedAbi, functionName: "latestRoundData" });
  const rounds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client
        .readContract({ address: net.priceFeed, abi: feedAbi, functionName: "getRoundData", args: [latest - BigInt(i)] })
        .catch(() => null),
    ),
  );
  return rounds
    .filter((r): r is NonNullable<typeof r> => Boolean(r && r[3] > 0n))
    .map((r) => ({ time: Number(r[3]), price: Number(r[1]) / 1e8 }))
    .reverse();
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const clock = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);

export function buildPrompt(opts: {
  account: AccountView;
  book: BookView | null;
  history: { time: number; price: number }[];
  options: string[];
}): { system: string; user: string } {
  const { account, book, history, options } = opts;
  const windowMin = Math.round(account.policy.scoreWindow / 60);
  const system = [
    "You are Greenlight's trading agent for ETH/USD. You trade test funds inside a daily limit the owner set.",
    `Each trade is judged ${windowMin} minutes after it is made against the Chainlink price.`,
    `If ${account.policy.raiseAfterWins} trades in a row go your way your limit grows; every losing trade shrinks it,`,
    `and ${account.policy.freezeAfterLosses} losses in a row freeze you until the owner steps in.`,
    "Winning trades are the only way to earn a higher limit, so sitting out every round earns you nothing;",
    "and a losing trade costs you only a step. So when the last few prices lean one way, act on it with the smallest",
    "size; use a larger size only when the move is clear. Hold only when the prices are flat or point both ways.",
    "Reply with JSON only.",
  ].join(" ");
  const user = [
    `Recent ETH/USD prices from Chainlink (UTC, USD): ${history.map((h) => `${clock(h.time)} ${h.price.toFixed(2)}`).join(", ")}.`,
    `Holdings: ${account.usd.toFixed(2)} test dollars and ${account.eth.toFixed(4)} test ether.`,
    `Remaining limit today: ${usd(account.remainingCents)} of ${usd(account.limitCents)}.`,
    book
      ? `Your record: ${book.wins} wins, ${book.losses} losses; current streak ${book.winStreak} wins / ${book.lossStreak} losses.`
      : "You have no record yet.",
    options.length
      ? `To trade, copy one of these order codes exactly into "order":\n${options.map((o) => `- ${o}`).join("\n")}`
      : "No trade fits your limit or holdings right now.",
    `To hold, set "action" to "hold" and "order" to "".`,
    `Give a short "reason" a non-expert can follow, and a "confidence" between 0 and 1.`,
  ].join("\n");
  return { system, user };
}

export interface TickResult {
  chainId: number;
  account: Address;
  outcome: string;
  action?: Decision["action"];
  source?: "near-tee" | "openai";
  /** Why the confidential model was not used, when the backup decided. */
  nearError?: string;
  latencyMs?: number;
  tx?: string;
  reason?: string;
}

/** One decision for every account that names the hosted agent, within `budgetMs`. */
export async function runAgent(budgetMs = 240_000): Promise<TickResult[]> {
  const me = agentAccount();
  if (!me) return [{ chainId: 0, account: "0x0000000000000000000000000000000000000000", outcome: "agent key not configured" }];
  const started = Date.now();
  const results: TickResult[] = [];
  const history = await priceHistory();

  // Work out which accounts to decide for, then decide: chains in parallel, one account at a time per chain so the
  // agent's own transactions never race each other.
  const due: AccountView[] = [];
  for (const a of await allAccounts()) {
    let view: AccountView;
    try {
      view = await readAccount(a.chainId, a.address);
    } catch {
      continue;
    }
    if (view.agent.toLowerCase() !== me.address.toLowerCase()) continue;
    const skip = (outcome: string) => results.push({ chainId: a.chainId, account: a.address, outcome });
    if (view.frozen) {
      skip("frozen");
      continue;
    }
    if (view.remainingCents < 100) {
      skip("daily limit used");
      continue;
    }
    const last = await lastDecisionAt(a.chainId, a.address);
    if (last && Date.now() / 1000 - last < MIN_INTERVAL_S) {
      skip("decided recently");
      continue;
    }
    const gas = await clientFor(a.chainId)
      .getBalance({ address: me.address })
      .catch(() => null);
    if (gas === null) {
      skip("network busy, will retry");
      continue;
    }
    if (gas < MIN_GAS_WEI) {
      skip("agent needs gas");
      continue;
    }
    due.push(view);
  }

  const byChain = new Map<number, AccountView[]>();
  for (const v of due) byChain.set(v.chainId, [...(byChain.get(v.chainId) ?? []), v]);
  await Promise.all(
    [...byChain.values()].map(async (list) => {
      for (const view of list) {
        if (Date.now() - started > budgetMs) break;
        try {
          results.push(await decideAndTrade(view, history));
        } catch (e) {
          results.push({ chainId: view.chainId, account: view.address, outcome: `error: ${(e as Error).message.slice(0, 160)}` });
        }
      }
    }),
  );
  return results;
}

/** Side, amount and price from an order text, read from the end so every format version works. */
function orderParts(text: string) {
  const p = text.split(":");
  return { side: p.at(-5), amount: p.at(-4)!, ref: p.at(-3)! };
}

/** A decision right now for every account of `owner` that uses the hosted agent, at the owner's request. */
export async function decideNow(owner: Address): Promise<TickResult[]> {
  const me = agentAccount();
  if (!me) return [];
  const history = await priceHistory();
  const views = await Promise.all((await accountsOf(owner)).map((a) => readAccount(a.chainId, a.address).catch(() => null)));
  return Promise.all(
    views
      .filter((v): v is AccountView => Boolean(v && v.owner.toLowerCase() === owner.toLowerCase()))
      .filter((v) => v.agent.toLowerCase() === me.address.toLowerCase())
      .map(async (v): Promise<TickResult> => {
        const base = { chainId: v.chainId, account: v.address };
        if (v.frozen) return { ...base, outcome: "frozen" };
        if (v.remainingCents < 100) return { ...base, outcome: "daily limit used" };
        const last = await lastDecisionAt(v.chainId, v.address);
        if (last && Date.now() / 1000 - last < ON_DEMAND_GAP_S) return { ...base, outcome: "decided a moment ago" };
        try {
          return await decideAndTrade(v, history);
        } catch (e) {
          return { ...base, outcome: `error: ${(e as Error).message.slice(0, 160)}` };
        }
      }),
  );
}

/** The answer is one of the offered orders, and its action agrees with the order's side. */
function matches(d: Decision, options: string[]): boolean {
  return options.includes(d.order) && orderParts(d.order).side === d.action;
}

async function decideAndTrade(view: AccountView, history: { time: number; price: number }[]): Promise<TickResult> {
  const me = agentAccount()!;
  const net = chainById(view.chainId)!;
  const client = clientFor(view.chainId);
  const [venuePrice] = await client.readContract({ address: net.venue!, abi: greenlightVenueAbi, functionName: "price" });
  const priceCents = Math.round(Number(venuePrice) / 1e6);
  const book = await readBook(view.owner);

  const nonce = view.nextNonce;
  const deadline = Math.floor(Date.now() / 1000) + ORDER_TTL_S;
  // Each trade is a slice of the day's limit (a tenth or a quarter), so the agent keeps trading through the day
  // instead of spending its whole limit at once. Its earned limit still sets the total.
  const sizes = [...new Set([0.1, 0.25].map((f) => Math.min(Math.floor(view.limitCents * f), view.remainingCents)))].filter((c) => c >= 100);
  const ethValueCents = Math.floor(view.eth * priceCents);
  // The account itself says how each order must be written, so every account version is served correctly (newer ones
  // name their chain and address, so a signed decision only ever authorises that one account).
  const wanted: { side: 0 | 1; cents: number }[] = [];
  for (const c of sizes) if (view.usd * 100 >= c) wanted.push({ side: 0, cents: c });
  for (const c of sizes) if (ethValueCents >= c) wanted.push({ side: 1, cents: c });
  const options = (await client.multicall({
    allowFailure: false,
    contracts: wanted.map((w) => ({
      address: view.address,
      abi: greenlightAccountAbi,
      functionName: "orderText",
      args: [{ side: w.side, amountCents: BigInt(w.cents), refPriceCents: BigInt(priceCents), nonce: BigInt(nonce), deadline: BigInt(deadline) }],
    })),
  })) as string[];

  const { system, user } = buildPrompt({ account: view, book, history, options });
  const base = {
    chainId: view.chainId,
    account: view.address,
    owner: view.owner,
    priceCents,
    remainingCents: view.remainingCents,
  };

  // The confidential model first; its signed answer can run on its own. The fallback always needs the owner.
  let decision: Decision;
  let proof: { requestHash: Hex; response: Hex; orderOffset: bigint; signature: Hex };
  let source: "near-tee" | "openai" = "near-tee";
  let latencyMs: number;
  let chatId: string | null = null;
  let signer: string | null = null;
  let nearError: string | undefined;
  try {
    const near = await askNear(system, user);
    decision = near.decision;
    latencyMs = near.latencyMs;
    chatId = near.chatId;
    proof = { requestHash: sha256Hex(near.requestBytes), response: "0x", orderOffset: 0n, signature: "0x" };
    if (decision.action !== "hold" && matches(decision, options)) {
      const sig = await nearSignature(near.chatId);
      signer = sig.signingAddress;
      const raw = near.responseBytes;
      // The order must appear as its own JSON string in the answer, opened and closed by an escaped quote.
      const contentAt = raw.indexOf('"content":"');
      const found = contentAt < 0 ? -1 : raw.indexOf(`\\"${decision.order}\\"`, contentAt);
      const at = found < 0 ? -1 : found + 2;
      proof = {
        requestHash: sha256Hex(near.requestBytes),
        response: `0x${raw.toString("hex")}`,
        orderOffset: BigInt(Math.max(at, 0)),
        signature: at < 0 ? "0x" : sig.signature,
      };
    }
  } catch (e) {
    nearError = (e as Error).message.slice(0, 200);
    console.error("NEAR AI Cloud failed, using the backup model:", nearError);
    source = "openai";
    const oa = await askOpenAI(system, user);
    decision = oa.decision;
    latencyMs = oa.latencyMs;
    proof = { requestHash: `0x${"0".repeat(64)}`, response: "0x", orderOffset: 0n, signature: "0x" };
  }

  const record = (outcome: string, tx: string | null) =>
    recordDecision({
      ...base,
      source,
      action: decision.action,
      orderText: decision.order || null,
      confidence: decision.confidence,
      reason: decision.reason,
      latencyMs,
      chatId,
      signer,
      tx,
      outcome,
      nearError,
    }).catch(() => undefined);

  if (decision.action === "hold" || !matches(decision, options)) {
    const outcome = decision.action === "hold" ? "held" : "invalid order";
    await record(outcome, null);
    return { chainId: view.chainId, account: view.address, outcome, action: decision.action, source, nearError, latencyMs, reason: decision.reason };
  }

  const { side, amount, ref } = orderParts(decision.order);
  const order = {
    side: side === "buy" ? 0 : 1,
    amountCents: BigInt(amount),
    refPriceCents: BigInt(ref),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline),
  };
  const wallet = createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: me });
  const { request } = await client.simulateContract({
    address: view.address,
    abi: greenlightAccountAbi,
    functionName: "trade",
    args: [order, proof],
    account: me,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  let outcome = receipt.status === "success" ? "submitted" : "reverted";
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: greenlightAccountAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "TradeExecuted") outcome = "executed";
      if (ev.eventName === "ApprovalRequested") outcome = (ev.args as { verified: boolean }).verified
        ? "waiting for owner (over limit)"
        : "waiting for owner (not verified)";
    } catch {
      // not an account event
    }
  }
  await record(outcome, hash);
  return { chainId: view.chainId, account: view.address, outcome, action: decision.action, source, nearError, latencyMs, tx: hash, reason: decision.reason };
}
