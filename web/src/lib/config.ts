import type { Address, Chain } from "viem";
import { baseSepolia, reactiveTestnet, unichainSepolia } from "viem/chains";
import deployments from "./deployments.json";

export type ChainKey = "base" | "unichain";

export interface TradingChain {
  key: ChainKey;
  chain: Chain;
  rpcUrl: string;
  explorer: string;
  priceFeed: Address;
  venue?: Address;
  factory?: Address;
  /** The current factory first, then earlier ones whose accounts still run. */
  factories: Address[];
  fromBlock: bigint;
  /** Largest block range the history RPC accepts in one log query. */
  logSpan: bigint;
  /** Where history is read from, when the fast RPC does not keep it. */
  logRpcUrl?: string;
}

type Deployed = {
  address: Address;
  tx: `0x${string}`;
  block: number;
};

type Deployments = {
  scorer?: Deployed & { chainId: number; priceChainId: number; aggregator: Address };
  chains?: Record<string, { name: string; venue?: Deployed; factory?: Deployed; registerTx?: string; previousFactories?: Deployed[] }>;
};

const d = deployments as Deployments;

export const lasna = {
  chain: reactiveTestnet as Chain,
  rpcUrl: process.env.NEXT_PUBLIC_LASNA_RPC_URL ?? "https://lasna-rpc.rnk.dev",
  explorer: "https://lasna.reactscan.net",
  scorer: d.scorer?.address,
  scorerTx: d.scorer?.tx,
  fromBlock: BigInt(d.scorer?.block ?? 0),
  logSpan: 9_999n,
};

function trading(
  key: ChainKey,
  chain: Chain,
  rpcUrl: string,
  explorer: string,
  priceFeed: Address,
  logSpan: bigint,
  logRpcUrl?: string,
): TradingChain {
  const entry = d.chains?.[String(chain.id)];
  return {
    key,
    chain,
    rpcUrl,
    explorer,
    priceFeed,
    venue: entry?.venue?.address,
    factory: entry?.factory?.address,
    factories: [entry?.factory, ...(entry?.previousFactories ?? [])].filter((f): f is Deployed => Boolean(f)).map((f) => f.address),
    fromBlock: BigInt(entry?.venue?.block ?? 0),
    logSpan,
    logRpcUrl,
  };
}

export const tradingChains: TradingChain[] = [
  trading(
    "base",
    baseSepolia,
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.basescan.org",
    "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    49_999n,
  ),
  trading(
    "unichain",
    unichainSepolia,
    process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC_URL ?? "https://unichain-sepolia-rpc.publicnode.com",
    "https://sepolia.uniscan.xyz",
    "0xd9c93081210dFc33326B2af4C2c11848095E6a9a",
    // The official node keeps full history, 1,000 blocks per query.
    999n,
    process.env.UNICHAIN_SEPOLIA_HISTORY_RPC_URL ?? "https://sepolia.unichain.org",
  ),
];

export const isDeployed = Boolean(lasna.scorer && tradingChains.some((c) => c.factory));

export function chainById(id: number): TradingChain | undefined {
  return tradingChains.find((c) => c.chain.id === id);
}

export function txUrl(chainId: number, hash: string): string {
  if (chainId === lasna.chain.id) return `${lasna.explorer}/tx/${hash}`;
  return `${chainById(chainId)?.explorer ?? ""}/tx/${hash}`;
}

export function addressUrl(chainId: number, address: string): string {
  if (chainId === lasna.chain.id) return `${lasna.explorer}/address/${address}`;
  return `${chainById(chainId)?.explorer ?? ""}/address/${address}`;
}

/** The Greenlight agent's public address; accounts that name it are traded by the hosted agent. */
export const hostedAgent = process.env.NEXT_PUBLIC_AGENT_ADDRESS as Address | undefined;
