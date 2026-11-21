"use client";

import { useMemo, useRef, useState } from "react";
import { dollars, reasonText, when } from "@/lib/format";

export interface LimitPoint {
  time: number;
  limitCents: number;
  frozen: boolean;
  reason: number;
}

/** The agent's daily limit over time, as a step line between the owner's floor and ceiling. */
export function LimitChart({ points, floor, ceiling }: { points: LimitPoint[]; floor: number; ceiling: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 56, r: 16, t: 14, b: 28 };

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const now = Date.now() / 1000;
    const t0 = points[0].time;
    const t1 = Math.max(now, points[points.length - 1].time + 1);
    const top = Math.max(ceiling, ...points.map((p) => p.limitCents)) * 1.08;
    const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
    const y = (c: number) => pad.t + (1 - c / top) * (H - pad.t - pad.b);
    let d = `M${x(points[0].time)},${y(points[0].limitCents)}`;
    for (let i = 1; i < points.length; i++) d += `H${x(points[i].time)}V${y(points[i].limitCents)}`;
    d += `H${x(t1)}`;
    return { x, y, d, t0, t1 };
  }, [points, ceiling, pad.l, pad.r, pad.t, pad.b]);

  if (!geo) return <p className="px-5 py-10 text-center text-[14px] text-mute">The limit has not changed yet.</p>;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 0; i < points.length; i++) if (geo.x(points[i].time) <= px) best = i;
    setHover(best);
  };
  const h = hover === null ? null : points[hover];

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`Daily limit over time, now ${dollars(points[points.length - 1].limitCents)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[
          { c: ceiling, label: "Highest" },
          { c: floor, label: "Lowest" },
        ].map((g) => (
          <g key={g.label}>
            <line x1={pad.l} x2={W - pad.r} y1={geo.y(g.c)} y2={geo.y(g.c)} stroke="#d6d6cf" strokeDasharray="4 4" />
            <text x={pad.l - 8} y={geo.y(g.c) + 4} textAnchor="end" fontSize="11" fill="#6b7480">
              {dollars(g.c).replace(".00", "")}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e6e6e0" />
        <text x={pad.l} y={H - 8} fontSize="11" fill="#6b7480">
          {when(geo.t0)}
        </text>
        <text x={W - pad.r} y={H - 8} fontSize="11" fill="#6b7480" textAnchor="end">
          now
        </text>
        <path d={geo.d} fill="none" stroke="#138a4a" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={geo.x(p.time)}
            cy={geo.y(p.limitCents)}
            r={hover === i ? 5 : 4}
            fill={p.frozen ? "#c2362b" : "#138a4a"}
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
        {h && <line x1={geo.x(h.time)} x2={geo.x(h.time)} y1={pad.t} y2={H - pad.b} stroke="#10151c" strokeOpacity="0.15" />}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-card px-3 py-2 text-[12px] shadow-card"
          style={{ left: `${Math.min(70, (geo.x(h.time) / W) * 100)}%` }}
        >
          <div className="num font-semibold text-ink">{dollars(h.limitCents)}</div>
          <div className="text-ink-2">{reasonText[h.reason] ?? "Updated"}</div>
          <div className="text-mute">{when(h.time)}</div>
        </div>
      )}
    </div>
  );
}
