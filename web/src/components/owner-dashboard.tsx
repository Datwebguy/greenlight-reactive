"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { greenlightAccountAbi, greenlightVenueAbi } from "@/lib/abi";
import { chainById, lasna, txUrl, addressUrl } from "@/lib/config";
import { ago, dollars, duration, price, reasonText, short, when } from "@/lib/format";
import type { AccountView, Delivery, OwnerView, TimelineItem } from "@/lib/server/account";
import type { DecisionRow } from "@/lib/server/db";
import { LimitChart } from "./limit-chart";
import { Badge, Button, Card, CardHead, Stat, TxLink } from "./ui";

type Data = OwnerView & { decisions: (DecisionRow & { createdAt: string })[] };

const chainName = (id: number) => (id === lasna.chain.id ? "Reactive" : id === 84532 ? "Base" : id === 1301 ? "Unichain" : `${id}`);

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
  const client84532 = usePublicClient({ chainId: 84532 });
  const client1301 = usePublicClient({ chainId: 1301 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, chainId: number, params: Parameters<typeof writeContractAsync>[0]) {
    setBusy(key);
    setError(null);
    try {
      await switchChainAsync({ chainId: chainId as 84532 | 1301 });
      const hash = await writeContractAsync({ ...params, chainId: chainId as 84532 | 1301 } as never);
      const client = chainId === 84532 ? client84532 : client1301;
      await client?.waitForTransactionReceipt({ hash });
      await qc.invalidateQueries();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(msg.split("\n")[0]);
    } finally {
      setBusy(null);
    }
  }
  return { act, busy, error };
}

export function OwnerDashboard({ owner }: { owner: Address }) {
  const { data, error, isLoading } = useOwner(owner);
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === owner.toLowerCase();
  const { act, busy, error: actError } = useAct();

  if (isLoading) return <Skeleton />;
  if (error || !data) return <p className="py-20 text-center text-ink-2">This account could not be loaded right now.</p>;
  if (data.accounts.length === 0)
    return <p className="py-20 text-center text-ink-2">{short(owner)} has not opened a Greenlight account yet.</p>;

  const main = data.accounts[0];
  const policy = main.policy;
  const book = data.book;
  const frozen = data.accounts.some((a) => a.frozen) || Boolean(book?.frozen);
  const limitCents = book?.limitCents ?? main.limitCents;
  const lastFreeze = [...data.timeline].reverse().find((t) => t.kind === "limit" && t.frozen);

  const limitPoints = data.timeline
    .filter((t): t is Extract<TimelineItem, { kind: "limit" }> => t.kind === "limit")
    .map((t) => ({ time: t.time, limitCents: t.limitCents, frozen: t.frozen, reason: t.reason }));

  return (
    <div className="space-y-6 pt-8">
      {/* status */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
          frozen ? "border-stop/30 bg-stop-soft" : "border-go/25 bg-go-soft"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${frozen ? "bg-stop" : "live-dot bg-go"}`} />
          <div>
            <div className="text-lg font-semibold">
              {frozen ? "The agent is frozen" : "The agent is trading within its limit"}
            </div>
            <div className="text-[14px] text-ink-2">
              {frozen
                ? `${lastFreeze && lastFreeze.kind === "limit" ? reasonText[lastFreeze.reason] : "Frozen"}. No trades run until the owner unfreezes it.`
                : `Owner ${short(owner)} · ${data.accounts.length} account${data.accounts.length > 1 ? "s" : ""} on ${[
                    ...new Set(data.accounts.map((a) => chainName(a.chainId))),
                  ].join(" and ")}`}
            </div>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            {frozen ? (
              <Button
                disabled={!!busy}
                onClick={() =>
                  act("unfreeze", main.chainId, { address: main.address, abi: greenlightAccountAbi, functionName: "unfreeze" })
                }
              >
                {busy === "unfreeze" ? "Unfreezing…" : "Unfreeze"}
              </Button>
            ) : (
              <Button
                tone="danger"
                disabled={!!busy}
                onClick={() =>
                  act("freeze", main.chainId, { address: main.address, abi: greenlightAccountAbi, functionName: "freeze" })
                }
              >
                {busy === "freeze" ? "Freezing…" : "Freeze everywhere"}
              </Button>
            )}
          </div>
        )}
      </div>
      {actError && <p className="rounded-xl bg-stop-soft px-4 py-3 text-[14px] text-stop">{actError}</p>}

      {/* headline numbers */}
      <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Daily limit"
          value={dollars(limitCents)}
          sub={`Can move between ${dollars(policy.floorCents)} and ${dollars(policy.ceilingCents)}`}
        />
        <Stat
          label="Left today"
          value={dollars(data.accounts.reduce((s, a) => s + (a.frozen ? 0 : a.remainingCents), 0))}
          sub="Resets at midnight UTC"
        />
        <Stat
          label="Record"
          value={
            <>
              {book?.wins ?? 0} <span className="text-mute">won</span> · {book?.losses ?? 0}{" "}
              <span className="text-mute">lost</span>
            </>
          }
          sub={
            book && (book.winStreak || book.lossStreak)
              ? book.winStreak
                ? `${book.winStreak} of ${policy.raiseAfterWins} wins toward a raise`
                : `${book.lossStreak} of ${policy.freezeAfterLosses} losses before a freeze`
              : `Trades are judged after ${duration(policy.scoreWindow)}`
          }
        />
        <Stat
          label="Result so far"
          value={
            <span className={(book?.pnlCents ?? 0) < 0 ? "text-stop" : "text-go-deep"}>
              {(book?.pnlCents ?? 0) < 0 ? "−" : "+"}
              {dollars(Math.abs(book?.pnlCents ?? 0))}
            </span>
          }
          sub={data.price ? `ETH ${price(data.price.value)} · Chainlink, ${ago(data.price.updatedAt)}` : undefined}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="Daily limit over time" hint="Each point is a decision by the scorer on Reactive Network." />
          <div className="p-4">
            <LimitChart points={limitPoints} floor={policy.floorCents} ceiling={policy.ceilingCents} />
          </div>
        </Card>
        <Requests accounts={data.accounts} isOwner={isOwner} act={act} busy={busy} />
      </div>

      <Accounts accounts={data.accounts} bookSeq={book?.seq ?? 0} isOwner={isOwner} act={act} busy={busy} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Timeline items={data.timeline} />
        <div className="space-y-6">
          <Deliveries deliveries={data.deliveries} />
          <Decisions decisions={data.decisions} />
        </div>
      </div>
    </div>
  );
}

type Act = ReturnType<typeof useAct>["act"];

function Requests({ accounts, isOwner, act, busy }: { accounts: AccountView[]; isOwner: boolean; act: Act; busy: string | null }) {
  const open = accounts.flatMap((a) => a.openRequests.map((r) => ({ ...r, account: a })));
  return (
    <Card>
      <CardHead title="Waiting for approval" hint="Trades the agent may not make on its own." />
      {open.length === 0 ? (
        <p className="px-5 py-10 text-center text-[14px] text-mute">Nothing is waiting.</p>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((r) => (
            <li key={`${r.account.address}-${r.id}`} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">
                  {r.side === "buy" ? "Buy" : "Sell"} {dollars(r.amountCents)} of ETH
                </div>
                <Badge tone="wait">{r.verified ? "Over the limit" : "Not signed by the enclave"}</Badge>
              </div>
              <div className="mt-1 text-[13px] text-mute">
                At about {price(r.refPriceCents / 100)} on {chainName(r.account.chainId)} · expires {ago(r.deadline).replace(" ago", "")}{" "}
                {r.deadline > Date.now() / 1000 ? "from now" : ""}
              </div>
              {isOwner && (
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={!!busy}
                    onClick={() =>
                      act(`approve-${r.id}`, r.account.chainId, {
                        address: r.account.address,
                        abi: greenlightAccountAbi,
                        functionName: "approve",
                        args: [BigInt(r.id)],
                      })
                    }
                  >
                    {busy === `approve-${r.id}` ? "Approving…" : "Approve"}
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={!!busy}
                    onClick={() =>
                      act(`reject-${r.id}`, r.account.chainId, {
                        address: r.account.address,
                        abi: greenlightAccountAbi,
                        functionName: "reject",
                        args: [BigInt(r.id)],
                      })
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Accounts({
  accounts,
  bookSeq,
  isOwner,
  act,
  busy,
}: {
  accounts: AccountView[];
  bookSeq: number;
  isOwner: boolean;
  act: Act;
  busy: string | null;
}) {
  return (
    <Card>
      <CardHead title="Accounts" hint="The same agent and limit on every chain, kept in step by the scorer." />
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        {accounts.map((a) => {
          const behind = a.appliedSeq < bookSeq;
          const venue = chainById(a.chainId)?.venue;
          return (
            <div key={a.address} className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.chainName}</div>
                {a.frozen ? <Badge tone="stop">Frozen</Badge> : behind ? <Badge tone="wait">Update on its way</Badge> : <Badge tone="go">In step</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-y-1.5 text-[14px]">
                <dt className="text-mute">Limit</dt>
                <dd className="num text-right">{dollars(a.limitCents)}</dd>
                <dt className="text-mute">Left today</dt>
                <dd className="num text-right">{dollars(a.remainingCents)}</dd>
                <dt className="text-mute">Test dollars</dt>
                <dd className="num text-right">{a.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
                <dt className="text-mute">Test ether</dt>
                <dd className="num text-right">{a.eth.toFixed(4)}</dd>
                <dt className="text-mute">Update fees left</dt>
                <dd className="num text-right">{a.gas.toFixed(4)} ETH</dd>
                <dt className="text-mute">AI signer</dt>
                <dd className="num truncate text-right" title={`${a.modelId} · ${a.teeSigner}`}>
                  {short(a.teeSigner)}
                </dd>
              </dl>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a href={addressUrl(a.chainId, a.address)} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-info hover:underline">
                  {short(a.address)} ↗
                </a>
                {isOwner && venue && (
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      act(`faucet-${a.chainId}`, a.chainId, {
                        address: venue,
                        abi: greenlightVenueAbi,
                        functionName: "faucet",
                        args: [a.address],
                      })
                    }
                    className="text-[13px] font-medium text-go-deep hover:underline disabled:opacity-50"
                  >
                    {busy === `faucet-${a.chainId}` ? "Adding…" : "Add test dollars"}
                  </button>
                )}
                {behind && (
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      act(`resync-${a.chainId}`, a.chainId, { address: a.address, abi: greenlightAccountAbi, functionName: "requestResync" })
                    }
                    className="text-[13px] font-medium text-info hover:underline disabled:opacity-50"
                  >
                    Ask for the latest limit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function describe(t: TimelineItem): { text: string; tone: "go" | "wait" | "stop" | "info" | "mute" } | null {
  switch (t.kind) {
    case "joined":
      return { text: `Account opened on ${chainName(t.chainId)}`, tone: "mute" };
    case "trade":
      return {
        text: `${t.side === "buy" ? "Bought" : "Sold"} ${dollars(t.amountCents)} of ETH at ${price(t.price)}${
          t.ownerApproved ? ", approved by the owner" : t.verified ? ", signed by the enclave" : ""
        }`,
        tone: "info",
      };
    case "request":
      return {
        text: `Asked to ${t.side} ${dollars(t.amountCents)} of ETH: ${t.verified ? "over the limit" : "not signed"}, waiting for the owner`,
        tone: "wait",
      };
    case "resolved":
      return { text: `Owner ${t.approved ? "approved" : "rejected"} request #${t.id}`, tone: "mute" };
    case "scored":
      return {
        text: `Trade #${t.tradeId} judged: ${t.returnBps >= 0 ? "+" : ""}${(t.returnBps / 100).toFixed(2)}% (${t.pnlCents >= 0 ? "+" : "−"}${dollars(
          Math.abs(t.pnlCents),
        )}), from ${price(t.entryPrice)} to ${price(t.exitPrice)}`,
        tone: t.pnlCents > 0 ? "go" : t.pnlCents < 0 ? "stop" : "mute",
      };
    case "limit":
      return {
        text: `${reasonText[t.reason] ?? "Limit updated"}${t.frozen ? "" : `: limit now ${dollars(t.limitCents)}`}`,
        tone: t.frozen ? "stop" : t.reason === 3 ? "go" : t.reason === 4 ? "wait" : "mute",
      };
    case "owner":
      return { text: t.frozen ? "Owner froze the agent" : "Owner unfroze the agent", tone: t.frozen ? "stop" : "go" };
    case "policy":
      return { text: "Owner changed the rules", tone: "mute" };
    default:
      return null;
  }
}

const dot = { go: "bg-go", wait: "bg-wait", stop: "bg-stop", info: "bg-info", mute: "bg-line-2" };

function Timeline({ items }: { items: TimelineItem[] }) {
  const rows = items
    .map((t) => ({ t, d: describe(t) }))
    .filter((r): r is { t: TimelineItem; d: NonNullable<ReturnType<typeof describe>> } => r.d !== null)
    .reverse()
    .slice(0, 60);
  return (
    <Card>
      <CardHead title="Everything that happened" hint="Newest first. Each line is a transaction you can open." />
      <ol className="divide-y divide-line">
        {rows.map(({ t, d }) => (
          <li key={`${t.tx}-${t.kind}-${t.time}`} className="flex items-start gap-3 px-5 py-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[d.tone]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink">{d.text}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-mute">
                <span>{chainName(t.chainId)}</span>
                <span>·</span>
                <span>{when(t.time)}</span>
                <span>·</span>
                <a href={txUrl(t.chainId, t.tx)} target="_blank" rel="noreferrer" className="hover:text-info">
                  transaction ↗
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Deliveries({ deliveries }: { deliveries: Delivery[] }) {
  const rows = [...deliveries].reverse().slice(0, 8);
  return (
    <Card>
      <CardHead title="How fast changes arrive" hint="From the scorer's decision on Reactive Network to each chain." />
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[14px] text-mute">No changes yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((d) => (
            <li key={d.seq} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3 text-[14px]">
                <span className="text-ink">{reasonText[d.reason]}</span>
                <TxLink href={txUrl(lasna.chain.id, d.decidedTx)}>#{d.seq}</TxLink>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {d.origin && <Badge tone="mute">Owner to scorer {duration(Math.max(0, d.decidedAt - d.origin.time))}</Badge>}
                {d.arrivals.length === 0 ? (
                  <Badge tone="wait">On its way</Badge>
                ) : (
                  d.arrivals.map((a) => (
                    <a key={a.tx} href={txUrl(a.chainId, a.tx)} target="_blank" rel="noreferrer">
                      <Badge tone="go">
                        {chainName(a.chainId)} in {duration(Math.max(0, a.time - d.decidedAt))}
                      </Badge>
                    </a>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Decisions({ decisions }: { decisions: Data["decisions"] }) {
  return (
    <Card>
      <CardHead title="The agent's thinking" hint="Every decision, including the times it chose to wait." />
      {decisions.length === 0 ? (
        <p className="px-5 py-8 text-center text-[14px] text-mute">No decisions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {decisions.slice(0, 10).map((d, i) => (
            <li key={i} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold capitalize">{d.action === "hold" ? "Waited" : d.action}</span>
                <span className="flex gap-1.5">
                  {d.source === "near-tee" ? <Badge tone="go">Enclave</Badge> : <Badge tone="wait">Backup model</Badge>}
                  <Badge tone="mute">{(d.latencyMs / 1000).toFixed(0)}s</Badge>
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{d.reason}</p>
              <div className="mt-1 text-[12px] text-mute">
                {ago(new Date(d.createdAt).getTime() / 1000)} · {d.outcome}
                {d.tx && (
                  <>
                    {" · "}
                    <a href={txUrl(d.chainId, d.tx)} target="_blank" rel="noreferrer" className="hover:text-info">
                      transaction ↗
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 pt-8">
      {[80, 120, 260].map((h) => (
        <div key={h} className="animate-pulse rounded-2xl border border-line bg-card" style={{ height: h }} />
      ))}
    </div>
  );
}
