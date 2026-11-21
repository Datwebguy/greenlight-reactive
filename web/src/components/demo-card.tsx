import Link from "next/link";
import { ago, dollars } from "@/lib/format";
import type { demoData } from "@/lib/server/demo";
import { LimitMeter } from "./limit-meter";

type Demo = NonNullable<Awaited<ReturnType<typeof demoData>>>;

export function DemoCard({ demo, price }: { demo: Demo | null; price: { value: number; updatedAt: number } | null }) {
  if (!demo) {
    return (
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
        <p className="text-[15px] text-ink-2">The demo agent is getting ready. Check back in a minute.</p>
      </div>
    );
  }
  const { view, decision } = demo;
  const a = view.accounts[0];
  const frozen = view.accounts.some((x) => x.frozen) || Boolean(view.book?.frozen);
  const limit = view.book?.limitCents ?? a.limitCents;
  const used = Math.max(0, limit - a.remainingCents);
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-[0_1px_2px_rgb(16_21_28/0.04),0_12px_32px_-12px_rgb(16_21_28/0.12)]">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${frozen ? "bg-stop" : "live-dot bg-go"}`} />
          <span className="text-[14px] font-semibold">{frozen ? "Demo agent is frozen" : "Demo agent is trading"}</span>
        </div>
        <Link href={`/owner/${view.owner}`} className="text-[13px] font-semibold text-go-deep hover:underline">
          Open dashboard →
        </Link>
      </div>

      <div className="px-6 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[13px] text-mute">Daily limit it has earned</div>
            <div className="num mt-0.5 text-4xl font-semibold tracking-tight">{dollars(limit)}</div>
          </div>
          <div className="text-right text-[13px] text-ink-2">
            <div>
              <b className="num text-ink">{view.book?.wins ?? 0}</b> won · <b className="num text-ink">{view.book?.losses ?? 0}</b> lost
            </div>
            <div className="text-mute">{price ? `ETH ${dollars(Math.round(price.value * 100))}` : ""}</div>
          </div>
        </div>
        <div className="mt-5">
          <LimitMeter limitCents={limit} floorCents={a.policy.floorCents} ceilingCents={a.policy.ceilingCents} usedCents={used} frozen={frozen} />
        </div>
      </div>

      <div className="mt-5 border-t border-line bg-paper/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">Latest decision</span>
          {decision && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                decision.source === "near-tee" ? "bg-go-soft text-go-deep" : "bg-wait-soft text-wait"
              }`}
            >
              {decision.source === "near-tee" ? "Signed in a secure enclave" : "Backup model, needs approval"}
            </span>
          )}
        </div>
        {decision ? (
          <>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              <span className="font-semibold capitalize">{decision.action === "hold" ? "Waited" : decision.action}.</span>{" "}
              “{decision.reason}”
            </p>
            <p className="mt-1.5 text-[12px] text-mute">{ago(new Date(decision.createdAt).getTime() / 1000)}</p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-ink-2">The agent decides every 10 minutes. Its next thought appears here.</p>
        )}
      </div>
    </div>
  );
}
