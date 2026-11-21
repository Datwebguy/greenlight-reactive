/** Prints the deployer's and agent's balances on every network Greenlight uses. */
import { createPublicClient, formatEther, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains, lasna } from "./networks.ts";

const wallets = Object.entries({ deployer: process.env.DEPLOYER_PRIVATE_KEY, agent: process.env.AGENT_PRIVATE_KEY })
  .filter(([, k]) => k)
  .map(([name, k]) => ({ name, address: privateKeyToAccount(k as Hex).address }));

for (const net of [lasna, ...chains]) {
  const client = createPublicClient({ chain: net.viem, transport: http(net.rpcUrl) });
  for (const w of wallets) {
    const balance = await client.getBalance({ address: w.address });
    console.log(`${net.viem.name.padEnd(24)} ${w.name.padEnd(9)} ${w.address} ${formatEther(balance)}`);
  }
}
