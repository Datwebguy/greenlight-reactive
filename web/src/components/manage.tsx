"use client";

import { ArrowDownToLine, Bot, DoorOpen, Pause, Play, Repeat, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { parseUnits, zeroAddress, type Address } from "viem";
import { greenlightAccountAbi } from "@/lib/abi";
import { hostedAgent } from "@/lib/config";
import type { AccountView } from "@/lib/server/account";
import { chainLabel } from "./chain-chip";
import type { Act } from "./owner-dashboard";
import { PolicyInputs, policyFields, readPolicy } from "./policy-fields";
import { Button, Card, CardHead } from "./ui";

type Panel = "withdraw" | "rules" | "close" | null;
type Asset = "usd" | "eth" | "gas";

const assets: { key: Asset; label: string; unit: string; decimals: number }[] = [
  { key: "usd", label: "Dollars", unit: "test USD", decimals: 6 },
  { key: "eth", label: "ETH", unit: "ETH", decimals: 18 },
  { key: "gas", label: "Balance for updates", unit: "ETH", decimals: 18 },
];

const fmt = (raw: string, decimals: number) => {
  const n = Number(raw) / 10 ** decimals;
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals === 6 ? 2 : 5 });
};

/** Everything an owner needs to step in, change course or leave. */
export function Manage({
  owner,
  accounts,
  frozen,
  act,
  busy,
}: {
  owner: Address;
  accounts: AccountView[];
  frozen: boolean;
  act: Act;
  busy: string | null;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel(panel === p ? null : p);
  const account = (a: AccountView) => ({ address: a.address, abi: greenlightAccountAbi }) as const;

  const aiOn = accounts.some((a) => a.agent !== zeroAddress);
  const holdsEth = accounts.filter((a) => BigInt(a.raw.eth) > 0n);
  const canSell = holdsEth.filter((a) => a.canClose);
  const oldWithEth = holdsEth.length > canSell.length;

  async function pauseOrResume() {
    if (frozen) {
      // The owner's pause is lifted chain by chain; a stop from the scorer needs one restart anywhere.
      const targets = accounts.filter((a) => a.ownerFrozen);
      for (const a of targets.length ? targets : [accounts[0]]) {
        if (!(await act("pause", a.chainId, { ...account(a), functionName: "unfreeze" }))) return;
      }
    } else {
      await act("pause", accounts[0].chainId, { ...account(accounts[0]), functionName: "freeze" });
    }
  }

  async function sellBack() {
    for (const a of canSell) {
      if (!(await act("sell", a.chainId, { ...account(a), functionName: "closePosition" }))) return;
    }
  }

  async function switchAi() {
    const next = aiOn ? zeroAddress : hostedAgent;
    if (!next) return;
    for (const a of accounts.filter((x) => x.agent !== next)) {
      if (!(await act("ai", a.chainId, { ...account(a), functionName: "setAgent", args: [next] }))) return;
    }
  }

  const rows = [
    {
      key: "pause",
      icon: frozen ? Play : Pause,
      title: frozen ? "Resume trading" : "Pause trading",
      body: frozen
        ? "Lets the agent trade again on every chain, starting from its lowest limit."
        : "Stops the agent on every chain within seconds. Your money stays where it is.",
      action: (
        <Button tone={frozen ? "primary" : "danger"} disabled={!!busy} onClick={pauseOrResume}>
          {busy === "pause" ? "Waiting for your wallet…" : frozen ? "Resume" : "Pause"}
        </Button>
      ),
    },
    {
      key: "sell",
      icon: Repeat,
      title: "Sell back to dollars",
      body: holdsEth.length
        ? `Sells all the ETH the agent bought at today's Chainlink price.${oldWithEth ? " Older accounts can't sell back, but you can still withdraw their ETH." : ""}`
        : "The agent holds no ETH right now, so there is nothing to sell.",
      action: (
        <Button tone="ghost" disabled={!!busy || canSell.length === 0} onClick={sellBack}>
          {busy === "sell" ? "Selling…" : "Sell all ETH"}
        </Button>
      ),
    },
    {
      key: "withdraw",
      icon: ArrowDownToLine,
      title: "Withdraw",
      body: "Move dollars, ETH or the balance kept for updates back to your wallet, a little or all of it.",
      action: (
        <Button tone="ghost" disabled={!!busy} onClick={() => toggle("withdraw")} aria-expanded={panel === "withdraw"}>
          {panel === "withdraw" ? "Hide" : "Choose amount"}
        </Button>
      ),
    },
    {
      key: "rules",
      icon: SlidersHorizontal,
      title: "Change the rules",
      body: "Adjust the limits, streaks and loss stop. The scorer picks up the new rules on every chain.",
      action: (
        <Button tone="ghost" disabled={!!busy} onClick={() => toggle("rules")} aria-expanded={panel === "rules"}>
          {panel === "rules" ? "Hide" : "Edit rules"}
        </Button>
      ),
    },
    {
      key: "ai",
      icon: Bot,
      title: aiOn ? "Turn the AI off" : "Turn the AI back on",
      body: aiOn
        ? "Takes away its permission to trade. Trades it already made are still judged on time."
        : "Gives Greenlight's AI permission to trade again, inside the same limit.",
      action: (
        <Button tone="ghost" disabled={!!busy || (!aiOn && !hostedAgent)} onClick={switchAi}>
          {busy === "ai" ? "Waiting for your wallet…" : aiOn ? "Turn off" : "Turn on"}
        </Button>
      ),
    },
    {
      key: "close",
      icon: DoorOpen,
      title: "Close the account",
      body: "Stops the agent, sells back to dollars and sends everything to your wallet, in one go.",
      action: (
        <Button tone="danger" disabled={!!busy} onClick={() => toggle("close")} aria-expanded={panel === "close"}>
          {panel === "close" ? "Keep it open" : "Close"}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHead title="Manage" hint="Only you can do these. Your wallet asks you to confirm each step." />
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key} className="py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-go-soft text-go-deep">
                  <r.icon size={18} />
                </span>
                <div>
                  <div className="text-[16px] font-semibold tracking-tight">{r.title}</div>
                  <p className="mt-0.5 max-w-xl text-[14px] text-ink-2">{r.body}</p>
                </div>
              </div>
              <div className="shrink-0 pl-14 sm:pl-0">{r.action}</div>
            </div>
            <AnimatePresence initial={false}>
              {panel === r.key && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 sm:pl-14">
                    {r.key === "withdraw" && <Withdraw owner={owner} accounts={accounts} act={act} busy={busy} />}
                    {r.key === "rules" && <Rules accounts={accounts} act={act} busy={busy} onDone={() => setPanel(null)} />}
                    {r.key === "close" && <Close owner={owner} accounts={accounts} frozen={frozen} act={act} busy={busy} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Pills<T extends string | number>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={String(i.key)}
          onClick={() => onChange(i.key)}
          className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition ${
            value === i.key ? "border-go bg-go-soft text-go-deep" : "border-line-2 text-ink-2 hover:border-ink/40"
          }`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

function Withdraw({ owner, accounts, act, busy }: { owner: Address; accounts: AccountView[]; act: Act; busy: string | null }) {
  const [chainId, setChainId] = useState(accounts[0].chainId);
  const [asset, setAsset] = useState<Asset>("usd");
  const [amount, setAmount] = useState("");
  const a = accounts.find((x) => x.chainId === chainId && BigInt(x.raw[asset]) > 0n) ?? accounts.find((x) => x.chainId === chainId)!;
  const meta = assets.find((x) => x.key === asset)!;
  const available = BigInt(a.raw[asset]);
  const chains = [...new Set(accounts.map((x) => x.chainId))];

  let wanted = 0n;
  let problem: string | null = null;
  try {
    wanted = amount ? parseUnits(amount, meta.decimals) : 0n;
  } catch {
    problem = "Enter a number.";
  }
  if (!problem && wanted > available) problem = "That is more than the account holds.";

  async function send(value: bigint) {
    if (value === 0n) return;
    const base = { address: a.address, abi: greenlightAccountAbi } as const;
    const ok =
      asset === "gas"
        ? await act("withdraw", a.chainId, { ...base, functionName: "withdrawNative", args: [owner, value] })
        : await act("withdraw", a.chainId, { ...base, functionName: "withdraw", args: [a.tokens[asset], owner, value] });
    if (ok) setAmount("");
  }

  return (
    <div className="space-y-5">
      {chains.length > 1 && <Pills items={chains.map((c) => ({ key: c, label: chainLabel(c) }))} value={chainId} onChange={setChainId} />}
      <Pills items={assets.map((x) => ({ key: x.key, label: x.label }))} value={asset} onChange={(k) => (setAsset(k), setAmount(""))} />
      <div>
        <span className="flex max-w-sm items-center rounded-2xl border border-line-2 bg-card focus-within:border-go">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="num w-full bg-transparent px-3 py-2.5 text-[15px] outline-none"
          />
          <span className="pr-3 text-[13px] whitespace-nowrap text-mute">{meta.unit}</span>
        </span>
        <p className="mt-2 text-[13px] text-mute">
          Available: <span className="num">{fmt(a.raw[asset], meta.decimals)}</span> {meta.unit}
          {asset === "gas" && ". Keep a little here, or limit updates cannot reach this chain."}
        </p>
        {problem && <p className="mt-1 text-[13px] text-stop">{problem}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!!busy || !!problem || wanted === 0n} onClick={() => send(wanted)}>
          {busy === "withdraw" ? "Sending…" : "Withdraw"}
        </Button>
        <Button tone="ghost" disabled={!!busy || available === 0n} onClick={() => send(available)}>
          Withdraw all
        </Button>
      </div>
    </div>
  );
}

function Rules({ accounts, act, busy, onDone }: { accounts: AccountView[]; act: Act; busy: string | null; onDone: () => void }) {
  const [fields, setFields] = useState(() => policyFields(accounts[0].policy));
  const { problems, policy } = readPolicy(fields);

  async function save() {
    for (const a of accounts) {
      if (!(await act("rules", a.chainId, { address: a.address, abi: greenlightAccountAbi, functionName: "setPolicy", args: [policy] }))) return;
    }
    onDone();
  }

  return (
    <div>
      <PolicyInputs fields={fields} onChange={setFields} />
      {problems.length > 0 && (
        <ul className="mb-4 space-y-1 text-[13px] text-stop">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <Button disabled={!!busy || problems.length > 0} onClick={save}>
        {busy === "rules" ? "Saving…" : accounts.length > 1 ? `Save on all ${accounts.length} accounts` : "Save the new rules"}
      </Button>
    </div>
  );
}

function Close({ owner, accounts, frozen, act, busy }: { owner: Address; accounts: AccountView[]; frozen: boolean; act: Act; busy: string | null }) {
  const [step, setStep] = useState<string | null>(null);

  async function closeAll() {
    let stopped = frozen;
    for (const a of accounts) {
      const base = { address: a.address, abi: greenlightAccountAbi } as const;
      setStep(`Closing on ${chainLabel(a.chainId)}…`);
      if (a.canClose) {
        if (!(await act("close", a.chainId, { ...base, functionName: "closeAccount", args: [owner] }))) return setStep(null);
        stopped = true;
        continue;
      }
      // Accounts opened before one-step closing: the same steps, one at a time.
      const steps: { functionName: string; args?: unknown[] }[] = [];
      if (!stopped) steps.push({ functionName: "freeze" });
      if (a.agent !== zeroAddress) steps.push({ functionName: "setAgent", args: [zeroAddress] });
      if (BigInt(a.raw.usd) > 0n) steps.push({ functionName: "withdraw", args: [a.tokens.usd, owner, BigInt(a.raw.usd)] });
      if (BigInt(a.raw.eth) > 0n) steps.push({ functionName: "withdraw", args: [a.tokens.eth, owner, BigInt(a.raw.eth)] });
      if (BigInt(a.raw.gas) > 0n) steps.push({ functionName: "withdrawNative", args: [owner, BigInt(a.raw.gas)] });
      for (const s of steps) {
        if (!(await act("close", a.chainId, { ...base, ...s } as never))) return setStep(null);
      }
      stopped = true;
    }
    setStep("Done. Everything is back in your wallet.");
  }

  return (
    <div className="rounded-3xl bg-stop-soft px-6 py-5">
      <p className="text-[15px] text-ink">
        This pauses the agent everywhere, takes away its permission to trade, sells its ETH back to dollars and sends all
        of it to your wallet.{" "}
        {accounts.length > 1 ? `Your wallet will ask you to confirm on each of your ${accounts.length} accounts.` : ""} Its
        record stays on-chain, and you can resume later.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button tone="danger" disabled={!!busy} onClick={closeAll}>
          {busy === "close" ? "Waiting for your wallet…" : "Close and withdraw everything"}
        </Button>
        {step && <span className="text-[14px] text-ink-2">{step}</span>}
      </div>
    </div>
  );
}
