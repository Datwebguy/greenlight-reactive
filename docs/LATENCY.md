# How fast a change reaches every chain

Measured 2026-11-22 11:47 UTC on testnet: 30 owner actions (15 pauses and 15 restarts) on the showcase agent, 30 of which completed on every chain within 40 seconds. Every transaction is listed in [`data/latency.csv`](data/latency.csv).

## What was measured

Each run is one full loop:

1. The owner pauses or restarts the agent on **Base Sepolia**.
2. The scorer on **Reactive Lasna** reacts and decides.
3. The update lands on the owner's account on **Base Sepolia** and on **Unichain Sepolia**.

| Leg | Median | 95th percentile | Range | Runs |
|---|---:|---:|---|---:|
| Owner's transaction confirmed → scorer's decision seen (client clock) | 1.7 s | 2.4 s | 0.8–2.4 s | 30 |
| Owner's transaction confirmed → update seen on Base (client clock) | 1.9 s | 2.5 s | 1.2–2.5 s | 30 |
| Owner's transaction confirmed → update seen on Unichain (client clock) | 3.9 s | 4.6 s | 3.2–4.8 s | 30 |
| Scorer's decision → update on Base (block times) | 2 s | 2 s | 1–2 s | 30 |
| Scorer's decision → update on Unichain (block times) | 3 s | 3 s | 2–3 s | 30 |

## Method

- **Client clock:** one script sends the owner's transaction, waits for it to be confirmed, then polls every 0.4 s for the scorer's `LimitUpdated` event on Lasna and the `Synced` event on each account. Times include polling and public RPC delays, so they are an upper bound.
- **Block times:** the difference between the block timestamp of the scorer's decision and the block timestamp of the update on each chain, in whole seconds as the chains report them.
- **Setup:** owner `0x0fFdbE890a1d55676323b4fc3386Ea8E12A9E776`, scorer `0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8`, accounts `0x2BbA83bF1C9310F4315333E6EF4278AE1e6ed6E9` (Base Sepolia) and `0x31464562F06AC5A6b01405F2B83f86BC770eD6Bf` (Unichain Sepolia). The same loop runs behind the site's one-tap check.

## A run from the middle of the set

| Step | Network | Transaction |
|---|---|---|
| Owner restarted the agent | Base Sepolia | [`0xc72a235d…b67e`](https://sepolia.basescan.org/tx/0xc72a235dc2f6bbf20313f133d77b77b6c00b4b3f4f2f9760d6921ea87e4ab67e) |
| Scorer restarted the agent everywhere | Reactive Lasna | [`0x48d784b0…3275`](https://lasna.reactscan.net/tx/0x48d784b063217b9ca1f18577bda4fbd00650cdd1490d69b3927b576836e03275) |
| Agent trading again here | Base Sepolia | [`0x6df3bbf1…fcea`](https://sepolia.basescan.org/tx/0x6df3bbf1433e4f4b2e78eb97c3236f14857d819ae8ceccc82b53447e71e1fcea) |
| Agent trading again here | Unichain Sepolia | [`0x68efc0a9…ca0a`](https://sepolia.uniscan.xyz/tx/0x68efc0a95f9d0d92528c355bd0446a9e3e245d423ef767f8ef25591822e9ca0a) |

Run it again: `RUNS=15 node --env-file=<secrets> scripts/benchmark.ts`.
