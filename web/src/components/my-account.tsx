"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { isDeployed } from "@/lib/config";
import { ConnectButton } from "./connect";
import { CreateAccount } from "./create-account";
import { OwnerDashboard } from "./owner-dashboard";

export function MyAccount() {
  const { address, isConnected } = useAccount();
  const existing = useQuery<{ accounts: unknown[] }>({
    queryKey: ["owner", address],
    queryFn: async () => (await fetch(`/api/owner/${address}`, { cache: "no-store" })).json(),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Your Greenlight account</h1>
        <p className="mt-3 text-[16px] text-ink-2">
          Connect a wallet to open an account or manage the one you have. You&apos;ll need a little test ETH on Base Sepolia
          or Unichain Sepolia.
        </p>
        <div className="mt-8 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }
  if (!isDeployed) {
    return <p className="py-24 text-center text-ink-2">Greenlight&apos;s contracts are not deployed on this site yet.</p>;
  }
  if (existing.isLoading) return <div className="mt-8 h-64 animate-pulse rounded-2xl border border-line bg-card" />;
  if (existing.data && existing.data.accounts.length > 0) return <OwnerDashboard owner={address} />;

  return (
    <div className="pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Open your account</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-ink-2">
        Decide how much the agent may trade and how its limit should respond to results. The scorer on Reactive Network
        applies these rules to every trade, on every chain you choose.
      </p>
      <div className="mt-8">
        <CreateAccount onCreated={() => existing.refetch()} />
      </div>
    </div>
  );
}
