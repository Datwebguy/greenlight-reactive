import { dollars } from "@/lib/format";

/**
 * The agent's daily limit on a track from $0 to the owner's highest, with the lowest marked.
 * The darker part is what has been used today.
 */
export function LimitMeter({
  limitCents,
  floorCents,
  ceilingCents,
  usedCents = 0,
  frozen = false,
  size = "md",
}: {
  limitCents: number;
  floorCents: number;
  ceilingCents: number;
  usedCents?: number;
  frozen?: boolean;
  size?: "md" | "lg";
}) {
  const pct = (c: number) => `${Math.max(0, Math.min(100, (c / Math.max(ceilingCents, 1)) * 100))}%`;
  const used = Math.min(usedCents, limitCents);
  const h = size === "lg" ? "h-4" : "h-3";
  return (
    <div>
      <div className="relative">
        <div className={`relative ${h} w-full overflow-hidden rounded-full bg-paper ring-1 ring-line ring-inset`}>
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${frozen ? "bg-stop/25" : "bg-go/25"}`}
            style={{ width: pct(limitCents) }}
          />
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${frozen ? "bg-stop/70" : "bg-go"}`}
            style={{ width: pct(used) }}
          />
        </div>
        <div
          className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-ink/70"
          style={{ left: pct(floorCents) }}
          title={`Lowest ${dollars(floorCents)}`}
        />
        <div
          className={`absolute -top-1.5 bottom-[-6px] w-1 -translate-x-1/2 rounded ${frozen ? "bg-stop" : "bg-go-deep"}`}
          style={{ left: pct(limitCents) }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-mute">
        <span>Lowest {dollars(floorCents).replace(".00", "")}</span>
        <span className="num">
          {used > 0 ? `${dollars(used)} used today · ` : ""}
          Highest {dollars(ceilingCents).replace(".00", "")}
        </span>
      </div>
    </div>
  );
}
