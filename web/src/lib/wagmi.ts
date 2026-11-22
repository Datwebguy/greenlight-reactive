import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, metaMask } from "wagmi/connectors";
import { tradingChains } from "./config";

const [base, unichain] = tradingChains;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://greenlight-earned.vercel.app";

export const wagmiConfig = createConfig({
  chains: [base.chain, unichain.chain],
  connectors: [
    // Any wallet the browser already has (extensions on desktop, the in-app browser of a mobile wallet).
    injected({ shimDisconnect: true }),
    // Opens the MetaMask app on phones, or the extension on desktop.
    metaMask({ dappMetadata: { name: "Greenlight", url: site } }),
    // Works in any browser, including phones, with no extension.
    coinbaseWallet({ appName: "Greenlight", preference: "all" }),
  ],
  // Wallets that announce themselves (EIP-6963) are listed by name automatically.
  multiInjectedProviderDiscovery: true,
  transports: {
    [base.chain.id]: http(base.rpcUrl),
    [unichain.chain.id]: http(unichain.rpcUrl),
  },
  ssr: true,
});
