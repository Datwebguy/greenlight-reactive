"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decodeEventLog, isAddress, parseEther, type Address } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { greenlightFactoryAbi, greenlightVenueAbi } from "@/lib/abi";
import { hostedAgent, tradingChains } from "@/lib/config";
import { Button, Card, CardHead } from "./ui";

interface Field {
  key: string;
  label: string;
  hint: string;
  unit: string;
  value: string;
  step?: string;
}

const initial: Field[] = [
  { key: "start", label: "Starting daily limit", hint: "What the agent may spend per day on day one.", unit: "$", value: "50" },
  { key: "ceiling", label: "Highest it can earn", hint: "Good results never raise the limit above this.", unit: "$", value: "250" },
  { key: "floor", label: "Lowest it can be cut to", hint: "Bad results never cut the limit below this.", unit: "$", value: "10" },
  { key: "window", label: "Judge each trade after", hint: "How long to wait before comparing a trade with the price.", unit: "min", value: "10" },
  { key: "wins", label: "Wins in a row for a raise", hint: "How many good trades in a row earn a higher limit.", unit: "trades", value: "3" },
  { key: "step", label: "Size of each change", hint: "How much the limit rises or falls each time.", unit: "%", value: "25" },
  { key: "losses", label: "Losses in a row that freeze it", hint: "The agent stops on every chain after this many.", unit: "trades", value: "3" },
  { key: "maxLoss", label: "Total loss that freezes it", hint: "Counted since the last unfreeze. Leave 0 to switch off.", unit: "$", value: "5", step: "0.01" },
  { key: "slippage", label: "Price may move by up to", hint: "Trades fail if the price moved more than this since the decision.", unit: "%", value: "1", step: "0.1" },
];

export function CreateAccount({ onCreated }: { onCreated?: () => void }) {
  const { address } = useAccount();
  const [fields, setFields] = useState(initial);
  const [chains, setChains] = useState<Record<number, boolean>>({ 84532: true, 1301: true });
  const [deposit, setDeposit] = useState("0.002");
  const [agent, setAgent] = useState<string>(hostedAgent ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const clients = { 84532: usePublicClient({ chainId: 84532 }), 1301: usePublicClient({ chainId: 1301 }) } as const;
  const qc = useQueryClient();

  const signer = useQuery<{ model: string; signers: string[] }>({
    queryKey: ["near-signer"],
    queryFn: async () => (await fetch("/api/near/signer")).json(),
    staleTime: 300_000,
  });

  const v = Object.fromEntries(fields.map((f) => [f.key, Number(f.value)]));
  const cents = (x: number) => BigInt(Math.round(x * 100));
  const problems: string[] = [];
  if (!(v.ceiling > 0)) problems.push("The highest limit must be above zero.");
  if (v.floor > v.start || v.start > v.ceiling) problems.push("The starting limit must sit between the lowest and the highest.");
  if (!(v.window > 0)) problems.push("The judging time must be at least a minute.");
  if (!(v.step > 0 && v.step < 100)) problems.push("Each change must be between 0% and 100%.");
  if (!(v.wins >= 1 && v.wins <= 255) || !(v.losses >= 1 && v.losses <= 255)) problems.push("Streak lengths must be between 1 and 255.");
  if (!(v.slippage >= 0 && v.slippage <= 20)) problems.push("Price movement must be between 0% and 20%.");
  if (!isAddress(agent)) problems.push("Enter the address of the agent that will trade.");
  const teeSigner = signer.data?.signers[0];
  if (!teeSigner) problems.push(signer.isLoading ? "Reading the AI enclave's signing address…" : "The AI enclave's signing address is unavailable right now.");
  const selected = tradingChains.filter((c) => chains[c.chain.id] && c.factory);
  if (selected.length === 0) problems.push("Choose at least one chain.");

  async function submit() {
    setError(null);
    try {
      const policy = {
        startLimitCents: cents(v.start),
        ceilingCents: cents(v.ceiling),
        floorCents: cents(v.floor),
        scoreWindow: Math.round(v.window * 60),
        maxSlippageBps: Math.round(v.slippage * 100),
        stepBps: Math.round(v.step * 100),
        raiseAfterWins: v.wins,
        freezeAfterLosses: v.losses,
        maxLossCents: cents(v.maxLoss || 0),
      };
      for (const c of selected) {
        const id = c.chain.id as 84532 | 1301;
        setStatus(`Opening your account on ${c.chain.name}…`);
        await switchChainAsync({ chainId: id });
        const hash = await writeContractAsync({
          chainId: id,
          address: c.factory!,
          abi: greenlightFactoryAbi,
          functionName: "createAccount",
          args: [agent as Address, teeSigner as Address, signer.data!.model, policy],
          value: parseEther(deposit || "0"),
        });
        const receipt = await clients[id]!.waitForTransactionReceipt({ hash });
        let account: Address | undefined;
        for (const log of receipt.logs) {
          try {
            const ev = decodeEventLog({ abi: greenlightFactoryAbi, data: log.data, topics: log.topics });
            if (ev.eventName === "AccountCreated") account = ev.args.account;
          } catch {
            // other logs
          }
        }
        if (account && c.venue) {
          setStatus(`Adding test dollars on ${c.chain.name}…`);
          const f = await writeContractAsync({
            chainId: id,
            address: c.venue,
            abi: greenlightVenueAbi,
            functionName: "faucet",
            args: [account],
          });
          await clients[id]!.waitForTransactionReceipt({ hash: f });
        }
      }
      setStatus("Done. The scorer on Reactive Network is linking your accounts.");
      await qc.invalidateQueries();
      onCreated?.();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(msg.split("\n")[0]);
      setStatus(null);
    }
  }

  return (
    <Card>
      <CardHead
        title="Set the agent's rules"
        hint="You sign these once. You can change them, freeze the agent or withdraw at any time."
      />
      <div className="grid gap-x-8 gap-y-5 p-5 md:grid-cols-2">
        {fields.map((f, i) => (
          <label key={f.key} className="block">
            <span className="text-[14px] font-semibold text-ink">{f.label}</span>
            <span className="mt-0.5 block text-[13px] text-mute">{f.hint}</span>
            <span className="mt-2 flex items-center rounded-xl border border-line-2 bg-card focus-within:border-go">
              {f.unit === "$" && <span className="pl-3 text-mute">$</span>}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={f.step ?? "1"}
                value={f.value}
                onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                className="num w-full bg-transparent px-3 py-2.5 text-[15px] outline-none"
              />
              {f.unit !== "$" && <span className="pr-3 text-[13px] text-mute">{f.unit}</span>}
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-5 border-t border-line p-5 md:grid-cols-2">
        <div>
          <div className="text-[14px] font-semibold">Chains</div>
          <div className="mt-0.5 text-[13px] text-mute">A freeze on one reaches all of them.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tradingChains.map((c) => (
              <button
                key={c.chain.id}
                type="button"
                disabled={!c.factory}
                onClick={() => setChains({ ...chains, [c.chain.id]: !chains[c.chain.id] })}
                className={`rounded-xl border px-3 py-2 text-[14px] font-medium ${
                  chains[c.chain.id] && c.factory ? "border-go bg-go-soft text-go-deep" : "border-line-2 bg-card text-ink-2"
                }`}
              >
                {c.chain.name}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[14px] font-semibold">Deposit for updates, per chain</span>
          <span className="mt-0.5 block text-[13px] text-mute">Test ETH that pays for the scorer&apos;s updates to your account.</span>
          <span className="mt-2 flex items-center rounded-xl border border-line-2 bg-card focus-within:border-go">
            <input
              type="number"
              min="0"
              step="0.001"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="num w-full bg-transparent px-3 py-2.5 text-[15px] outline-none"
            />
            <span className="pr-3 text-[13px] text-mute">ETH</span>
          </span>
        </label>
        <label className="block">
          <span className="text-[14px] font-semibold">Agent</span>
          <span className="mt-0.5 block text-[13px] text-mute">
            {hostedAgent && agent.toLowerCase() === hostedAgent.toLowerCase()
              ? "Greenlight's hosted agent. You can enter your own instead."
              : "The address allowed to trade within the limit."}
          </span>
          <input
            value={agent}
            onChange={(e) => setAgent(e.target.value.trim())}
            className="num mt-2 w-full rounded-xl border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-go"
          />
        </label>
        <div>
          <div className="text-[14px] font-semibold">AI that signs decisions</div>
          <div className="mt-0.5 text-[13px] text-mute">Read now from NEAR AI Cloud&apos;s attestation report.</div>
          <div className="mt-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px]">
            {teeSigner ? (
              <>
                <span className="font-medium">{signer.data?.model}</span>
                <span className="text-mute"> · verified enclave</span>
              </>
            ) : (
              <span className="text-mute">{signer.isLoading ? "Loading…" : "Unavailable"}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]">
          {error ? (
            <span className="text-stop">{error}</span>
          ) : status ? (
            <span className="text-ink-2">{status}</span>
          ) : problems.length ? (
            <span className="text-wait">{problems[0]}</span>
          ) : (
            <span className="text-mute">
              {selected.length} transaction{selected.length > 1 ? "s" : ""} to open, then test dollars are added.
            </span>
          )}
        </div>
        <Button disabled={!address || problems.length > 0 || !!status} onClick={submit}>
          {address ? "Open account" : "Connect a wallet first"}
        </Button>
      </div>
    </Card>
  );
}
