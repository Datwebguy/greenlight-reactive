import Link from "next/link";
import { getAbiItem, type AbiEvent } from "viem";
import { greenlightScorerAbi } from "@/lib/abi";
import { lasna, txUrl } from "@/lib/config";
import { ago, dollars, price as fmtPrice, reasonText, short } from "@/lib/format";
import { allAccounts, readPrice } from "@/lib/server/account";
import { readLogs, timeOf } from "@/lib/server/logs";
import { Card } from "./ui";

async function scorerFeed() {
  if (!lasna.scorer) return [];
  const events = ["TradeScored", "LimitUpdated"].map(
    (name) => getAbiItem({ abi: greenlightScorerAbi, name: name as never }) as unknown as AbiEvent,
  );
  const logs = await readLogs({ chainId: lasna.chain.id, address: lasna.scorer, events, fromBlock: lasna.fromBlock });
  return logs.slice(-5).reverse();
}

export async function LivePanel() {
  const [p, accounts, feed] = await Promise.all([
    readPrice().catch(() => null),
    allAccounts().catch(() => []),
    scorerFeed().catch(() => []),
  ]);
  const owners = new Set(accounts.map((a) => a.owner.toLowerCase())).size;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="live-dot h-2 w-2 rounded-full bg-go" /> Live on test networks
        </span>
        <Link href="/live" className="text-[13px] font-medium text-info hover:underline">
          Open
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line">
        <div className="bg-card px-5 py-4">
          <div className="text-[12px] font-medium uppercase tracking-wide text-mute">ETH / USD</div>
          <div className="num mt-1 text-2xl font-semibold">{p ? fmtPrice(p.value) : "—"}</div>
          <div className="text-[12px] text-mute">{p ? `Chainlink, updated ${ago(p.updatedAt)}` : "Price unavailable"}</div>
        </div>
        <div className="bg-card px-5 py-4">
          <div className="text-[12px] font-medium uppercase tracking-wide text-mute">Accounts</div>
          <div className="num mt-1 text-2xl font-semibold">{accounts.length}</div>
          <div className="text-[12px] text-mute">
            {owners} owner{owners === 1 ? "" : "s"} across 2 chains
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="text-[12px] font-medium uppercase tracking-wide text-mute">Latest from the scorer</div>
        {feed.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-2">No trades have been judged yet.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {feed.map((l) => {
              const a = l.args as Record<string, bigint | boolean | string>;
              const text =
                l.eventName === "TradeScored"
                  ? `Trade judged: ${Number(a.returnBps) >= 0 ? "+" : ""}${(Number(a.returnBps) / 100).toFixed(2)}% (${
                      Number(a.pnlCents) >= 0 ? "+" : "−"
                    }${dollars(Math.abs(Number(a.pnlCents)))})`
                  : `${reasonText[Number(a.reason)] ?? "Limit updated"}: ${dollars(Number(a.limitCents))}`;
              return (
                <li key={`${l.transactionHash}-${l.logIndex}`} className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="text-ink">
                    {text}
                    <span className="text-mute"> · {short(String(a.owner))}</span>
                  </span>
                  <a
                    href={txUrl(lasna.chain.id, l.transactionHash!)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[12px] text-mute hover:text-info"
                  >
                    {ago(timeOf(l))}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
