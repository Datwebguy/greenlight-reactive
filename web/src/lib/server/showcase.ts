import "server-only";
import { list, put } from "@vercel/blob";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { lasna } from "../config";
import { accountsOf } from "./account";
import { loopChains, runLoop, type LoopResult } from "./showcase-loop";

const SHARE_S = 90; // a run this recent is shown again instead of starting a new one
const DAILY_CAP = Number(process.env.SHOWCASE_DAILY_CAP ?? "40");
const abi = parseAbi(["function unfreeze()", "function ownerFrozen() view returns (bool)"]);

export type ShowcaseAnswer = (LoopResult & { ranAt: string; shared: boolean }) | { error: string };

async function lastRun(): Promise<{ result: LoopResult; ranAt: string } | null> {
  const { blobs } = await list({ prefix: "showcase/last" });
  if (!blobs[0]) return null;
  return (await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" })).json();
}

/** Pauses the showcase agent on Base, follows the update to every chain, then restarts it. */
export async function runShowcase(): Promise<ShowcaseAnswer> {
  const key = process.env.SHOWCASE_OWNER_KEY as Hex | undefined;
  if (!key || !process.env.BLOB_READ_WRITE_TOKEN || !lasna.scorer) return { error: "The live check is resting right now." };
  const owner = privateKeyToAccount(key);

  const last = await lastRun().catch(() => null);
  if (last && Date.now() / 1000 - Date.parse(last.ranAt) / 1000 < SHARE_S) return { ...last.result, ranAt: last.ranAt, shared: true };

  const day = new Date().toISOString().slice(0, 10);
  const today = await list({ prefix: `showcase/day/${day}/`, limit: 1000 });
  if (today.blobs.length >= DAILY_CAP) {
    return last ? { ...last.result, ranAt: last.ranAt, shared: true } : { error: "Today's live checks are used up. Please come back tomorrow." };
  }

  const mine = await accountsOf(owner.address);
  const base = [...mine].reverse().find((a) => a.chainId === 84532)?.address;
  const unichain = [...mine].reverse().find((a) => a.chainId === 1301)?.address;
  if (!base || !unichain) return { error: "The live check is resting right now." };

  // Start from a running agent, whatever happened to the last check.
  const pub = createPublicClient({ chain: baseSepolia, transport: http(loopChains.base.rpc) });
  const wallet = createWalletClient({ account: owner, chain: baseSepolia, transport: http(loopChains.base.rpc) });
  const restart = async () => {
    if (await pub.readContract({ address: base, abi, functionName: "ownerFrozen" })) {
      await pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: base, abi, functionName: "unfreeze" }) });
    }
  };
  await restart();

  const ranAt = new Date().toISOString();
  await put(`showcase/day/${day}/${Date.now()}.json`, "{}", { access: "public", addRandomSuffix: false });
  const result = await runLoop({ ownerKey: key, scorer: lasna.scorer as Address, base, unichain, action: "freeze", timeoutMs: 35_000 });
  await put("showcase/last.json", JSON.stringify({ result, ranAt }), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  await restart().catch(() => undefined);
  return { ...result, ranAt, shared: false };
}
