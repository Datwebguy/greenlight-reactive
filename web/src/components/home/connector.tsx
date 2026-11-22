/** A vertical line of light joining one section to the next, with a glow travelling down it. */
export function Connector({ label }: { label?: string }) {
  return (
    <div aria-hidden className="relative mx-auto flex h-28 w-px flex-col items-center">
      <div className="absolute inset-0 w-px bg-gradient-to-b from-transparent via-go/40 to-go/40" />
      <div
        className="absolute left-1/2 h-10 w-[3px] -translate-x-1/2 rounded-full"
        style={{
          background: "linear-gradient(180deg, transparent, var(--go), transparent)",
          filter: "blur(0.6px)",
          animation: "connector-fall 2.8s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        }}
      />
      <span className="absolute bottom-0 h-2.5 w-2.5 translate-y-1/2 rounded-full bg-go shadow-[0_0_14px_var(--glow)]" />
      {label && (
        <span className="absolute top-1/2 left-4 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tracking-[0.14em] text-mute uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
