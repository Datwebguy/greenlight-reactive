# Greenlight

**Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises, lowers or freezes that limit based on how the agent's trades actually turn out.**

Live app: **https://greenlight-earned.vercel.app**

An AI that can trade for you is only useful if you can trust it with a little room, and give it more once it has proved itself. Greenlight makes that room explicit and earned:

- You sign the rules once: a starting daily limit, the highest it may ever reach, the lowest it can be cut to, how long to wait before a trade is judged, and how far the price may slip.
- The agent trades inside the limit. Its decisions come from a model in a secure enclave on NEAR AI Cloud, and your account checks the enclave's signature on-chain before any money moves. Anything unsigned, or bigger than the limit, waits for your approval.
- A contract on Reactive Network judges every trade against the Chainlink price once its window has passed. A run of good trades raises the limit; each bad one cuts it.
- Too many losses in a row, or too large a total loss, freezes the agent on every chain within seconds. You can freeze it yourself from any chain too. Only you can restart it.
- You can step in or leave at any time: pause, sell the agent's ETH back to dollars, withdraw any amount, change the rules, take away the AI's permission to trade, or close the account and get everything back in one step.

The scoring runs entirely on Reactive Network. It needs no server and keeps working when the AI and the website are offline.

## Try it

**See it work without a wallet**

1. Open the [live app](https://greenlight-earned.vercel.app). The card on the right is the demo agent right now: its earned limit, its record and its latest decision in plain words.
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

**The AI cannot act outside the rules.** The agent's key can only call `trade()`. It cannot withdraw, change rules, unfreeze, approve its own requests, or stop the owner from closing the account. `closeAccount(to)` pauses the agent everywhere, removes its permission, sells back to dollars when a fresh price is available and sends every balance to the owner; if the price is stale, the ETH is sent home as it is. If the enclave is unavailable, a backup model can still suggest trades, but they carry no enclave signature and always wait for the owner.

## The full loop, on-chain

Every row is a real transaction. Times are block times; the delay is from the scorer's decision on Reactive Network to the update landing on each chain.

**A trade judged, and the limit cut on its own**

| Step | Network | What happened | Transaction |
|---|---|---|---|
| Origin event | Base Sepolia | The AI bought $12.50 of ETH at $1,684.61; the account verified the NEAR enclave's signature before filling it | [`0x8922e2…5ffb`](https://sepolia.basescan.org/tx/0x8922e273bd288850dad64d1424fe0e2ef0bf40bb4ceb00e2d06bf956a8665ffb) |
| Reaction | Reactive Lasna | On the first Chainlink update after the 10-minute window, the scorer judged it a loss (−0.18%) and cut the limit from $50.00 to $37.50 | [`0xe8a402…662f`](https://lasna.reactscan.net/tx/0xe8a402ad2a4248f254b9e0b3d1154329732340e387b6f137f8cc603f387e662f) |
| Callback | Base Sepolia | The account applied the new limit, 1 second after the decision | [`0x0e2556…237f`](https://sepolia.basescan.org/tx/0x0e2556e155fef9b4debdedbe81f095c93472aae7eae5eda4f1e8fc52a365237f) |

**One freeze, every chain**

| Step | Network | What happened | Transaction |
|---|---|---|---|
| Origin event | Base Sepolia | The owner pressed freeze on one chain | [`0x1ecc8d…00c6`](https://sepolia.basescan.org/tx/0x1ecc8d5480c5be6e0d319e6ac238ae1dfa34971fa02c23f4a1013931650000c6) |
| Reaction | Reactive Lasna | The scorer froze the agent and sent the update to every account | [`0xad5ded…135e`](https://lasna.reactscan.net/tx/0xad5ded3aa2d69f0a96b6e318747755966474a7af2720678abb9c5305a239135e) |
| Callback | Base Sepolia | Frozen, 3 seconds after the decision | [`0xc52dcc…1e15`](https://sepolia.basescan.org/tx/0xc52dcc43c98db18027a0be0f067971176270eb8345a29c6f9d83f14a4ff61e15) |
| Callback | Unichain Sepolia | Frozen, 4 seconds after the decision | [`0x2bdd1c…5816`](https://sepolia.uniscan.xyz/tx/0x2bdd1cdb1273121e0311601b6196822ebcef0f7bc1de8f5949ccecd491935816) |

**A new account picked up by the scorer, on two chains**

| Step | Network | What happened | Transaction |
|---|---|---|---|
| Origin event | Base Sepolia | Account opened through the factory | [`0x57e26b…f6f7`](https://sepolia.basescan.org/tx/0x57e26b266146b645a15d77f35ddf2f6111f8ba6f35efe553328cd90a0f40f6f7) |
| Reaction | Reactive Lasna | The scorer subscribed to the new account and set its first limit | [`0x86483c…ef18`](https://lasna.reactscan.net/tx/0x86483ce837cfaa0f0a1297043e4a12b34d169577588200468d8df3a1368fef18) |
| Callback | Base Sepolia | First limit applied | [`0x04fb4c…198a`](https://sepolia.basescan.org/tx/0x04fb4c93720c51fd8e24096c8e2b7ebb99ff7d06485c0977de892100851c198a) |
| Callback | Unichain Sepolia | The owner's second account received the same limit | [`0xa9162a…2873`](https://sepolia.uniscan.xyz/tx/0xa9162ae095e25330d54ca13a2b64730b879511852b97f338a20ec9a2c9ac2873) |

Across every update so far, a decision on Reactive Network reached each chain in **2 seconds** typically and **4 seconds** at most. `npm run replay` recomputes these numbers from the chains; `npm run replay -- --deployment testnet-v1` covers the first deployment, where the trade and freeze above happened.

## Reactive Network tools used

- **reactive-lib-omni**, pinned as a submodule. The scorer extends `AbstractReactive`, subscribes and unsubscribes through the system contract from inside `react()`, and requests callbacks with `requestCallbackV_1_0`. The accounts extend `AbstractCallback` and accept updates only from the callback proxy on behalf of the scorer.
- **Reactive MCP** (`mcp.rnk.dev`), throughout the build:
  - `plan_rc` and `get_rc_template` to plan the subscription and callback design and start from the official Omni template;
  - `check_rc_source` on every version of the scorer and accounts;
  - `get_network_info` for the supported chains and their callback proxies;
  - `validate_subscription` and `list_subscriptions` to confirm every subscription was live after deployment;
  - `get_rc_health` to check funding and reserves;
  - `trace_origin_event` to follow the first account from its origin transaction to the callback;
  - `estimate_cost`, which led to the scorer following the price feed only while trades are waiting;
  - `search_docs` for the faucet, delivery and debugging guidance.
- **Lasna testnet** for the scorer, the **Base Sepolia and Ethereum Sepolia faucets** for REACT, the **system contract's `depositTo`** for reserves, the **callback proxies** on Base Sepolia and Unichain Sepolia, and **Reactscan** for every reactive transaction linked above.
- **Timestamps, not block counts**, for every window, deadline and daily reset, as Base Sepolia now makes a block every 200 ms.

## Deployed contracts

| Contract | Network | Address |
|---|---|---|
| GreenlightScorer | Reactive Lasna (5318007) | [`0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8`](https://lasna.reactscan.net/address/0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8) |
| GreenlightFactory | Base Sepolia (84532) | [`0x0466d0db9782742e5a799b178ead73f4febf6a0b`](https://sepolia.basescan.org/address/0x0466d0db9782742e5a799b178ead73f4febf6a0b) |
| GreenlightVenue | Base Sepolia (84532) | [`0x86a290b555be160087f50bfc585ebc0f8ee4f55a`](https://sepolia.basescan.org/address/0x86a290b555be160087f50bfc585ebc0f8ee4f55a) |
| Live agent account | Base Sepolia (84532) | [`0xDfcD99b5369635A1501eA96Edfb79BC9483E35e1`](https://sepolia.basescan.org/address/0xDfcD99b5369635A1501eA96Edfb79BC9483E35e1) |
| GreenlightFactory | Unichain Sepolia (1301) | [`0x0561390cddd091e25780cf27eae868215c02e1ff`](https://sepolia.uniscan.xyz/address/0x0561390cddd091e25780cf27eae868215c02e1ff) |
| GreenlightVenue | Unichain Sepolia (1301) | [`0xeb0be28cca20db3a46542fc833685ceb56aaad9b`](https://sepolia.uniscan.xyz/address/0xeb0be28cca20db3a46542fc833685ceb56aaad9b) |
| Live agent account | Unichain Sepolia (1301) | [`0xffC76ebAd44dB68a1900CCB11A7BFbe3E46A823D`](https://sepolia.uniscan.xyz/address/0xffC76ebAd44dB68a1900CCB11A7BFbe3E46A823D) |

Every contract above is verified on Sourcify, so anyone can compare the source with what is running: [scorer](https://sourcify.dev/server/repo-ui/5318007/0x90f536d8cf4e500e64e53d774a5e63186e0dc1b8), Base [factory](https://sourcify.dev/server/repo-ui/84532/0x0466d0db9782742e5a799b178ead73f4febf6a0b), [venue](https://sourcify.dev/server/repo-ui/84532/0x86a290b555be160087f50bfc585ebc0f8ee4f55a) and [account](https://sourcify.dev/server/repo-ui/84532/0xDfcD99b5369635A1501eA96Edfb79BC9483E35e1), Unichain [factory](https://sourcify.dev/server/repo-ui/1301/0x0561390cddd091e25780cf27eae868215c02e1ff), [venue](https://sourcify.dev/server/repo-ui/1301/0xeb0be28cca20db3a46542fc833685ceb56aaad9b) and [account](https://sourcify.dev/server/repo-ui/1301/0xffC76ebAd44dB68a1900CCB11A7BFbe3E46A823D).

Addresses and deployment transactions are in [`deployments/testnet.json`](deployments/testnet.json). The first deployment, where the first trades were judged and a single freeze stopped the agent on both chains in 4 seconds, is recorded in [`deployments/testnet-v1.json`](deployments/testnet-v1.json), and the accounts opened before one-step closing was added in [`deployments/testnet-v2.json`](deployments/testnet-v2.json); replay it with `npm run replay -- --deployment testnet-v1`. Prices come from the Chainlink ETH/USD feed on Base Sepolia (aggregator `0xa24A68DD788e1D7eb4CA517765CFb2b7e217e7a3`).

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
