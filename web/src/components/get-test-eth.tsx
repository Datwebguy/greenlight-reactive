"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Fuel } from "lucide-react";
import { useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
import { usePublicClient, useSignMessage } from "wagmi";
import { tradingChains } from "@/lib/config";
import { DRIP_ETH, dripMessage } from "@/lib/drip";
import { Button } from "./ui";

const enough = parseEther("0.0022"); // the 0.002 deposit for limit updates, plus fees

/** One tap to get the test ETH a new visitor needs, sent straight to their wallet on every chain. */
export function GetTestEth({ wallet }: { wallet: Address }) {
  const clients = { 84532: usePublicClient({ chainId: 84532 }), 1301: usePublicClient({ chainId: 1301 }) };
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const balances = useQuery({
    queryKey: ["test-eth", wallet],
    queryFn: async () =>
      Promise.all(
        tradingChains
          .filter((c) => c.factory)
          .map(async (c) => ({ name: c.chain.name, value: (await clients[c.chain.id as 84532 | 1301]?.getBalance({ address: wallet })) ?? 0n })),
      ),
    refetchInterval: done ? false : 15_000,
  });
  const low = balances.data?.filter((b) => b.value < enough) ?? [];
  if (!balances.data || (low.length === 0 && !done)) return null;

  async function claim() {
    setError(null);
    try {
      setBusy("Confirm in your wallet. It's a free signature, nothing is sent.");
      const time = Math.floor(Date.now() / 1000);
      const signature = await signMessageAsync({ message: dripMessage(wallet, time) });
      setBusy("Sending test ETH to your wallet…");
      const res = await fetch("/api/drip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet, time, signature }) });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error ?? "Please try again.");
      setDone(true);
      await balances.refetch();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(/reject|denied|cancel/i.test(msg) ? "You cancelled in your wallet." : msg.split("\n")[0]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-go-soft/60 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="flex gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-go text-white dark:text-[#052e16]">
          {done ? <Check size={20} /> : <Fuel size={20} />}
        </span>
        <div>
          <div className="text-[17px] font-semibold tracking-tight">{done ? "Test ETH received" : "Get free test ETH"}</div>
          <p className="mt-0.5 max-w-xl text-[14px] text-ink-2">
            {done
              ? `Your wallet now has ${balances.data.map((b) => `${Number(formatEther(b.value)).toFixed(3)} on ${b.name.replace(" Sepolia", "")}`).join(" and ")}. You're ready to open your account.`
              : `Opening an account needs a little test ETH. Tap once and we send ${DRIP_ETH} to your wallet on ${low.map((b) => b.name.replace(" Sepolia", "")).join(" and ")}.`}
          </p>
          {busy && <p className="mt-2 text-[14px] text-ink-2">{busy}</p>}
          {error && <p className="mt-2 text-[14px] text-stop">{error}</p>}
        </div>
      </div>
      {!done && (
        <Button disabled={!!busy} onClick={claim} className="shrink-0">
          {busy ? "Sending…" : "Get free test ETH"}
        </Button>
      )}
    </div>
  );
}
