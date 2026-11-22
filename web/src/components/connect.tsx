"use client";

import { Check, LogOut, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { WalletCoinbase, WalletMetamask } from "@web3icons/react";

/** Friendly order and labels for the ways to connect. */
function describe(c: Connector): { title: string; hint: string; rank: number } {
  if (c.id === "metaMaskSDK" || c.id === "metaMask") return { title: "MetaMask", hint: "Opens the MetaMask app or extension", rank: 1 };
  if (c.id === "coinbaseWalletSDK") return { title: "Coinbase Wallet", hint: "Works in any browser, nothing to install", rank: 2 };
  if (c.id === "injected") return { title: "Browser wallet", hint: "The wallet built into this browser", rank: 9 };
  return { title: c.name, hint: "Detected in this browser", rank: 0 };
}

export function ConnectButton() {
  const { address, isConnected, connector: active } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInjected, setHasInjected] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setHasInjected(typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum)), []);

  const options = useMemo(() => {
    const named = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
    const list = connectors.filter((c) => {
      // A generic "browser wallet" only when the browser has one and no named wallet already covers it.
      if (c.id === "injected") return hasInjected && named.length === 0;
      // Named browser wallets replace the MetaMask app link when MetaMask is already installed here.
      if ((c.id === "metaMaskSDK" || c.id === "metaMask") && named.some((n) => /metamask/i.test(n.name))) return false;
      return true;
    });
    return list.sort((a, b) => describe(a).rank - describe(b).rank);
  }, [connectors, hasInjected]);

  async function pick(c: Connector) {
    setError(null);
    try {
      await connectAsync({ connector: c });
      setOpen(false);
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "";
      if (/reject|denied|cancel/i.test(msg)) setError("You cancelled in your wallet. Try again when you're ready.");
      else if (/not found|provider/i.test(msg)) setError("That wallet isn't available here. Try MetaMask or Coinbase Wallet.");
      else setError("Couldn't connect. Please try again, or pick another wallet.");
    }
  }

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          title={address}
          className="num inline-flex items-center gap-2 rounded-full border border-line-2 bg-card px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink/30"
        >
          <span className="live-dot h-2 w-2 rounded-full bg-go" />
          Connected
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 z-50 mt-2 w-56 rounded-3xl border border-line bg-card-solid p-2 shadow-card"
            >
              <div className="px-3 py-2 text-[12px] text-mute">Connected with {active?.name ?? "your wallet"}</div>
              <button
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-[14px] font-medium text-ink hover:bg-go-soft"
              >
                <LogOut size={16} /> Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper hover:opacity-90 sm:px-3.5"
      >
        <span className="sm:hidden">Connect</span>
        <span className="hidden sm:inline">Connect wallet</span>
      </button>

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Connect a wallet"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[32px] bg-card-solid p-6 shadow-card"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-semibold tracking-tight">Connect a wallet</h2>
                <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-line text-mute hover:text-ink">
                  <X size={16} />
                </button>
              </div>
              <p className="mt-1.5 text-[14px] text-ink-2">Greenlight never holds your keys. You approve everything in your wallet.</p>

              <ul className="mt-5 space-y-2">
                {options.map((c) => {
                  const d = describe(c);
                  return (
                    <li key={c.uid}>
                      <button
                        disabled={isPending}
                        onClick={() => pick(c)}
                        className="flex w-full items-center gap-3 rounded-full border border-line px-4 py-3 text-left transition hover:border-go hover:bg-go-soft disabled:opacity-60"
                      >
                        {c.id === "metaMaskSDK" || c.id === "metaMask" ? (
                          <WalletMetamask variant="branded" size={28} />
                        ) : c.id === "coinbaseWalletSDK" ? (
                          <WalletCoinbase variant="branded" size={28} />
                        ) : c.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.icon} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
                        ) : (
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-go-soft text-go-deep">
                            <Wallet size={15} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-ink">{d.title}</span>
                          <span className="block text-[12px] text-mute">{d.hint}</span>
                        </span>
                        <Check size={16} className="text-transparent" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {error && <p className="mt-4 rounded-full bg-stop-soft px-4 py-2.5 text-[13px] text-stop">{error}</p>}
              {isPending && <p className="mt-4 text-center text-[13px] text-mute">Check your wallet to continue…</p>}
              <p className="mt-5 text-center text-[12px] text-mute">Greenlight runs on test networks. No real money is used.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </>
  );
}
