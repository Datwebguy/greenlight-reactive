/**
 * Opens the demo account: owner = deployer, agent = the hosted agent, AI signer = the address NEAR AI Cloud's
 * attestation report vouches for right now. Also gives the agent gas and adds test dollars.
 * Usage: DEMO_CHAIN=84532 node --env-file=<secrets> scripts/open-demo.ts
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, decodeEventLog, http, parseEther, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chains } from "./networks.ts";

const root = path.resolve(import.meta.dirname, "..");
const abiOf = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts", `${name}.sol`, `${name}.json`), "utf8")).abi as Abi;
const deployments = JSON.parse(fs.readFileSync(path.join(root, "deployments/testnet.json"), "utf8"));

const chainId = Number(process.env.DEMO_CHAIN ?? "84532");
const net = chains.find((c) => c.viem.id === chainId)!;
const entry = deployments.chains[chainId];
const owner = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex).address;
const pub = createPublicClient({ chain: net.viem, transport: http(net.rpcUrl) });
const wallet = createWalletClient({ chain: net.viem, transport: http(net.rpcUrl), account: owner });

const MODEL = process.env.NEAR_AI_MODEL ?? "Qwen/Qwen3.8-27B";
const rep = await (
  await fetch(
    `https://cloud-api.near.ai/v1/attestation/report?model=${encodeURIComponent(MODEL)}&signing_algo=ecdsa&nonce=${randomBytes(32).toString("hex")}`,
  )
).json();
const signer = (rep.model_attestations ?? [rep])[0]?.signing_address as Address;
if (!signer) throw new Error("No signing address in the attestation report");
console.log(`AI signer from attestation: ${signer}`);

const send = async (label: string, p: Promise<Hex>) => {
  const hash = await p;
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${label}: ${r.status} ${hash}`);
  return r;
};

const agentGas = parseEther(process.env.AGENT_GAS_ETH ?? "0.01");
if (agentGas > 0n) await send("Agent gas", wallet.sendTransaction({ to: agent, value: agentGas }));

// Every rule can be set from the environment; the defaults are the live agent's rules.
const env = (k: string, d: number) => Number(process.env[k] ?? d);
const policy = {
  startLimitCents: BigInt(env("START_CENTS", 50_00)),
  ceilingCents: BigInt(env("CEILING_CENTS", 250_00)),
  floorCents: BigInt(env("FLOOR_CENTS", 10_00)),
  scoreWindow: env("WINDOW_SECONDS", 10 * 60),
  maxSlippageBps: env("SLIPPAGE_BPS", 100),
  stepBps: env("STEP_BPS", 2_500),
  raiseAfterWins: env("RAISE_AFTER_WINS", 3),
  freezeAfterLosses: env("FREEZE_AFTER_LOSSES", 3),
  maxLossCents: BigInt(env("MAX_LOSS_CENTS", 5_00)),
};
const created = await send(
  "Open account",
  wallet.writeContract({
    address: entry.factory.address,
    abi: abiOf("GreenlightFactory"),
    functionName: "createAccount",
    args: [agent, signer, MODEL, policy],
    value: parseEther(process.env.UPDATE_DEPOSIT_ETH ?? "0.005"),
  }),
);
let account: Address | undefined;
for (const log of created.logs) {
  try {
    const ev = decodeEventLog({ abi: abiOf("GreenlightFactory"), data: log.data, topics: log.topics });
    if (ev.eventName === "AccountCreated") account = (ev.args as { account: Address }).account;
  } catch {
    // not a factory event
  }
}
console.log(`Account: ${account}`);
await send(
  "Test dollars",
  wallet.writeContract({ address: entry.venue.address, abi: abiOf("GreenlightVenue"), functionName: "faucet", args: [account] }),
);
