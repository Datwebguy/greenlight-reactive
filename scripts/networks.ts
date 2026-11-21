import type { Address, Chain } from "viem";
import { baseSepolia, reactiveTestnet, unichainSepolia } from "viem/chains";

/** Reactive Network testnet, where the scorer runs. */
export const lasna = {
  viem: reactiveTestnet as Chain,
  rpcUrl: process.env.LASNA_RPC_URL ?? "https://lasna-rpc.rnk.dev",
};

export interface TradingChain {
  viem: Chain;
  rpcUrl: string;
  /** Reactive callback proxy on this chain (from Reactive's network info). */
  callbackProxy: Address;
  /** Chainlink ETH/USD proxy the venue reads. */
  priceFeed: Address;
  /** Underlying aggregator that emits AnswerUpdated, used when this chain settles trades. */
  aggregator: Address;
  /** True for the one chain whose price updates settle trades. */
  settlesPrices: boolean;
  /** Oldest price, in seconds, the venue will fill at; matches the feed's update rhythm on that chain. */
  maxPriceAge: number;
  /** Test dollars (6 decimals) the venue faucet hands out per address per day. */
  faucetAmount: bigint;
}

export const chains: TradingChain[] = [
  {
    viem: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com",
    callbackProxy: "0x476F44b11F5C942c58f4c8E3d0300E5710743585",
    priceFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    aggregator: "0xa24A68DD788e1D7eb4CA517765CFb2b7e217e7a3",
    settlesPrices: true,
    maxPriceAge: 60 * 60,
    faucetAmount: 10_000_000_000n,
  },
  {
    viem: unichainSepolia,
    rpcUrl: process.env.UNICHAIN_SEPOLIA_RPC_URL ?? "https://unichain-sepolia-rpc.publicnode.com",
    callbackProxy: "0x775c9B990ADe401060B78D0e98684eEf8d2466C1",
    priceFeed: "0xd9c93081210dFc33326B2af4C2c11848095E6a9a",
    aggregator: "0xe980F53c4dfcE2Be6047b98Fdc0778D1193aeECE",
    settlesPrices: false,
    maxPriceAge: 26 * 60 * 60,
    faucetAmount: 10_000_000_000n,
  },
];
