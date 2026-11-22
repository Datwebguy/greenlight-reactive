/**
 * Measures the full loop many times: the owner pauses (then restarts) the showcase agent on Base, the scorer reacts on
 * Reactive Lasna, and the update lands on Base and Unichain. Writes every run to docs/data/latency.csv and a summary
 * to docs/LATENCY.md.
 *
 * Usage: RUNS=15 node --env-file=<secrets> scripts/benchmark.ts   (needs SHOWCASE_OWNER_KEY)
 */
import { writeFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import d from "../deployments/testnet.json" with { type: "json" };
import { runLoop, type LoopResult } from "../web/src/lib/server/showcase-loop.ts";

const RUNS = Number(process.env.RUNS ?? "15");
const key = process.env.SHOWCASE_OWNER_KEY as Hex;
const owner = privateKeyToAccount(key).address;
const base = (process.env.SHOWCASE_BASE ?? "0x2BbA83bF1C9310F4315333E6EF4278AE1e6ed6E9") as Address;
const unichain = (process.env.SHOWCASE_UNICHAIN ?? "0x31464562F06AC5A6b01405F2B83f86BC770eD6Bf") as Address;

type Row = { run: number; action: string; r: LoopResult };
const rows: Row[] = [];
let run = 0;
for (let i = 0; i < RUNS; i++) {
  for (const action of ["freeze", "unfreeze"] as const) {
    run++;
    try {
      const r = await runLoop({ ownerKey: key, scorer: d.scorer.address as Address, base, unichain, action });
      rows.push({ run, action, r });
      const [, dec, b, u] = r.steps;
      console.log(`#${run} ${action.padEnd(8)} decision +${dec?.seenAfterMs ?? "?"}ms  Base ${b?.afterDecisionS ?? "?"}s  Unichain ${u?.afterDecisionS ?? "?"}s  ${r.complete ? "" : "INCOMPLETE"}`);
    } catch (e) {
      console.log(`#${run} ${action} failed: ${(e as Error).message.split("\n")[0]}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

const complete = rows.filter((x) => x.r.complete);
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stat = (xs: number[], unit: string, f = (v: number) => String(v)) =>
  `| ${f(pct(xs, 50))}${unit} | ${f(pct(xs, 95))}${unit} | ${f(Math.min(...xs))}–${f(Math.max(...xs))}${unit} | ${xs.length} |`;

const csv = ["run,action,complete,origin_tx,reaction_tx,base_tx,unichain_tx,decision_after_origin_s,base_after_decision_s,unichain_after_decision_s,client_ms_to_decision,client_ms_to_base,client_ms_to_unichain"];
for (const { run, action, r } of rows) {
  const [o, dec, b, u] = r.steps;
  csv.push([run, action, r.complete, o?.tx, dec?.tx, b?.tx, u?.tx, dec && o ? dec.time - o.time : "", b?.afterDecisionS ?? "", u?.afterDecisionS ?? "", dec?.seenAfterMs ?? "", b?.seenAfterMs ?? "", u?.seenAfterMs ?? ""].join(","));
}
writeFileSync("docs/data/latency.csv", csv.join("\n") + "\n");

const sec = (v: number) => (v / 1000).toFixed(1);
const decision = complete.map((x) => x.r.steps[1].seenAfterMs);
const toBase = complete.map((x) => x.r.steps[2].seenAfterMs);
const toUni = complete.map((x) => x.r.steps[3].seenAfterMs);
const chainBase = complete.map((x) => x.r.steps[2].afterDecisionS!);
const chainUni = complete.map((x) => x.r.steps[3].afterDecisionS!);
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const sample = complete[Math.floor(complete.length / 2)]?.r.steps ?? [];

const md = `# How fast a change reaches every chain

Measured ${when} UTC on testnet: ${rows.length} owner actions (${RUNS} pauses and ${RUNS} restarts) on the showcase agent, ${complete.length} of which completed on every chain within 40 seconds. Every transaction is listed in [\`data/latency.csv\`](data/latency.csv).

## What was measured

Each run is one full loop:

1. The owner pauses or restarts the agent on **Base Sepolia**.
2. The scorer on **Reactive Lasna** reacts and decides.
3. The update lands on the owner's account on **Base Sepolia** and on **Unichain Sepolia**.

| Leg | Median | 95th percentile | Range | Runs |
|---|---:|---:|---|---:|
| Owner's transaction confirmed → scorer's decision seen (client clock) ${stat(decision, " s", sec)}
| Owner's transaction confirmed → update seen on Base (client clock) ${stat(toBase, " s", sec)}
| Owner's transaction confirmed → update seen on Unichain (client clock) ${stat(toUni, " s", sec)}
| Scorer's decision → update on Base (block times) ${stat(chainBase, " s")}
| Scorer's decision → update on Unichain (block times) ${stat(chainUni, " s")}

## Method

- **Client clock:** one script sends the owner's transaction, waits for it to be confirmed, then polls every 0.4 s for the scorer's \`LimitUpdated\` event on Lasna and the \`Synced\` event on each account. Times include polling and public RPC delays, so they are an upper bound.
- **Block times:** the difference between the block timestamp of the scorer's decision and the block timestamp of the update on each chain, in whole seconds as the chains report them.
- **Setup:** owner \`${owner}\`, scorer \`${d.scorer.address}\`, accounts \`${base}\` (Base Sepolia) and \`${unichain}\` (Unichain Sepolia). The same loop runs behind the site's one-tap check.

## A run from the middle of the set

| Step | Network | Transaction |
|---|---|---|
${sample.map((s) => `| ${s.what} | ${s.network} | [\`${s.tx.slice(0, 10)}…${s.tx.slice(-4)}\`](${s.url}) |`).join("\n")}

Run it again: \`RUNS=15 node --env-file=<secrets> scripts/benchmark.ts\`.
`;
writeFileSync("docs/LATENCY.md", md);
console.log(`\nwrote docs/LATENCY.md and docs/data/latency.csv (${complete.length}/${rows.length} complete)`);
