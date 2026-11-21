import { CycleView } from "@/components/cycle-view";
import { DemoCard } from "@/components/demo-card";
import { ButtonLink } from "@/components/ui";
import { readPrice } from "@/lib/server/account";
import { demoData } from "@/lib/server/demo";

export const revalidate = 30;

const steps = [
  {
    title: "You sign the rules once",
    body: "Pick a starting daily limit, the most it can ever grow to and the least it can be cut to. One transaction sets it all.",
  },
  {
    title: "The AI trades inside the limit",
    body: "Each decision comes from a model in a secure enclave that signs its answer. Your account checks that signature before any money moves.",
  },
  {
    title: "Every trade gets a verdict",
    body: "Ten minutes later, a contract on Reactive Network checks the trade against the market price. Good trades raise the limit. Bad ones cut it.",
  },
  {
    title: "A bad run stops everything",
    body: "Too many losses in a row, or too large a total loss, and the agent is frozen on every chain within seconds. Only you can restart it.",
  },
];

const control = [
  {
    title: "Big or unchecked trades wait for you",
    body: "Anything over today's limit, or any decision the enclave did not sign, sits in your approvals until you say yes or no.",
  },
  {
    title: "One button stops it everywhere",
    body: "Freeze the agent from any chain and it stops on all of them. Your funds stay in your account, and you can withdraw at any time.",
  },
  {
    title: "Nothing depends on a server",
    body: "The scoring runs as a contract on Reactive Network. It keeps judging trades and adjusting the limit even if the AI and this website go offline.",
  },
];

const faq = [
  {
    q: "Is this real money?",
    a: "Not yet. Greenlight runs on test networks with test dollars and test ether, but every price comes from Chainlink and every step is a real transaction you can check.",
  },
  {
    q: "What does the AI actually decide?",
    a: "Whether to buy, sell or wait, and how much, within what is left of today's limit. It explains each decision in plain words, and you can read every one on your dashboard.",
  },
  {
    q: "How does it earn a higher limit?",
    a: "By being right. After a run of winning trades the limit goes up by the step you chose, never above your highest. Each losing trade cuts it, never below your lowest.",
  },
  {
    q: "What if the AI is offline or wrong?",
    a: "If the secure model is unavailable, a backup model can still suggest trades, but those always wait for your approval. If it keeps being wrong, it freezes itself.",
  },
];

export default async function Home() {
  const [demo, price] = await Promise.all([demoData(), readPrice().catch(() => null)]);

  return (
    <>
      <section className="grid gap-10 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-go/25 bg-go-soft px-3 py-1 text-[12px] font-semibold text-go-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-go" /> Earned autonomy for AI trading
          </span>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] text-ink sm:text-[56px]">
            Let an AI trade for you, on a limit it has to earn.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises,
            lowers or freezes that limit based on how the agent&apos;s trades actually turn out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/app">Open your account</ButtonLink>
            <ButtonLink href={demo ? `/owner/${demo.view.owner}` : "/live"} tone="ghost">
              See the demo agent
            </ButtonLink>
          </div>
          {demo?.delivery && (
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6">
              <div>
                <dt className="text-[12px] text-mute">Change to every chain</dt>
                <dd className="num mt-1 text-2xl font-semibold">{demo.delivery.median}s</dd>
              </div>
              <div>
                <dt className="text-[12px] text-mute">Trades judged</dt>
                <dd className="num mt-1 text-2xl font-semibold">{demo.judged}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-mute">Servers needed to score</dt>
                <dd className="num mt-1 text-2xl font-semibold">0</dd>
              </div>
            </dl>
          )}
        </div>
        <DemoCard demo={demo} price={price} />
      </section>

      {demo?.cycle && (
        <section className="py-10">
          <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-go">Proof, not promises</p>
            <div className="mt-3">
              <CycleView cycle={demo.cycle} />
            </div>
          </div>
        </section>
      )}

      <section id="how" className="scroll-mt-20 py-14">
        <h2 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">How it works</h2>
        <p className="mt-2 max-w-2xl text-[16px] text-ink-2">Four steps. You do the first one; the rest happens on its own.</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-card p-6">
              <span className="num text-[13px] font-semibold text-go">0{i + 1}</span>
              <h3 className="mt-3 text-[17px] font-semibold leading-snug">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-14">
        <div className="grid gap-10 rounded-3xl bg-ink px-6 py-10 text-white sm:px-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">You stay in charge</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-white/70">
              The agent only ever gets the room its results have earned, and you can take it back at any moment.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {control.map((c) => (
              <div key={c.title}>
                <div className="h-1 w-8 rounded-full bg-go" />
                <h3 className="mt-4 text-[16px] font-semibold">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/70">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-10 py-14 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">Questions</h2>
          <p className="mt-3 text-[16px] text-ink-2">
            Built on Reactive Network, NEAR AI Cloud and Chainlink, on Base Sepolia and Unichain Sepolia.
          </p>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-card">
          {faq.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                {f.q}
                <span className="text-mute transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
