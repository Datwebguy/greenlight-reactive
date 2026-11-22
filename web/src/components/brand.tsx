import { NetworkBase, NetworkNearProtocol, NetworkUnichain, TokenETH, TokenLINK } from "@web3icons/react";

/** Official logos of the networks and services Greenlight is built on. */

export function ReactiveMark({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brands/reactive-mark.svg" alt="Reactive Network" width={size} height={size} className="shrink-0" />;
}

export function BaseLogo({ size = 20 }: { size?: number }) {
  return <NetworkBase variant="branded" size={size} aria-label="Base" />;
}

export function UnichainLogo({ size = 20 }: { size?: number }) {
  return <NetworkUnichain variant="branded" size={size} aria-label="Unichain" />;
}

export function NearLogo({ size = 20 }: { size?: number }) {
  return <NetworkNearProtocol variant="branded" size={size} aria-label="NEAR" />;
}

export function ChainlinkLogo({ size = 20 }: { size?: number }) {
  return <TokenLINK variant="branded" size={size} aria-label="Chainlink" />;
}

export function EthLogo({ size = 20 }: { size?: number }) {
  return <TokenETH variant="branded" size={size} aria-label="ETH" />;
}

export const chainBrand: Record<number, { label: string; Logo: (p: { size?: number }) => React.ReactElement }> = {
  84532: { label: "Base", Logo: BaseLogo },
  1301: { label: "Unichain", Logo: UnichainLogo },
  5318007: { label: "Reactive", Logo: ReactiveMark },
};

/** The row of partners, shown as their real logos. */
export function BuiltOn() {
  const items = [
    { name: "Reactive Network", Logo: ReactiveMark },
    { name: "NEAR AI", Logo: NearLogo },
    { name: "Chainlink", Logo: ChainlinkLogo },
    { name: "Base", Logo: BaseLogo },
    { name: "Unichain", Logo: UnichainLogo },
  ];
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
      {items.map(({ name, Logo }) => (
        <li key={name} className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-ink-2 opacity-80 transition hover:opacity-100">
          <Logo size={26} />
          {name}
        </li>
      ))}
    </ul>
  );
}
