import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border-t border-line ${className}`}>{children}</section>;
}

export function CardHead({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 pt-6 pb-2">
      <div>
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[14px] text-mute">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

type Tone = "go" | "wait" | "stop" | "info" | "mute";
const tones: Record<Tone, string> = {
  go: "bg-go-soft text-go-deep",
  wait: "bg-wait-soft text-wait",
  stop: "bg-stop-soft text-stop",
  info: "bg-info-soft text-info",
  mute: "bg-paper text-ink-2 border border-line",
};

export function Badge({ tone = "mute", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-wide text-mute">{label}</div>
      <div className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-mute">{sub}</div>}
    </div>
  );
}

export function TxLink({ href, children = "View" }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-info hover:underline">
      {children} ↗
    </a>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const buttonTones = {
  primary: "bg-go text-white hover:bg-go-deep dark:text-[#052e16]",
  dark: "bg-ink text-paper hover:opacity-90",
  ghost: "border border-line-2 text-ink hover:border-ink/40",
  danger: "bg-stop text-white hover:opacity-90",
};

export function Button({
  tone = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof buttonTones }) {
  return <button className={`${buttonBase} ${buttonTones[tone]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  tone = "primary",
  children,
}: {
  href: string;
  tone?: keyof typeof buttonTones;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${buttonBase} ${buttonTones[tone]}`}>
      {children}
    </Link>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-go">
        <span className="h-2.5 w-2.5 rounded-full bg-white dark:bg-[#052e16]" />
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>Greenlight</span>
    </span>
  );
}
