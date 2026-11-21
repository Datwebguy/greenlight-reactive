import "server-only";
import { neon } from "@neondatabase/serverless";

/** The agent's decision log, including holds, which leave no trace on-chain. Optional: without a database the
 * agent still trades and everything else is read from the chains. */
const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

let ready: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  ready ??= (async () => {
    await sql`
      create table if not exists decisions (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        chain_id integer not null,
        account text not null,
        owner text not null,
        source text not null,
        action text not null,
        order_text text,
        confidence real,
        reason text,
        price_cents integer,
        remaining_cents integer,
        latency_ms integer,
        chat_id text,
        signer text,
        tx text,
        outcome text
      )`;
    await sql`create index if not exists decisions_account on decisions (chain_id, account, created_at desc)`;
    await sql`create index if not exists decisions_owner on decisions (owner, created_at desc)`;
  })();
  return ready;
}

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

export async function recordDecision(d: DecisionRow): Promise<void> {
  if (!sql) return;
  await ensureSchema();
  await sql`
    insert into decisions (chain_id, account, owner, source, action, order_text, confidence, reason, price_cents,
      remaining_cents, latency_ms, chat_id, signer, tx, outcome)
    values (${d.chainId}, ${d.account.toLowerCase()}, ${d.owner.toLowerCase()}, ${d.source}, ${d.action}, ${d.orderText},
      ${d.confidence}, ${d.reason}, ${d.priceCents}, ${d.remainingCents}, ${d.latencyMs}, ${d.chatId}, ${d.signer},
      ${d.tx}, ${d.outcome})`;
}

export async function lastDecisionAt(chainId: number, account: string): Promise<number | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = (await sql`
    select extract(epoch from created_at) as t from decisions
    where chain_id = ${chainId} and account = ${account.toLowerCase()}
    order by created_at desc limit 1`) as { t: string }[];
  return rows[0] ? Number(rows[0].t) : null;
}

export async function recentDecisions(owner: string, limit = 50): Promise<(DecisionRow & { createdAt: string })[]> {
  if (!sql) return [];
  await ensureSchema();
  const rows = (await sql`
    select * from decisions where owner = ${owner.toLowerCase()} order by created_at desc limit ${limit}`) as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    createdAt: String(r.created_at),
    chainId: Number(r.chain_id),
    account: String(r.account),
    owner: String(r.owner),
    source: r.source as DecisionRow["source"],
    action: r.action as DecisionRow["action"],
    orderText: (r.order_text as string) ?? null,
    confidence: r.confidence === null ? null : Number(r.confidence),
    reason: String(r.reason),
    priceCents: Number(r.price_cents),
    remainingCents: Number(r.remaining_cents),
    latencyMs: Number(r.latency_ms),
    chatId: (r.chat_id as string) ?? null,
    signer: (r.signer as string) ?? null,
    tx: (r.tx as string) ?? null,
    outcome: String(r.outcome),
  }));
}

export const hasDatabase = Boolean(sql);
