import { ArrowRight, PowerOff, ScrollText } from "lucide-react";
import Link from "next/link";
import { Reveal } from "../motion";

/** Two promises side by side: the agent's record is public and permanent, and protection does not need the AI. */
export function Record({
  href,
  judged,
  won,
  resultCents,
}: {
  href: string;
  judged: number;
  won: number;
  resultCents: number;
}) {
  const usd = `${resultCents < 0 ? "−" : "+"}$${(Math.abs(resultCents) / 100).toFixed(2)}`;
  return (
    <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
      <Reveal>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-go-soft text-go-deep">
          <ScrollText size={22} />
        </span>
        <h2 className="mt-6 text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">Its record is public, and nobody can edit it.</h2>
        <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ink-2">
          Every trade, every verdict and every change to the limit is written on-chain. Even the AI&apos;s reasoning is stored
          inside each trade, signed by the enclave that produced it. Anyone can check how an agent earned its limit.
        </p>
        {judged > 0 && (
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-[13px] text-mute">Trades judged</dt>
              <dd className="num text-[32px] font-semibold tracking-tight">{judged}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Won</dt>
              <dd className="num text-[32px] font-semibold tracking-tight">{won}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Result</dt>
              <dd className={`num text-[32px] font-semibold tracking-tight ${resultCents < 0 ? "text-stop" : "text-go-deep"}`}>{usd}</dd>
            </div>
          </dl>
        )}
        <Link href={`${href}#scorecard`} className="mt-8 inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-3 text-[15px] font-semibold hover:border-ink/40">
          Open the live agent&apos;s scorecard <ArrowRight size={16} />
        </Link>
      </Reveal>

      <Reveal delay={0.1}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-go-soft text-go-deep">
          <PowerOff size={22} />
        </span>
        <h2 className="mt-6 text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">Switch the AI off. You&apos;re still protected.</h2>
        <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ink-2">
          The AI only proposes trades. Judging them, moving the limit and freezing the agent all run as a contract on
          Reactive Network, triggered by the market itself. If the AI or this website goes offline, every trade it already
          made is still judged on time and the limit still follows the results.
        </p>
        <ul className="mt-8 space-y-3 text-[15px] text-ink">
          {["No server to keep running", "No one watching a screen", "No way for the AI to raise its own limit"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-go" />
              {t}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
