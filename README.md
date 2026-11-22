# Greenlight

**Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises, lowers or freezes that limit based on how the agent's trades actually turn out.**

Live app: **https://greenlight-algo-dao-30577dec.vercel.app**

An AI that can trade for you is only useful if you can trust it with a little room, and give it more once it has proved itself. Greenlight makes that room explicit and earned:

- You sign the rules once: a starting daily limit, the highest it may ever reach, the lowest it can be cut to, how long to wait before a trade is judged, and how far the price may slip.
- The agent trades inside the limit. Its decisions come from a model in a secure enclave on NEAR AI Cloud, and your account checks the enclave's signature on-chain before any money moves. Anything unsigned, or bigger than the limit, waits for your approval.
- A contract on Reactive Network judges every trade against the Chainlink price once its window has passed. A run of good trades raises the limit; each bad one cuts it.
- Too many losses in a row, or too large a total loss, freezes the agent on every chain within seconds. You can freeze it yourself from any chain too. Only you can restart it.

The scoring runs entirely on Reactive Network. It needs no server and keeps working when the AI and the website are offline.

## Try it

**See it work without a wallet**

1. Open the [live app](https://greenlight-algo-dao-30577dec.vercel.app). The card on the right is the demo agent right now: its earned limit, its record and its latest decision in plain words.
2. Press **See the demo agent**. You get the full dashboard: the limit on its track between lowest and highest, what is waiting for the owner, what the agent is thinking, the limit over time, every event with a link to its transaction, and how many seconds each change took to reach each chain.
3. Under **Proof, not promises** on the home page, open any **Proof** link to see the transaction on the block explorer.

**Replay the whole history from the chains** (no keys, no setup beyond `npm install`)

```bash
git clone --recurse-submodules https://github.com/Datwebguy/greenlight-reactive
cd greenlight-reactive && npm install
npm run replay
```

You see every account opening, every trade the AI made and whether the enclave signed it, every verdict and limit change from the scorer on Reactive Network, and when each change was applied on each chain, with the delay in seconds and a link to each transaction.

**Run the contract tests**

```bash
npm test
```

36 tests, including one that verifies a real response signed by NEAR AI Cloud's enclave inside the account contract, and ones that replay duplicate events and lost callbacks to show nothing changes twice and nothing is lost.

**Open your own account**

1. Get a little test ETH on Base Sepolia, then open the app and press **Connect wallet**.
2. Go to **My account**, set your rules (every field is yours to choose) and press **Open account**. The app opens the account and adds 10,000 test dollars.
3. Within seconds the scorer on Reactive Network links your account and sends its first limit; the account shows **Up to date**.
4. The hosted agent makes a decision every 10 minutes. Watch **What the agent is thinking**; approve or reject anything under **Waiting for the owner**; press **Freeze everywhere** at any time.

## How it is built

```
 Base Sepolia / Unichain Sepolia                 Reactive Network (Lasna)
 ┌──────────────────────────────┐                ┌──────────────────────────────┐
 │ GreenlightAccount            │  TradeExecuted │ GreenlightScorer             │
 │  · holds the owner's funds   │ ─────────────► │  · queues each trade         │
 │  · checks the enclave's      │  OwnerAction   │  · judges it on the first    │
 │    signature on-chain        │ ─────────────► │    Chainlink update after    │
 │  · enforces limit, slippage, │                │    its window                │
 │    deadline, freeze          │   sync(...)    │  · raises / cuts / freezes   │
 │  · applies only newer        │ ◄───────────── │  · sends the result to every │
 │    updates                   │   callback     │    chain the owner uses      │
 └──────────────────────────────┘                └──────────────────────────────┘
          ▲  trade(order, proof)                           ▲ AnswerUpdated
          │                                                │
 ┌──────────────────────────────┐                ┌──────────────────────────────┐
 │ Agent (Vercel function)      │                │ Chainlink ETH/USD            │
 │  · reads prices and limits   │                │ aggregator on Base Sepolia   │
 │  · asks Qwen3.8 27B in a TEE │                └──────────────────────────────┘
 │    on NEAR AI Cloud          │
 │  · submits the signed answer │
 └──────────────────────────────┘
```

| Part | What it does |
|---|---|
| [`contracts/GreenlightAccount.sol`](contracts/GreenlightAccount.sol) | One per owner per chain. Holds the funds; runs a trade at once only if the enclave signed it and it fits today's limit; everything else becomes an approval request. Rebuilds the exact text NEAR AI Cloud signs (`model:sha256(request):sha256(response)`), recovers the signer, and checks that the order sits in the model's final answer. Receives the scorer's updates through Reactive's callback proxy and applies only newer ones. |
| [`contracts/GreenlightScorer.sol`](contracts/GreenlightScorer.sol) | The Reactive contract. Subscribes to new accounts through each chain's factory, then to each account's trades, owner actions, rule changes and resync requests, and to the Chainlink aggregator. Judges trades in order, applies the owner's rules, and sends one update per change to every account the owner has. |
| [`contracts/GreenlightVenue.sol`](contracts/GreenlightVenue.sol) | Fills trades between test dollars and test ether at the live Chainlink price, refusing stale prices and moves beyond the allowed slippage. |
| [`contracts/GreenlightFactory.sol`](contracts/GreenlightFactory.sol) | Opens accounts and announces them, so the scorer can start watching. |
| [`web/`](web) | The app (Next.js) and the agent service. Everything shown is read from the chains; the agent's decisions, including the ones where it waited, are kept as small JSON records. |

**Delivery is safe to repeat and safe to lose.** Every update carries a sequence number and the account applies only newer ones, so a repeated delivery changes nothing. If a delivery is lost, anyone can press **Fetch the latest limit** (or call `requestResync()`), and the scorer sends the current state again. Events from contracts the scorer does not know are ignored.

**The AI cannot act outside the rules.** The agent's key can only call `trade()`. It cannot withdraw, change rules, unfreeze, or approve its own requests. If the enclave is unavailable, a backup model can still suggest trades, but they carry no enclave signature and always wait for the owner.

## Deployed contracts

| Contract | Network | Address |
|---|---|---|
| GreenlightScorer | Reactive Lasna (5318007) | [`0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8`](https://lasna.reactscan.net/address/0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8) |
| GreenlightFactory | Base Sepolia (84532) | [`0xd6f04d7fff39a234af3d29b9ac92f8016ed451c7`](https://sepolia.basescan.org/address/0xd6f04d7fff39a234af3d29b9ac92f8016ed451c7) |
| GreenlightVenue | Base Sepolia (84532) | [`0x86a290b555be160087f50bfc585ebc0f8ee4f55a`](https://sepolia.basescan.org/address/0x86a290b555be160087f50bfc585ebc0f8ee4f55a) |
| Demo account | Base Sepolia (84532) | [`0xa03a683E72180ad87ce6f45f7d6F7B99936841D4`](https://sepolia.basescan.org/address/0xa03a683E72180ad87ce6f45f7d6F7B99936841D4) |
| GreenlightFactory | Unichain Sepolia (1301) | [`0x132cd04d204902c30203d20a24788c41f72ec203`](https://sepolia.uniscan.xyz/address/0x132cd04d204902c30203d20a24788c41f72ec203) |
| GreenlightVenue | Unichain Sepolia (1301) | [`0xeb0be28cca20db3a46542fc833685ceb56aaad9b`](https://sepolia.uniscan.xyz/address/0xeb0be28cca20db3a46542fc833685ceb56aaad9b) |
| Demo account | Unichain Sepolia (1301) | [`0x4Ca9848bFa77293c9FCe459884C22Ac96244099f`](https://sepolia.uniscan.xyz/address/0x4Ca9848bFa77293c9FCe459884C22Ac96244099f) |

Every contract above is verified on Sourcify, so anyone can compare the source with what is running: [scorer](https://sourcify.dev/server/repo-ui/5318007/0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8), Base [factory](https://sourcify.dev/server/repo-ui/84532/0xd6f04d7fff39a234af3d29b9ac92f8016ed451c7), [venue](https://sourcify.dev/server/repo-ui/84532/0x86a290b555be160087f50bfc585ebc0f8ee4f55a) and [demo account](https://sourcify.dev/server/repo-ui/84532/0xa03a683E72180ad87ce6f45f7d6F7B99936841D4), Unichain [factory](https://sourcify.dev/server/repo-ui/1301/0x132cd04d204902c30203d20a24788c41f72ec203), [venue](https://sourcify.dev/server/repo-ui/1301/0xeb0be28cca20db3a46542fc833685ceb56aaad9b) and [demo account](https://sourcify.dev/server/repo-ui/1301/0x4Ca9848bFa77293c9FCe459884C22Ac96244099f).

Addresses and deployment transactions are in [`deployments/testnet.json`](deployments/testnet.json). The first deployment, where the first trades were judged and a single freeze stopped the agent on both chains in 4 seconds, is recorded in [`deployments/testnet-v1.json`](deployments/testnet-v1.json); replay it with `npm run replay -- --deployment testnet-v1`. Prices come from the Chainlink ETH/USD feed on Base Sepolia (aggregator `0xa24A68DD788e1D7eb4CA517765CFb2b7e217e7a3`).

**The scorer only pays for what it uses.** It follows the price feed only while a trade is waiting to be judged, and stops as soon as the queue is empty, so a quiet day costs almost nothing.

## Running it yourself

```bash
npm install && npm run build                 # compile contracts, export interfaces to the app
npm test                                     # contract tests
cd web && npm install && npm run dev         # the app, reading the deployed contracts
```

To deploy your own copy, put `DEPLOYER_PRIVATE_KEY` in an env file outside the repo, fund it with Base Sepolia ETH and Lasna REACT, then run `node --env-file=<file> scripts/deploy.ts`. The script records every address and transaction in `deployments/testnet.json` and the app picks them up.

The agent service needs `AGENT_PRIVATE_KEY`, `NEAR_AI_API_KEY`, `OPENAI_API_KEY` and `CRON_SECRET` in the app's environment; `/api/agent/tick` runs one round of decisions and is called every 10 minutes.

## Built with

[Reactive Network](https://dev.reactive.network) (reactive-lib-omni) · [NEAR AI Cloud](https://docs.near.ai/cloud/private-inference) private inference · [Chainlink](https://docs.chain.link/data-feeds) price feeds · Hardhat 3 · OpenZeppelin · Next.js · viem and wagmi · Vercel

## License

MIT
