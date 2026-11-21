const names: Record<number, { label: string; cls: string }> = {
  84532: { label: "Base", cls: "bg-info-soft text-info" },
  1301: { label: "Unichain", cls: "bg-[#fbeaf3] text-[#b0287a]" },
  5318007: { label: "Reactive", cls: "bg-[#eeeafb] text-[#5b3cc4]" },
};

export function ChainChip({ chainId }: { chainId: number }) {
  const n = names[chainId] ?? { label: String(chainId), cls: "bg-paper text-ink-2" };
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${n.cls}`}>{n.label}</span>;
}

export const chainLabel = (chainId: number) => names[chainId]?.label ?? String(chainId);
