/**
 * Buys Lasna test REACT through Reactive's faucet on Base Sepolia (1 ETH = 100 lREACT, at most 5 ETH per request).
 * Usage: REACT_FAUCET_ETH=0.15 node --env-file=<secrets> scripts/get-react.ts
 */
import { createPublicClient, createWalletClient, formatEther, http, parseAbi, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains, lasna } from "./networks.ts";

const FAUCET = "0x2afaFD298b23b62760711756088F75B7409f5967"; // Reactive faucet on Base Sepolia
const amount = parseEther(process.env.REACT_FAUCET_ETH ?? "0.15");
if (amount > parseEther("5")) throw new Error("The faucet accepts at most 5 ETH per request");

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const base = chains.find((c) => c.viem.id === 84532)!;
const pub = createPublicClient({ chain: base.viem, transport: http(base.rpcUrl) });
const wallet = createWalletClient({ chain: base.viem, transport: http(base.rpcUrl), account });
const react = createPublicClient({ chain: lasna.viem, transport: http(lasna.rpcUrl) });

const before = await react.getBalance({ address: account.address });
const hash = await wallet.writeContract({
  address: FAUCET,
  abi: parseAbi(["function request(address) payable"]),
  functionName: "request",
  args: [account.address],
  value: amount,
});
await pub.waitForTransactionReceipt({ hash });
console.log(`Sent ${formatEther(amount)} ETH to the faucet: ${hash}`);
for (let i = 0; i < 40; i++) {
  const now = await react.getBalance({ address: account.address });
  if (now > before) {
    console.log(`lREACT balance on Lasna: ${formatEther(now)}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("No lREACT yet; the faucet can take a few minutes. Check again with npm run balances.");
