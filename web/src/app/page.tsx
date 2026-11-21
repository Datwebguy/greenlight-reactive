import { LivePanel } from "@/components/live-panel";
import { ButtonLink, Card } from "@/components/ui";

export const revalidate = 30;

const steps = [
  {
    n: "1",
    title: "Sign your rules once",
    body: "Choose the agent's starting daily limit, the highest and lowest it may ever reach, how long to wait before a trade is judged, and how far the price may slip. One transaction, and you can change them later.",
  },
  {
    n: "2",
    title: "The agent trades inside the limit",
    body: "Its decisions come from a model running in a secure enclave on NEAR AI Cloud, which signs every answer. Your account checks that signature before any money moves. Anything unsigned, or bigger than the limit, waits for your approval.",
  },
  {
    n: "3",
    title: "Every trade gets a verdict",
    body: "Once the judging window has passed, a contract on Reactive Network compares the trade with the live Chainlink price. A run of good trades raises the limit, up to your highest. Each bad one cuts it, down to your lowest.",
  },
  {
    n: "4",
    title: "A bad streak stops everything",
    body: "After too many losses in a row, or too large a total loss, the agent is frozen on every chain within seconds. You can also freeze it yourself from any chain. Only you can unfreeze it.",
  },
];

const trust = [
  {
    title: "No server decides your limit",
    body: "The scoring runs as a contract on Reactive Network. It reacts to trades and price updates by itself, so it keeps working even when the AI and this website are offline.",
  },
  {
    title: "Every AI decision is checked",
    body: "The model's answer is signed inside the enclave. Your account rebuilds the signed message on-chain and only acts on it if the signature, the model and the exact order all match.",
  },
  {
    title: "You can always stop it",
    body: "Press freeze on any chain and the agent stops on all of them. Withdraw your funds whenever you like. Greenlight never holds your keys.",
  },
];

const stack = [
  { name: "Reactive Network", what: "Scores trades and moves the limit, across chains" },
  { name: "NEAR AI Cloud", what: "Runs the model in a secure enclave and signs its answers" },
  { name: "Chainlink", what: "ETH/USD price for fills and for judging trades" },
  { name: "Base Sepolia · Unichain Sepolia", what: "Where the accounts and trades live" },
];

export default function Home() {
  return (
    <>
      <section className="grid gap-10 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-go">Earned autonomy for AI trading</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Let an AI trade for you, on a limit it has to earn.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Greenlight lets an AI agent trade with your money, within a limit you sign once, and automatically raises,
            lowers or freezes that limit based on how the agent&apos;s trades actually turn out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/app">Open your account</ButtonLink>
            <ButtonLink href="/live" tone="ghost">
              Watch a live account
            </ButtonLink>
          </div>
        </div>
        <LivePanel />
      </section>

      <section id="how" className="scroll-mt-20 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <Card key={s.n} className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-go-soft text-[13px] font-semibold text-go-deep">
                  {s.n}
                </span>
                <h3 className="text-[16px] font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Why you can trust it</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {trust.map((t) => (
            <div key={t.title} className="rounded-2xl border border-line bg-card p-6">
              <h3 className="text-[16px] font-semibold">{t.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <h2 className="text-2xl font-semibold tracking-tight">What it runs on</h2>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {stack.map((s) => (
            <div key={s.name} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold">{s.name}</span>
              <span className="text-[15px] text-ink-2">{s.what}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
