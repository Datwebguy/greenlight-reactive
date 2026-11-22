"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        title={`${address} · click to disconnect`}
        className="num rounded-full border border-line-2 bg-card px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink/30"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-go live-dot" />
          Connected
        </span>
      </button>
    );
  }
  const injected = connectors[0];
  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={!injected || isPending}
      className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper hover:opacity-90 disabled:opacity-50 sm:px-3.5"
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
