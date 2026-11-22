"use client";

import { ChainChip } from "../chain-chip";

export interface TapeItem {
  key: string;
  chainId: number;
  text: string;
  tone: "go" | "stop" | "wait" | "info" | "mute";
  href: string;
}

const dot = { go: "bg-go", stop: "bg-stop", wait: "bg-wait", info: "bg-info", mute: "bg-mute" };

/** A continuous strip of real recent events, each linking to its transaction. Pauses on hover. */
export function LiveTape({ items }: { items: TapeItem[] }) {
  if (items.length === 0) return null;
  const row = items.length < 6 ? [...items, ...items, ...items] : items;
  return (
    <div className="group relative overflow-hidden border-y border-line py-3.5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-3 group-hover:[animation-play-state:paused]">
        {[...row, ...row].map((it, i) => (
          <a
            key={`${it.key}-${i}`}
            href={it.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-ink-2 backdrop-blur transition hover:border-line-2 hover:text-ink"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dot[it.tone]}`} />
            {it.text}
            <ChainChip chainId={it.chainId} />
          </a>
        ))}
      </div>
    </div>
  );
}
