import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { tradingChains } from "./config";

const [base, unichain] = tradingChains;

export const wagmiConfig = createConfig({
  chains: [base.chain, unichain.chain],
  connectors: [injected()],
  transports: {
    [base.chain.id]: http(base.rpcUrl),
    [unichain.chain.id]: http(unichain.rpcUrl),
  },
  ssr: true,
});
