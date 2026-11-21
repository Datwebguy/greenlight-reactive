import type { Cycle } from "@/lib/cycle";
import { txUrl } from "@/lib/config";
import { when } from "@/lib/format";
import { ChainChip } from "./chain-chip";

const headings: Record<Cycle["kind"], string> = {
  trade: "A real trade, judged and acted on",
  freeze: "A real freeze, reaching every chain",
  join: "A real account, linked by the scorer",
};

export function CycleView({ cycle }: { cycle: Cycle }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-semibold">{headings[cycle.kind]}</h3>
        {cycle.deliverySeconds !== null && (
          <span className="text-[13px] text-ink-2">
            Decision to every chain: <b className="num text-ink">{cycle.deliverySeconds}s</b>
          </span>
        )}
      </div>
      <ol className="mt-5 grid gap-4 md:grid-flow-col md:auto-cols-fr">
        {cycle.steps.map((s, i) => (
          <li key={s.tx + i} className="relative rounded-xl border border-line bg-paper/60 p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-go text-[12px] font-semibold text-white">
                {i + 1}
              </span>
              <ChainChip chainId={s.chainId} />
            </div>
            <div className="mt-3 text-[15px] font-semibold leading-snug text-ink">{s.title}</div>
            <div className="mt-1 text-[13px] text-ink-2">{s.detail}</div>
            <div className="mt-3 flex items-center justify-between text-[12px] text-mute">
              <span>{when(s.time)}</span>
              <a href={txUrl(s.chainId, s.tx)} target="_blank" rel="noreferrer" className="font-medium text-info hover:underline">
                Proof ↗
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
