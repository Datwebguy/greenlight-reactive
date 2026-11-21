/**
 * Points an account at a new agent and moves the old agent's gas to it.
 * Usage: ACCOUNT=0x... node --env-file=<secrets> scripts/switch-agent.ts
 * Needs DEPLOYER_PRIVATE_KEY (the account owner), AGENT_PRIVATE_KEY (new) and OLD_AGENT_PRIVATE_KEY.
 */
import { createPublicClient, createWalletClient, formatEther, http, parseAbi, parseGwei, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains } from "./networks.ts";

const net = chains.find((c) => c.viem.id === Number(process.env.CHAIN ?? "84532"))!;
const pub = createPublicClient({ chain: net.viem, transport: http(net.rpcUrl) });
const owner = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const old = process.env.OLD_AGENT_PRIVATE_KEY ? privateKeyToAccount(process.env.OLD_AGENT_PRIVATE_KEY as Hex) : null;
const account = process.env.ACCOUNT as Address;

const asOwner = createWalletClient({ chain: net.viem, transport: http(net.rpcUrl), account: owner });
const h1 = await asOwner.writeContract({
  address: account,
  abi: parseAbi(["function setAgent(address)"]),
  functionName: "setAgent",
  args: [agent.address],
});
console.log(`setAgent(${agent.address}): ${(await pub.waitForTransactionReceipt({ hash: h1 })).status} ${h1}`);

if (old) {
  const bal = await pub.getBalance({ address: old.address });
  const gasPrice = (await pub.getGasPrice()) + parseGwei("0.001");
  const fee = 21_000n * gasPrice * 2n; // margin for the L1 data fee
  if (bal > fee) {
    const asOld = createWalletClient({ chain: net.viem, transport: http(net.rpcUrl), account: old });
    const h2 = await asOld.sendTransaction({ to: agent.address, value: bal - fee, gasPrice });
    console.log(`Moved ${formatEther(bal - fee)} ETH to the new agent: ${(await pub.waitForTransactionReceipt({ hash: h2 })).status} ${h2}`);
  }
}
console.log(`New agent gas: ${formatEther(await pub.getBalance({ address: agent.address }))} ETH`);
