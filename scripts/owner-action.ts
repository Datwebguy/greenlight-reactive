/**
 * The demo owner freezes or unfreezes the agent from one chain, then waits until every account has applied it.
 * Usage: ACTION=freeze|unfreeze CHAIN=84532 node --env-file=<secrets> scripts/owner-action.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains } from "./networks.ts";

const root = path.resolve(import.meta.dirname, "..");
const d = JSON.parse(fs.readFileSync(path.join(root, "deployments/testnet.json"), "utf8"));
const action = process.env.ACTION === "unfreeze" ? "unfreeze" : "freeze";
const from = chains.find((c) => c.viem.id === Number(process.env.CHAIN ?? "84532"))!;
const owner = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const abi = parseAbi(["function freeze()", "function unfreeze()", "function frozen() view returns (bool)", "function appliedSeq() view returns (uint64)", "function accountsOf(address) view returns (address[])"]);

const accounts: { chain: (typeof chains)[number]; address: Address }[] = [];
for (const c of chains) {
  const f = d.chains?.[c.viem.id]?.factory?.address;
  if (!f) continue;
  const pub = createPublicClient({ chain: c.viem, transport: http(c.rpcUrl) });
  for (const a of (await pub.readContract({ address: f, abi, functionName: "accountsOf", args: [owner.address] })) as Address[]) {
    accounts.push({ chain: c, address: a });
  }
}
const target = accounts.find((a) => a.chain.viem.id === from.viem.id)!;
const pub = (c: (typeof chains)[number]) => createPublicClient({ chain: c.viem, transport: http(c.rpcUrl) });
const before = await Promise.all(accounts.map((a) => pub(a.chain).readContract({ address: a.address, abi, functionName: "appliedSeq" })));

const wallet = createWalletClient({ chain: from.viem, transport: http(from.rpcUrl), account: owner });
const t0 = Date.now();
const hash = await wallet.writeContract({ address: target.address, abi, functionName: action });
const r = await pub(from).waitForTransactionReceipt({ hash });
console.log(`${action} on ${from.viem.name}: ${r.status} ${hash}`);

const want = action === "freeze";
const done = new Set<number>();
while (done.size < accounts.length && Date.now() - t0 < 180_000) {
  for (const [i, a] of accounts.entries()) {
    if (done.has(i)) continue;
    const seq = await pub(a.chain).readContract({ address: a.address, abi, functionName: "appliedSeq" });
    const fr = await pub(a.chain).readContract({ address: a.address, abi, functionName: "frozen" });
    if (seq > before[i] && fr === want) {
      done.add(i);
      console.log(`${a.chain.viem.name}: ${want ? "frozen" : "trading again"} by the scorer's update, ${((Date.now() - t0) / 1000).toFixed(0)}s after the owner's transaction was sent`);
    }
  }
  await new Promise((res) => setTimeout(res, 1000));
}
if (done.size < accounts.length) console.log("Not every chain confirmed within 3 minutes; run `npm run replay` to see the deliveries.");
