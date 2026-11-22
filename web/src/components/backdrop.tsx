/**
 * The page background, fixed behind everything so every section sits on it:
 * a misty base, two drifting aurora fields, flowing lines of light, a soft haze and fine grain.
 * Colours come from the theme, so light and dark each get their own palette.
 */

const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Gentle curves across the page; each carries a travelling light.
const paths = [
  "M-100 220 C 300 80, 600 360, 900 210 S 1500 60, 1800 240",
  "M-100 420 C 250 300, 650 560, 1000 400 S 1500 300, 1800 460",
  "M-100 640 C 350 520, 700 760, 1050 600 S 1550 520, 1800 680",
  "M-100 120 C 400 260, 800 0, 1150 160 S 1600 280, 1800 120",
];

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* misty base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, var(--mist), transparent 60%), linear-gradient(180deg, transparent, var(--paper) 85%)",
        }}
      />

      {/* aurora, top */}
      <div
        className="aurora absolute -inset-x-[10%] -top-[25%] h-[85vh]"
        style={{
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 25%, #000 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 25%, #000 25%, transparent 75%)",
        }}
      />
      {/* aurora, bottom, drifting the other way */}
      <div
        className="aurora absolute -inset-x-[10%] -bottom-[30%] h-[70vh]"
        style={{
          animationDirection: "reverse",
          animationDuration: "95s",
          opacity: "calc(var(--aurora-opacity) * 0.7)",
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 75%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 75%, #000 20%, transparent 75%)",
        }}
      />

      {/* flowing lines of light */}
      <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 1700 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="flow-base" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--line-flow-a)" stopOpacity="0" />
            <stop offset="35%" stopColor="var(--line-flow-a)" stopOpacity="0.35" />
            <stop offset="65%" stopColor="var(--line-flow-b)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--line-flow-b)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flow-light" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--line-flow-a)" />
            <stop offset="100%" stopColor="var(--line-flow-b)" />
          </linearGradient>
          <filter id="flow-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {paths.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" stroke="url(#flow-base)" strokeWidth="1" />
            <path
              d={d}
              fill="none"
              stroke="var(--line-flow-a)"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="flow-line"
              filter="url(#flow-glow)"
              style={{ animationDelay: `${i * -2.3}s`, animationDuration: `${8 + i * 1.7}s` }}
            />
          </g>
        ))}
      </svg>

      {/* soft grid near the top, fading out */}
      <div
        className="absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, #000 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, #000 20%, transparent 70%)",
        }}
      />

      {/* grain, so the colour reads as material rather than flat */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay dark:opacity-[0.1]" style={{ backgroundImage: grain }} />
    </div>
  );
}
