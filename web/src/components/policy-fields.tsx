"use client";

import type { PolicyView } from "@/lib/server/account";

export interface Field {
  key: string;
  label: string;
  hint: string;
  unit: string;
  value: string;
  step?: string;
}

const base: Omit<Field, "value">[] = [
  { key: "start", label: "Starting daily limit", hint: "What the agent may spend per day on day one.", unit: "$" },
  { key: "ceiling", label: "Highest it can earn", hint: "Good results never raise the limit above this.", unit: "$" },
  { key: "floor", label: "Lowest it can be cut to", hint: "Bad results never cut the limit below this.", unit: "$" },
  { key: "window", label: "Judge each trade after", hint: "How long to wait before comparing a trade with the price.", unit: "min" },
  { key: "wins", label: "Wins in a row for a raise", hint: "How many good trades in a row earn a higher limit.", unit: "trades" },
  { key: "step", label: "Size of each change", hint: "How much the limit rises or falls each time.", unit: "%" },
  { key: "losses", label: "Losses in a row that freeze it", hint: "The agent stops on every chain after this many.", unit: "trades" },
  { key: "maxLoss", label: "Total loss that freezes it", hint: "Counted since the last unfreeze. Leave 0 to switch off.", unit: "$", step: "0.01" },
  { key: "slippage", label: "Price may move by up to", hint: "Trades fail if the price moved more than this since the decision.", unit: "%", step: "0.1" },
];

const defaults: Record<string, string> = { start: "50", ceiling: "250", floor: "10", window: "10", wins: "3", step: "25", losses: "3", maxLoss: "5", slippage: "1" };

/** The rules form, filled with an existing policy or with sensible starting values. */
export function policyFields(p?: PolicyView): Field[] {
  const from: Record<string, string> = p
    ? {
        start: String(p.startLimitCents / 100),
        ceiling: String(p.ceilingCents / 100),
        floor: String(p.floorCents / 100),
        window: String(p.scoreWindow / 60),
        wins: String(p.raiseAfterWins),
        step: String(p.stepBps / 100),
        losses: String(p.freezeAfterLosses),
        maxLoss: String(p.maxLossCents / 100),
        slippage: String(p.maxSlippageBps / 100),
      }
    : defaults;
  return base.map((f) => ({ ...f, value: from[f.key] }));
}

/** Plain-language problems with the rules, and the policy to sign when there are none. */
export function readPolicy(fields: Field[]) {
  const v = Object.fromEntries(fields.map((f) => [f.key, Number(f.value)]));
  const cents = (x: number) => BigInt(Math.round(x * 100));
  const problems: string[] = [];
  if (!(v.ceiling > 0)) problems.push("The highest limit must be above zero.");
  if (v.floor > v.start || v.start > v.ceiling) problems.push("The starting limit must sit between the lowest and the highest.");
  if (!(v.window > 0)) problems.push("The judging time must be at least a minute.");
  if (!(v.step > 0 && v.step < 100)) problems.push("Each change must be between 0% and 100%.");
  if (!(v.wins >= 1 && v.wins <= 255) || !(v.losses >= 1 && v.losses <= 255)) problems.push("Streak lengths must be between 1 and 255.");
  if (!(v.slippage >= 0 && v.slippage <= 20)) problems.push("Price movement must be between 0% and 20%.");
  const policy = {
    startLimitCents: cents(v.start),
    ceilingCents: cents(v.ceiling),
    floorCents: cents(v.floor),
    scoreWindow: Math.round(v.window * 60),
    maxSlippageBps: Math.round(v.slippage * 100),
    stepBps: Math.round(v.step * 100),
    raiseAfterWins: v.wins,
    freezeAfterLosses: v.losses,
    maxLossCents: cents(v.maxLoss || 0),
  };
  return { problems, policy };
}

export function PolicyInputs({ fields, onChange }: { fields: Field[]; onChange: (f: Field[]) => void }) {
  return (
    <div className="grid gap-x-10 gap-y-7 py-6 md:grid-cols-2">
      {fields.map((f, i) => (
        <label key={f.key} className="block">
          <span className="text-[14px] font-semibold text-ink">{f.label}</span>
          <span className="mt-0.5 block text-[13px] text-mute">{f.hint}</span>
          <span className="mt-2 flex items-center rounded-2xl border border-line-2 bg-card focus-within:border-go">
            {f.unit === "$" && <span className="pl-3 text-mute">$</span>}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={f.step ?? "1"}
              value={f.value}
              onChange={(e) => onChange(fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              className="num w-full bg-transparent px-3 py-2.5 text-[15px] outline-none"
            />
            {f.unit !== "$" && <span className="pr-3 text-[13px] text-mute">{f.unit}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
