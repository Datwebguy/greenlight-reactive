"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { greenlightAccountAbi, greenlightVenueAbi } from "@/lib/abi";
import { addressUrl, chainById, txUrl } from "@/lib/config";
import { medianDelivery, verdict } from "@/lib/cycle";
import { ago, dollars, duration, price, reasonText, when } from "@/lib/format";
import { agentName } from "@/lib/names";
import type { AccountView, OwnerView, TimelineItem } from "@/lib/server/account";
import type { DecisionRow } from "@/lib/server/db";
import { ChainChip, chainLabel } from "./chain-chip";
import { LimitChart } from "./limit-chart";
import { Gauge } from "./gauge";
import { Ticker } from "./motion";
import { Button, Card, CardHead } from "./ui";

type Decision = DecisionRow & { createdAt: string };
type Data = OwnerView & { decisions: Decision[] };

function useOwner(owner: Address) {
  return useQuery<Data>({
    queryKey: ["owner", owner],
    queryFn: async () => {
      const r = await fetch(`/api/owner/${owner}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Could not load this account");
      return r.json();
    },
    refetchInterval: 15_000,
  });
}

/** Sends one transaction from the connected wallet on the right chain and waits for it. */
function useAct() {
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const qc = useQueryClient();
  const clients = { 84532: usePublicClient({ chainId: 84532 }), 1301: usePublicClient({ chainId: 1301 }) };
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, chainId: number, params: Parameters<typeof writeContractAsync>[0]) {
    setBusy(key);
    setError(null);
    try {
      const id = chainId as 84532 | 1301;
      await switchChainAsync({ chainId: id });
      const hash = await writeContractAsync({ ...params, chainId: id } as never);
      await clients[id]?.waitForTransactionReceipt({ hash });
      await qc.invalidateQueries();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(msg.includes("User rejected") ? "You cancelled the request in your wallet." : msg.split("\n")[0]);
    } finally {
      setBusy(null);
    }
  }
  return { act, busy, error };
}
type Act = ReturnType<typeof useAct>["act"];

export function OwnerDashboard({ owner }: { owner: Address }) {
  const { data, error, isLoading } = useOwner(owner);
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === owner.toLowerCase();
  const { act, busy, error: actError } = useAct();

  if (isLoading) return <Skeleton />;
  if (error || !data) return <Empty text="This account could not be loaded right now. Please try again in a moment." />;
  if (data.accounts.length === 0) return <Empty text="This wallet has not opened a Greenlight account yet." />;

  const main = data.accounts[0];
  const policy = main.policy;
  const book = data.book;
  const frozen = data.accounts.some((a) => a.frozen) || Boolean(book?.frozen);
  const limitCents = book?.limitCents ?? main.limitCents;
  const lastFreeze = [...data.timeline].reverse().find((t): t is Extract<TimelineItem, { kind: "limit" }> => t.kind === "limit" && t.frozen);
  const limitPoints = data.timeline
    .filter((t): t is Extract<TimelineItem, { kind: "limit" }> => t.kind === "limit")
    .map((t) => ({ time: t.time, limitCents: t.limitCents, frozen: t.frozen, reason: t.reason }));
  const pnl = book?.pnlCents ?? 0;

  return (
    <div className="space-y-14 pt-16 pb-4">
      {/* title */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${
              frozen ? "bg-stop-soft text-stop" : "bg-go-soft text-go-deep"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${frozen ? "bg-stop" : "live-dot bg-go"}`} />
            {frozen ? "Frozen" : "Trading live"}
          </span>
          <h1 className="mt-4 text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px]">
            {isOwner ? `Your agent, ${agentName(owner)}` : agentName(owner)}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-ink-2">
            Trading ETH on
            {[...new Set(data.accounts.map((a) => a.chainId))].map((c) => (
              <ChainChip key={c} chainId={c} />
            ))}
          </p>
        </div>
        {isOwner &&
          (frozen ? (
            <Button
              disabled={!!busy}
              onClick={async () => {
                // The owner's own freeze is lifted chain by chain; a freeze from the scorer needs one unfreeze anywhere.
                const targets = data.accounts.filter((a) => a.ownerFrozen);
                for (const a of targets.length ? targets : [main]) {
                  await act("unfreeze", a.chainId, { address: a.address, abi: greenlightAccountAbi, functionName: "unfreeze" });
                }
              }}
            >
              {busy === "unfreeze" ? "Restarting…" : "Unfreeze the agent"}
            </Button>
          ) : (
            <Button tone="danger" disabled={!!busy} onClick={() => act("freeze", main.chainId, { address: main.address, abi: greenlightAccountAbi, functionName: "freeze" })}>
              {busy === "freeze" ? "Freezing…" : "Freeze everywhere"}
            </Button>
          ))}
      </div>

      {frozen && (
        <div className="rounded-3xl bg-stop-soft px-6 py-4 text-[15px] text-ink">
          <b>{lastFreeze ? reasonText[lastFreeze.reason] : "The agent is frozen"}.</b> It cannot trade on any chain until the
          owner restarts it, and it will restart at its lowest limit.
        </div>
      )}
      {actError && <div className="rounded-2xl bg-stop-soft px-5 py-3 text-[14px] text-stop">{actError}</div>}

      {/* limit + approvals */}
      <div className="grid gap-14">
        <div className="flex flex-col items-center gap-10 py-4 sm:flex-row sm:items-center">
          <div className="relative grid place-items-center">
            <div aria-hidden className="absolute h-[240px] w-[240px] rounded-full opacity-70 blur-3xl" style={{ background: "var(--glow)" }} />
            <div aria-hidden className="absolute h-[290px] w-[290px] rounded-full border border-line" style={{ animation: "orbit 28s linear infinite" }}>
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-go shadow-[0_0_12px_var(--go)]" />
            </div>
            <Gauge limitCents={limitCents} floorCents={policy.floorCents} ceilingCents={policy.ceilingCents} frozen={frozen} size={240}>
              <div>
                <div className="text-[12px] text-mute">Earned limit</div>
                <Ticker value={limitCents / 100} format={(n) => `$${n.toFixed(2)}`} className="num block text-[40px] leading-tight font-semibold tracking-tight" />
                <div className="text-[12px] text-mute">a day</div>
              </div>
            </Gauge>
          </div>
          <dl className="grid w-full flex-1 grid-cols-2 gap-x-8 gap-y-7">
            <Fact label={data.accounts.length > 1 ? "Left today, all chains" : "Left today"} value={dollars(data.accounts.reduce((s, a) => s + (a.frozen ? 0 : a.remainingCents), 0))} sub="Resets at midnight UTC" />
            <Fact
              label="Result so far"
              value={<span className={pnl < 0 ? "text-stop" : "text-go-deep"}>{`${pnl < 0 ? "\u2212" : "+"}${dollars(Math.abs(pnl))}`}</span>}
              sub={data.price ? `ETH ${price(data.price.value)}` : undefined}
            />
            <Fact
              label="Record"
              value={`${book?.wins ?? 0} won · ${book?.losses ?? 0} lost`}
              sub={
                book?.winStreak
                  ? `${book.winStreak} of ${policy.raiseAfterWins} wins to a raise`
                  : book?.lossStreak
                    ? `${book.lossStreak} of ${policy.freezeAfterLosses} losses to a freeze`
                    : `Judged ${duration(policy.scoreWindow)} after each trade`
              }
            />
            <Fact label="Can move between" value={`${dollars(policy.floorCents)} and ${dollars(policy.ceilingCents)}`} sub={`Started at ${dollars(policy.startLimitCents)}`} />
          </dl>
        </div>
        <Approvals accounts={data.accounts} isOwner={isOwner} act={act} busy={busy} />
      </div>

      {/* thinking + chart */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.45fr]">
        <Decisions decisions={data.decisions} />
        <Card>
          <CardHead title="Limit over time" hint="Every change was decided by the scorer on Reactive Network." />
          <div className="py-4">
            <LimitChart points={limitPoints} floor={policy.floorCents} ceiling={policy.ceilingCents} />
          </div>
        </Card>
      </div>

      {/* activity + accounts */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Activity items={data.timeline} />
        <div className="space-y-6">
          <Speed items={data.timeline} />
          <Accounts accounts={data.accounts} bookSeq={book?.seq ?? 0} isOwner={isOwner} act={act} busy={busy} />
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-mute">{label}</dt>
      <dd className="num mt-1.5 text-[24px] font-semibold leading-tight tracking-tight">{value}</dd>
      {sub && <dd className="mt-1 text-[12px] leading-snug text-mute">{sub}</dd>}
    </div>
  );
}

function Approvals({ accounts, isOwner, act, busy }: { accounts: AccountView[]; isOwner: boolean; act: Act; busy: string | null }) {
  const open = accounts.flatMap((a) => a.openRequests.map((r) => ({ ...r, account: a })));
  return (
    <Card>
      <CardHead
        title={open.length ? `Waiting for the owner (${open.length})` : "Waiting for the owner"}
        hint="Trades the agent is not allowed to make on its own."
      />
      {open.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-[15px] font-medium">Nothing needs a decision</div>
          <p className="mt-1 text-[13px] text-mute">Trades over the limit, or not signed by the enclave, will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((r) => (
            <li key={`${r.account.address}-${r.id}`} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold">
                    {r.side === "buy" ? "Buy" : "Sell"} {dollars(r.amountCents)} of ETH
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-2">
                    {r.verified ? "Bigger than what is left of today's limit" : "Suggested by the backup model, so it was not signed"}
                  </div>
                </div>
                <ChainChip chainId={r.account.chainId} />
              </div>
              <div className="mt-2 text-[12px] text-mute">
                Near {price(r.refPriceCents / 100)} · expires in {duration(Math.max(0, Math.round(r.deadline - Date.now() / 1000)))}
              </div>
              {isOwner ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={!!busy}
                    onClick={() => act(`approve-${r.id}`, r.account.chainId, { address: r.account.address, abi: greenlightAccountAbi, functionName: "approve", args: [BigInt(r.id)] })}
                  >
                    {busy === `approve-${r.id}` ? "Approving…" : "Approve"}
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={!!busy}
                    onClick={() => act(`reject-${r.id}`, r.account.chainId, { address: r.account.address, abi: greenlightAccountAbi, functionName: "reject", args: [BigInt(r.id)] })}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-mute">Only the owner can approve or reject this.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Decisions({ decisions }: { decisions: Decision[] }) {
  const [more, setMore] = useState(false);
  const shown = decisions.slice(0, more ? 12 : 4);
  return (
    <Card>
      <CardHead title="What the agent is thinking" hint="Every decision, including when it chose to wait." />
      {decisions.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-mute">The agent decides every 10 minutes. Its reasoning appears here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((d) => (
            <li key={d.createdAt} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold">
                  {d.action === "hold" ? "Waited" : `${d.action === "buy" ? "Buy" : "Sell"} ${d.orderText ? dollars(Number(d.orderText.split(":")[2])) : ""}`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    d.source === "near-tee" ? "bg-go-soft text-go-deep" : "bg-wait-soft text-wait"
                  }`}
                >
                  {d.source === "near-tee" ? "Signed in enclave" : "Backup model"}
                </span>
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{d.reason}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-2 text-[12px] text-mute">
                <span>{ago(new Date(d.createdAt).getTime() / 1000)}</span>
                <span>·</span>
                <span>{outcomeText(d.outcome)}</span>
                {d.tx && (
                  <>
                    <span>·</span>
                    <a href={txUrl(d.chainId, d.tx)} target="_blank" rel="noreferrer" className="hover:text-info">
                      Proof ↗
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {decisions.length > 4 && (
        <button onClick={() => setMore(!more)} className="mt-2 rounded-full border border-line-2 px-4 py-2 text-[13px] font-semibold text-ink hover:border-ink/40">
          {more ? "Show less" : "Show more"}
        </button>
      )}
    </Card>
  );
}

function outcomeText(o: string): string {
  if (o === "executed") return "Trade made";
  if (o === "held") return "No trade";
  if (o.startsWith("waiting")) return "Sent to the owner";
  if (o === "invalid order") return "Answer could not be used";
  return o.charAt(0).toUpperCase() + o.slice(1);
}

function describe(t: TimelineItem): { text: string; tone: "go" | "wait" | "stop" | "info" | "mute" } | null {
  switch (t.kind) {
    case "joined":
      return { text: "Account opened", tone: "mute" };
    case "trade":
      return {
        text: `${t.side === "buy" ? "Bought" : "Sold"} ${dollars(t.amountCents)} of ETH at ${price(t.price)}${t.ownerApproved ? ", approved by the owner" : ""}`,
        tone: "info",
      };
    case "request":
      return { text: `Asked the owner to ${t.side} ${dollars(t.amountCents)} of ETH`, tone: "wait" };
    case "resolved":
      return { text: t.approved ? "Owner approved a trade" : "Owner rejected a trade", tone: "mute" };
    case "scored":
      return {
        text: `Trade judged ${verdict(t)}: ${t.returnBps >= 0 ? "+" : ""}${(t.returnBps / 100).toFixed(2)}%${t.pnlCents !== 0 ? ` (${t.pnlCents > 0 ? "+" : "−"}${dollars(Math.abs(t.pnlCents))})` : ""}`,
        tone: verdict(t) === "a win" ? "go" : verdict(t) === "a loss" ? "stop" : "mute",
      };
    case "limit":
      return {
        text: t.frozen ? reasonText[t.reason] : `${reasonText[t.reason] ?? "Limit updated"}: ${dollars(t.limitCents)}`,
        tone: t.frozen ? "stop" : t.reason === 3 ? "go" : t.reason === 4 ? "wait" : "mute",
      };
    case "synced":
      return { text: t.frozen ? "Freeze applied" : `Limit applied: ${dollars(t.limitCents)}`, tone: "mute" };
    case "owner":
      return { text: t.frozen ? "Owner froze the agent" : "Owner restarted the agent", tone: t.frozen ? "stop" : "go" };
    case "policy":
      return { text: "Owner changed the rules", tone: "mute" };
    default:
      return null;
  }
}

const dot = { go: "bg-go", wait: "bg-wait", stop: "bg-stop", info: "bg-info", mute: "bg-line-2" };

function Activity({ items }: { items: TimelineItem[] }) {
  const [all, setAll] = useState(false);
  const rows = items
    .map((t) => ({ t, d: describe(t) }))
    .filter((r): r is { t: TimelineItem; d: NonNullable<ReturnType<typeof describe>> } => r.d !== null)
    .reverse();
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <Card>
      <CardHead title="Activity" hint="Newest first. Every line links to its transaction." />
      <ol className="divide-y divide-line">
        {shown.map(({ t, d }, i) => (
          <li key={`${t.tx}-${t.kind}-${i}`} className="flex items-start gap-3 py-3.5">
            <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot[d.tone]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink">{d.text}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mute">
                <ChainChip chainId={t.chainId} />
                <span>{when(t.time)}</span>
                <a href={txUrl(t.chainId, t.tx)} target="_blank" rel="noreferrer" className="hover:text-info">
                  Proof ↗
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {rows.length > 12 && (
        <button onClick={() => setAll(!all)} className="mt-2 rounded-full border border-line-2 px-4 py-2 text-[13px] font-semibold text-ink hover:border-ink/40">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </Card>
  );
}

function Speed({ items }: { items: TimelineItem[] }) {
  const m = medianDelivery(items);
  const recent = items
    .filter((t): t is Extract<TimelineItem, { kind: "limit" }> => t.kind === "limit")
    .reverse()
    .slice(0, 4)
    .map((l) => ({
      l,
      arrivals: items.filter((s): s is Extract<TimelineItem, { kind: "synced" }> => s.kind === "synced" && s.seq === l.seq),
    }));
  return (
    <Card>
      <CardHead title="How fast changes arrive" hint="From the scorer's decision to each chain." />
      <div className="pt-5">
        <div className="num text-[32px] font-semibold leading-none">{m ? `${m.median}s` : "—"}</div>
        <div className="mt-1 text-[13px] text-mute">{m ? `typical, across ${m.count} update${m.count === 1 ? "" : "s"}` : "No changes yet"}</div>
      </div>
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {recent.map(({ l, arrivals }) => (
          <li key={l.seq} className="flex items-center justify-between gap-3 py-3 text-[13px]">
            <span className="text-ink">{reasonText[l.reason]}</span>
            <span className="flex flex-wrap justify-end gap-1.5">
              {arrivals.length === 0 ? (
                <span className="text-wait">On its way</span>
              ) : (
                arrivals.map((a) => (
                  <a key={a.tx} href={txUrl(a.chainId, a.tx)} target="_blank" rel="noreferrer" className="num font-medium text-go-deep hover:underline">
                    {chainLabel(a.chainId)} {Math.max(0, a.time - l.time)}s
                  </a>
                ))
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Accounts({ accounts, bookSeq, isOwner, act, busy }: { accounts: AccountView[]; bookSeq: number; isOwner: boolean; act: Act; busy: string | null }) {
  return (
    <Card>
      <CardHead title="Accounts" hint="The same agent and limit on every chain." />
      <ul className="divide-y divide-line">
        {accounts.map((a) => {
          const behind = a.appliedSeq < bookSeq;
          const venue = chainById(a.chainId)?.venue;
          return (
            <li key={a.address} className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">{a.chainName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    a.frozen ? "bg-stop-soft text-stop" : behind ? "bg-wait-soft text-wait" : "bg-go-soft text-go-deep"
                  }`}
                >
                  {a.frozen ? "Frozen" : behind ? "Updating" : "Up to date"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
                <dt className="text-mute">Cash</dt>
                <dd className="num text-right">{a.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} test USD</dd>
                <dt className="text-mute">ETH held</dt>
                <dd className="num text-right">{a.eth.toFixed(4)}</dd>
                <dt className="text-mute">Balance for updates</dt>
                <dd className="num text-right">{a.gas.toFixed(4)} ETH</dd>
                <dt className="text-mute">Decisions accepted from</dt>
                <dd className="text-right" title={`${a.modelId} · ${a.teeSigner}`}>
                  NEAR AI enclave
                </dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
                <a href={addressUrl(a.chainId, a.address)} target="_blank" rel="noreferrer" className="text-info hover:underline">
                  View account ↗
                </a>
                {isOwner && venue && (
                  <button
                    disabled={!!busy}
                    onClick={() => act(`faucet-${a.chainId}`, a.chainId, { address: venue, abi: greenlightVenueAbi, functionName: "faucet", args: [a.address] })}
                    className="text-go-deep hover:underline disabled:opacity-50"
                  >
                    {busy === `faucet-${a.chainId}` ? "Adding…" : "Add test dollars"}
                  </button>
                )}
                {behind && (
                  <button
                    disabled={!!busy}
                    onClick={() => act(`resync-${a.chainId}`, a.chainId, { address: a.address, abi: greenlightAccountAbi, functionName: "requestResync" })}
                    className="text-info hover:underline disabled:opacity-50"
                  >
                    Fetch the latest limit
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mx-auto max-w-md py-24 text-center text-[16px] text-ink-2">{text}</p>;
}

function Skeleton() {
  return (
    <div className="space-y-6 pt-8">
      {[64, 240, 260].map((h) => (
        <div key={h} className="animate-pulse rounded-2xl border border-line bg-card" style={{ height: h }} />
      ))}
    </div>
  );
}
