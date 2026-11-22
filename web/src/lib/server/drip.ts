import "server-only";
import { list, put } from "@vercel/blob";
import { createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tradingChains } from "../config";
import { DRIP_ETH } from "../drip";
import { clientFor } from "./logs";

const DAILY_CAP = Number(process.env.DRIP_DAILY_CAP ?? "40");
const amount = parseEther(DRIP_ETH);

export type DripResult = { ok: true; sent: { chainId: number; tx: string }[] } | { ok: false; error: string };

/** Sends test ETH to a new visitor on every chain where they have too little, once per wallet. */
export async function drip(wallet: Address): Promise<DripResult> {
  const key = process.env.DRIP_PRIVATE_KEY as Hex | undefined;
  if (!key || !process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Free test ETH is resting right now. Please use the faucet links." };
  const who = wallet.toLowerCase();
  const day = new Date().toISOString().slice(0, 10);

  const [mine, today] = await Promise.all([list({ prefix: `drip/wallet/${who}` }), list({ prefix: `drip/day/${day}/`, limit: 1000 })]);
  if (mine.blobs.length) return { ok: false, error: "This wallet already received its free test ETH." };
  if (today.blobs.length >= DAILY_CAP) return { ok: false, error: "Today's free test ETH has all been given out. Please use the faucet links or try tomorrow." };

  const from = privateKeyToAccount(key);
  const sent: { chainId: number; tx: string }[] = [];
  await Promise.all(
    tradingChains
      .filter((c) => c.factory)
      .map(async (c) => {
        const client = clientFor(c.chain.id);
        if ((await client.getBalance({ address: wallet })) >= amount) return; // already has enough here
        const w = createWalletClient({ account: from, chain: c.chain, transport: http(c.rpcUrl) });
        const tx = await w.sendTransaction({ to: wallet, value: amount });
        await client.waitForTransactionReceipt({ hash: tx });
        sent.push({ chainId: c.chain.id, tx });
      }),
  );
  if (!sent.length) return { ok: false, error: "This wallet already has enough test ETH to open an account." };

  const record = JSON.stringify({ wallet: who, sent, at: new Date().toISOString() });
  const opts = { access: "public" as const, contentType: "application/json", addRandomSuffix: false };
  await Promise.all([put(`drip/wallet/${who}.json`, record, opts), put(`drip/day/${day}/${who}.json`, record, opts)]);
  return { ok: true, sent };
}
