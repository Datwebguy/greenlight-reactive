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
      <div className="grid gap-12 pt-16 pb-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-20">
        <div>
          <span className="inline-flex rounded-full bg-go-soft px-3.5 py-1.5 text-[13px] font-semibold text-go-deep">
            About a minute to set up
          </span>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">Give an AI a limit it has to earn.</h1>
          <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-2">
            Open an account, set the rules once, and the agent starts trading test funds inside them. Its limit moves with its
            results, and you can stop it at any time.
          </p>
          <ol className="mt-8 space-y-5">
            {[
              {
                t: "Connect a wallet",
                b: "Any browser wallet works, such as MetaMask or Rabby. Your keys never leave it.",
              },
              {
                t: "Get a little test ETH",
                b: (
                  <>
                    A few cents&apos; worth pays for opening the account. Free from the{" "}
                    <a className="font-medium text-info hover:underline" href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noreferrer">
                      Base Sepolia faucet
                    </a>{" "}
                    or the{" "}
                    <a className="font-medium text-info hover:underline" href="https://docs.unichain.org/docs/tools/faucets" target="_blank" rel="noreferrer">
                      Unichain Sepolia faucets
                    </a>
                    .
                  </>
                ),
              },
              {
                t: "Set the rules and open the account",
                b: "Choose the starting limit, the highest and lowest it can reach, and when it should freeze. 10,000 test dollars are added for you.",
              },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-go text-[13px] font-semibold text-white dark:text-[#052e16]">{i + 1}</span>
                <div>
                  <div className="text-[16px] font-semibold">{s.t}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ConnectButton />
            <a href="/live" className="text-[14px] font-semibold text-go-deep hover:underline">
              Or watch the live agent first →
            </a>
          </div>
        </div>

        <div className="lg:pt-14">
          <div className="text-[13px] font-semibold tracking-[0.14em] text-go-deep uppercase">The rules you will choose</div>
          <dl className="mt-5 divide-y divide-line border-y border-line text-[15px]">
            {[
              ["Starting daily limit", "How much the agent may trade on day one"],
              ["Highest it can earn", "Good results never raise it above this"],
              ["Lowest it can be cut to", "Bad results never cut it below this"],
              ["Wins for a raise", "How many good trades in a row earn more room"],
              ["Losses that freeze it", "It stops on every chain after this many in a row"],
              ["Judging time", "How long to wait before a trade is checked against the market"],
            ].map(([k, v]) => (
              <div key={k} className="py-4">
                <dt className="font-semibold">{k}</dt>
                <dd className="mt-0.5 text-[14px] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-mute">You can change every rule later, and withdraw your funds at any time.</p>
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
    <div className="pt-16">
      <h1 className="text-[40px] leading-tight font-semibold tracking-tight sm:text-[52px]">Open your account</h1>
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
