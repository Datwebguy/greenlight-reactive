"use client";

import { motion } from "motion/react";

/**
 * The agent's earned limit as an arc from $0 to the owner's highest. The bright part is the limit; the tick marks the
 * lowest it can be cut to.
 */
export function Gauge({
  limitCents,
  floorCents,
  ceilingCents,
  frozen = false,
  size = 220,
  children,
}: {
  limitCents: number;
  floorCents: number;
  ceilingCents: number;
  frozen?: boolean;
  size?: number;
  children?: React.ReactNode;
}) {
  const r = 42;
  const sweep = 0.75; // three quarters of a circle
  const len = 2 * Math.PI * r * sweep;
  const frac = (c: number) => Math.max(0, Math.min(1, c / Math.max(ceilingCents, 1)));
  const floorAngle = 135 + frac(floorCents) * 270;
  const fx = 50 + r * Math.cos((floorAngle * Math.PI) / 180);
  const fy = 50 + r * Math.sin((floorAngle * Math.PI) / 180);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-0">
        <defs>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--line-2)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${len} ${2 * Math.PI * r}`}
          transform="rotate(135 50 50)"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={frozen ? "var(--stop)" : "var(--go)"}
          strokeWidth="7"
          strokeLinecap="round"
          transform="rotate(135 50 50)"
          strokeDasharray={`${len} ${2 * Math.PI * r}`}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - frac(limitCents)) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 6px var(--glow))" }}
        />
        <circle cx={fx} cy={fy} r="2.2" fill="var(--card-solid)" stroke="var(--ink-2)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
