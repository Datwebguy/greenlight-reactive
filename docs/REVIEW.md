# Review record

How Greenlight was checked, what each check found, and what changed as a result.

## 1. Contract tests

57 tests in [`test/Greenlight.t.sol`](../test/Greenlight.t.sol), run on every push by [GitHub Actions](../.github/workflows/test.yml). They cover:

- signed decisions: a real response signed inside NEAR AI Cloud's enclave verifies on-chain, while an edited response, another signer, an order found only in the model's reasoning, an order quoted inside other text, or a decision made for a different account does not
- limits: trades over today's limit wait for the owner, the daily limit resets, and the limit never leaves the owner's range
- scoring: winning streaks raise the limit, losses cut it, a losing streak or a large total loss freezes the agent, sales win when the price falls, and flat trades count as neither
- delivery: repeated events and callbacks change nothing, late updates and old rules are ignored, and a lost update is recovered by a resync
- the owner: pausing reaches every account, restarting starts from the lowest limit, rules changes reach the scorer, and closing an account sells back to dollars and returns every balance
- abuse: unknown contracts, absurd limits, bad prices, unknown sides, expired orders and repeated nonces are all refused

## 2. Break testing

Every safety check in the account, venue and scorer was removed or reversed one at a time, and the test suite was run against each broken version.

| Contract | Checks broken on purpose | Caught by the tests |
|---|---:|---:|
| GreenlightAccount and GreenlightVenue | 21 | 21 |
| GreenlightScorer | 26 | 26 |
| **Total** | **47** | **47** |

The first pass caught 30 of 47. Each break that went unnoticed became a new test, until all 47 were caught.

## 3. Independent model review

The contracts, the agent service and the app were reviewed by GPT-6.2 through NEAR AI Cloud. Each finding was checked against the code and the chains before acting on it.

| Finding | Result |
|---|---|
| A signed decision could be replayed on another account with the same signer and nonce | Fixed: each order now names its chain and account (`GL2:<chain>:<account>:…`); test added |
| An order quoted inside other text could count as the decision | Fixed: the order must be a complete JSON value of its own; test added |
| An out-of-range proof offset could revert instead of falling back to the owner | Fixed: the offset is bounds-checked first; test added |
| An extreme limit could overflow a raise | Fixed: limits are capped at $10 billion a day; test added |
| The agent route accepted calls when its secret was unset | Fixed: it now refuses unless the secret matches |
| An answer whose action disagreed with its order could be submitted | Fixed: the action must match the order's side |
| One busy network could stop a whole round | Fixed: each chain is handled on its own |
| Account creation did not check receipts, and a retry could repeat finished steps | Fixed: every step is confirmed, and retries resume where they stopped |
| Rules and withdrawal forms accepted fractional streaks and negative amounts | Fixed: inputs are validated before encoding |
| A failed refresh hid the owner's controls | Fixed: the last good view stays, with a notice |
| Closing an older account used the balances shown on screen | Fixed: it reads live balances after stopping the agent |
| The scorer could miss accounts from a factory added after deployment | Checked on-chain: new accounts were linked within seconds |
| An owner's page could show other owners' accounts | Checked: viem filters logs by owner after decoding; an empty wallet shows no accounts |

## 4. End to end, with real wallets

Run in a real browser against the live site, with fresh wallets on testnet:

- a new, empty wallet connects, receives free test ETH, opens accounts on Base and Unichain, is linked by the scorer and gets a decision from **Decide now**, all in under a minute
- an owner pauses, restarts, changes the rules, turns the AI off and on, withdraws, is refused a withdrawal larger than the balance, and closes the account; the final state was confirmed on-chain
- a second wallet trying to act for the owner is refused

## 5. Reactive's own diagnostics

Reactive MCP's `get_rc_health` and `list_subscriptions` were run against the live scorer. On its advice the scorer keeps a REACT reserve through the system contract, and all of its subscriptions report active.

## 6. Speed

The full loop from an owner's action on Base, through the scorer on Lasna, to both chains is measured repeatedly in [LATENCY.md](LATENCY.md), with every transaction in [data/latency.csv](data/latency.csv).
