export const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const price = (usd: number) =>
  usd.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

export function ago(seconds: number, now = Date.now() / 1000): string {
  const d = Math.max(0, Math.round(now - seconds));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
}

export function when(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** Plain-language reasons the scorer uses (see Reason in GreenlightTypes.sol). */
export const reasonText: Record<number, string> = {
  1: "Account linked",
  2: "Rules updated",
  3: "Limit raised after a winning streak",
  4: "Limit cut after a losing trade",
  5: "Frozen after a losing streak",
  6: "Frozen after too large a total loss",
  7: "Frozen by the owner",
  8: "Unfrozen by the owner",
  9: "Re-sent on request",
};
