/**
 * Deploys Greenlight end to end:
 *   1. the scorer on Reactive Lasna (subscribed to the Base Sepolia ETH/USD aggregator)
 *   2. a venue and an account factory on each trading chain
 *   3. registers each factory with the scorer
 * Writes every address and transaction hash to deployments/<network-set>.json.
 *
 * Usage: node --env-file=<secrets> scripts/deploy.ts
 * DEPLOY_CHAINS=84532 limits the run to some trading chains; run again later to add others. Finished steps are
 * read from deployments/testnet.json and skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseEther, parseGwei, type Abi, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains, lasna, type TradingChain } from "./networks.ts";

const root = path.resolve(import.meta.dirname, "..");
const artifact = (name: string) => {
  const file = path.join(root, "artifacts/contracts", `${name}.sol`, `${name}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return { abi: json.abi as Abi, bytecode: json.bytecode as Hex };
};

const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is not set");
const account = privateKeyToAccount(key);

const scorerFunding = parseEther(process.env.SCORER_FUNDING_REACT ?? "10");
const callbackGasLimit = BigInt(process.env.CALLBACK_GAS_LIMIT ?? "300000");
const maxSettlePerPrice = BigInt(process.env.MAX_SETTLE_PER_PRICE ?? "4");
const maxAccountsPerOwner = BigInt(process.env.MAX_ACCOUNTS_PER_OWNER ?? "4");

// Lasna refuses transactions without a priority fee, which viem estimates as zero there.
const fees = (chain: typeof lasna | TradingChain) =>
  chain.viem.id === lasna.viem.id ? { maxPriorityFeePerGas: parseGwei("1") } : {};

const outFile = path.join(root, "deployments", "testnet.json");
const out: Record<string, any> = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
const save = () => {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "web/src/lib/deployments.json"), JSON.stringify(out, null, 2) + "\n");
};

async function deploy(chain: typeof lasna | TradingChain, name: string, args: unknown[], value = 0n) {
  const transport = http(chain.rpcUrl);
  const pub = createPublicClient({ chain: chain.viem, transport });
  const wallet = createWalletClient({ chain: chain.viem, transport, account });
  const { abi, bytecode } = artifact(name);
  const hash = await wallet.deployContract({ abi, bytecode, args, value, ...fees(chain) });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment failed: ${hash}`);
  console.log(`${chain.viem.name}: ${name} ${receipt.contractAddress} (${hash})`);
  return { address: receipt.contractAddress as Address, tx: hash, block: Number(receipt.blockNumber) };
}

async function send(chain: typeof lasna, to: Address, name: string, fn: string, args: unknown[]) {
  const transport = http(chain.rpcUrl);
  const pub = createPublicClient({ chain: chain.viem, transport });
  const wallet = createWalletClient({ chain: chain.viem, transport, account });
  const hash = await wallet.writeContract({ address: to, abi: artifact(name).abi, functionName: fn, args, ...fees(chain) });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${fn} failed: ${hash}`);
  console.log(`${chain.viem.name}: ${fn}(${args.join(", ")}) (${hash})`);
  return hash;
}

const priceChain = chains.find((c) => c.settlesPrices)!;

out.scorer ??= {
  chainId: lasna.viem.id,
  ...(await deploy(lasna, "GreenlightScorer", [
    BigInt(priceChain.viem.id),
    priceChain.aggregator,
    callbackGasLimit,
    maxSettlePerPrice,
    maxAccountsPerOwner,
  ], scorerFunding)),
  priceChainId: priceChain.viem.id,
  aggregator: priceChain.aggregator,
};
save();

const only = process.env.DEPLOY_CHAINS?.split(",").map((x) => Number(x.trim()));
out.chains ??= {};
for (const chain of chains.filter((c) => !only || only.includes(c.viem.id))) {
  const entry = (out.chains[chain.viem.id] ??= { name: chain.viem.name });
  entry.venue ??= await deploy(chain, "GreenlightVenue", [chain.priceFeed, BigInt(chain.maxPriceAge), chain.faucetAmount]);
  save();
  entry.factory ??= await deploy(chain, "GreenlightFactory", [chain.callbackProxy, out.scorer.address, entry.venue.address]);
  save();
  entry.registerTx ??= await send(lasna, out.scorer.address, "GreenlightScorer", "addFactory", [
    BigInt(chain.viem.id),
    entry.factory.address,
  ]);
  save();
}
console.log(`Saved ${path.relative(root, outFile)}`);
