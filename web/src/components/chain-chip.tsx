import { chainBrand } from "./brand";

/** A chain shown the way people recognise it: its logo and name, in a rounded pill. */
export function ChainChip({ chainId }: { chainId: number }) {
  const b = chainBrand[chainId];
  if (!b) return <span className="text-[12px] text-mute">{chainId}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2 py-0.5 text-[12px] font-medium text-ink-2">
      <b.Logo size={14} />
      {b.label}
    </span>
  );
}

export const chainLabel = (chainId: number) => chainBrand[chainId]?.label ?? String(chainId);
