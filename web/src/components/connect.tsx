"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { short } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className="num rounded-xl border border-line-2 bg-card px-3 py-2 text-[13px] font-medium text-ink hover:bg-paper"
      >
        {short(address)}
      </button>
    );
  }
  const injected = connectors[0];
  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={!injected || isPending}
      className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-[13px] font-semibold text-white hover:bg-ink-2 disabled:opacity-50 sm:px-3.5"
    >
      {isPending ? (
        "Connecting…"
      ) : (
        <>
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect wallet</span>
        </>
      )}
    </button>
  );
}
