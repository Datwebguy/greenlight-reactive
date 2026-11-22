/**
 * Turns Ethereum Sepolia ETH in the deployer wallet into what Greenlight needs:
 *   - lREACT on Reactive Lasna, through Reactive's Sepolia faucet (1 ETH = 100 lREACT)
 *   - ETH on Base Sepolia, through Base's official bridge (arrives after a few minutes)
 *   - ETH on Unichain Sepolia, through Unichain's official bridge (arrives after a few minutes)
 * Usage: REACT_ETH=0.15 BRIDGE_ETH=0.08 UNICHAIN_BRIDGE_ETH=0.02 node --env-file=<secrets> scripts/fund-from-sepolia.ts
 * Bridge addresses are from the Optimism superchain registry.
 */
import { createPublicClient, createWalletClient, formatEther, http, parseAbi, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const REACTIVE_FAUCET = "0x9b9BB25f1A81078C544C829c5EB7822d747Cf434"; // Reactive faucet on Ethereum Sepolia
const BASE_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120"; // Base Sepolia L1StandardBridge
const UNICHAIN_BRIDGE = "0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2"; // Unichain Sepolia L1StandardBridge

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const transport = http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com");
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ chain: sepolia, transport, account });

const reactEth = parseEther(process.env.REACT_ETH ?? "0");
const bridgeEth = parseEther(process.env.BRIDGE_ETH ?? "0");
const unichainEth = parseEther(process.env.UNICHAIN_BRIDGE_ETH ?? "0");
if (reactEth > parseEther("5")) throw new Error("The faucet accepts at most 5 ETH per request");

console.log(`Sepolia balance: ${formatEther(await pub.getBalance({ address: account.address }))} ETH`);

if (reactEth > 0n) {
  const hash = await wallet.writeContract({
    address: REACTIVE_FAUCET,
    abi: parseAbi(["function request(address) payable"]),
    functionName: "request",
    args: [account.address],
    value: reactEth,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`Reactive faucet, ${formatEther(reactEth)} ETH: ${r.status} ${hash}`);
}

for (const [name, bridge, value] of [
  ["Base Sepolia", BASE_BRIDGE, bridgeEth],
  ["Unichain Sepolia", UNICHAIN_BRIDGE, unichainEth],
] as const) {
  if (value === 0n) continue;
  const hash = await wallet.writeContract({
    address: bridge,
    abi: parseAbi(["function depositETH(uint32 minGasLimit, bytes extraData) payable"]),
    functionName: "depositETH",
    args: [200_000, "0x"],
    value,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`Bridge to ${name}, ${formatEther(value)} ETH: ${r.status} ${hash}`);
}

console.log(`Sepolia balance left: ${formatEther(await pub.getBalance({ address: account.address }))} ETH`);
