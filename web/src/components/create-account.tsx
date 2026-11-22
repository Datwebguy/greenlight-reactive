"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decodeEventLog, isAddress, parseEther, type Address } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { greenlightFactoryAbi, greenlightVenueAbi } from "@/lib/abi";
import { hostedAgent, tradingChains } from "@/lib/config";
import { chainBrand } from "./brand";
import { PolicyInputs, policyFields, readPolicy } from "./policy-fields";
import { Button, Card, CardHead } from "./ui";


export function CreateAccount({ onCreated }: { onCreated?: () => void }) {
  const { address } = useAccount();
  const [fields, setFields] = useState(() => policyFields());
  const [chains, setChains] = useState<Record<number, boolean>>({ 84532: true, 1301: true });
  const [deposit, setDeposit] = useState("0.002");
  const [agent, setAgent] = useState<string>(hostedAgent ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<number, boolean>>({});
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

  const { problems, policy } = readPolicy(fields);
  if (!isAddress(agent)) problems.push("Enter the address of the agent that will trade.");
  const teeSigner = signer.data?.signers[0];
  if (!teeSigner) problems.push(signer.isLoading ? "Reading the AI enclave's signing address…" : "The AI enclave's signing address is unavailable right now.");
  const selected = tradingChains.filter((c) => chains[c.chain.id] && c.factory);
  if (selected.length === 0) problems.push("Choose at least one chain.");

  async function submit() {
    setError(null);
    try {
      for (const c of selected) {
        const id = c.chain.id as 84532 | 1301;
        if (opened[id]) continue; // already done on an earlier try
        const ok = (r: { status: string }, what: string) => {
          if (r.status !== "success") throw new Error(`${what} on ${c.chain.name} did not go through. Nothing was charged beyond the network fee.`);
        };
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
        ok(receipt, "Opening the account");
        let account: Address | undefined;
        for (const log of receipt.logs) {
          try {
            const ev = decodeEventLog({ abi: greenlightFactoryAbi, data: log.data, topics: log.topics });
            if (ev.eventName === "AccountCreated" && log.address.toLowerCase() === c.factory!.toLowerCase()) account = ev.args.account;
          } catch {
            // other logs
          }
        }
        if (!account) throw new Error(`The account on ${c.chain.name} could not be confirmed. Please refresh the page.`);
        setOpened((o) => ({ ...o, [id]: true }));
        if (c.venue) {
          setStatus(`Adding test dollars on ${c.chain.name}…`);
          const f = await writeContractAsync({
            chainId: id,
            address: c.venue,
            abi: greenlightVenueAbi,
            functionName: "faucet",
            args: [account],
          });
          ok(await clients[id]!.waitForTransactionReceipt({ hash: f }), "Adding test dollars");
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
      <PolicyInputs fields={fields} onChange={setFields} />

      <div className="grid gap-7 border-t border-line py-6 md:grid-cols-2">
        <div>
          <div className="text-[14px] font-semibold">Chains</div>
          <div className="mt-0.5 text-[13px] text-mute">A freeze on one reaches all of them.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tradingChains.map((c) => (
              <button
                key={c.chain.id}
                type="button"
                disabled={!c.factory}
                aria-pressed={Boolean(chains[c.chain.id] && c.factory)}
                onClick={() => setChains({ ...chains, [c.chain.id]: !chains[c.chain.id] })}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition ${
                  chains[c.chain.id] && c.factory ? "border-go bg-go-soft text-go-deep" : "border-line-2 text-ink-2"
                }`}
              >
                {chainBrand[c.chain.id] && (() => { const L = chainBrand[c.chain.id].Logo; return <L size={16} />; })()}
                {c.chain.name}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[14px] font-semibold">Deposit for updates, per chain</span>
          <span className="mt-0.5 block text-[13px] text-mute">Test ETH that pays for the scorer&apos;s updates to your account.</span>
          <span className="mt-2 flex items-center rounded-2xl border border-line-2 bg-card focus-within:border-go">
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
            className="num mt-2 w-full rounded-2xl border border-line-2 bg-card px-3 py-2.5 text-[14px] outline-none focus:border-go"
          />
        </label>
        <div>
          <div className="text-[14px] font-semibold">AI that signs decisions</div>
          <div className="mt-0.5 text-[13px] text-mute">Read now from NEAR AI Cloud&apos;s attestation report.</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[14px]">
            {teeSigner ? (
              <>
                <span className="font-medium">{signer.data?.model.split("/").pop()?.replace("-", " ")}</span>
                <span className="text-mute"> · verified enclave</span>
              </>
            ) : (
              <span className="text-mute">{signer.isLoading ? "Loading…" : "Unavailable"}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line py-6 sm:flex-row sm:items-center sm:justify-between">
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
