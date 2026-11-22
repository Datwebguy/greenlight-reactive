/**
 * The page background, fixed behind everything so every section sits on it:
 * a misty base, drifting ribbons of soft light, streaks running along curved paths, a faint grid and fine grain.
 * Colours come from the theme, so light and dark each get their own palette.
 */

const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Broad, soft ribbons that drift slowly.
const ribbons = [
  { d: "M-200 260 C 200 60, 600 460, 1000 240 S 1700 40, 2000 280", w: 140, tone: "var(--ribbon-a)", dur: 26 },
  { d: "M-200 520 C 300 360, 700 700, 1100 480 S 1700 360, 2000 560", w: 180, tone: "var(--ribbon-b)", dur: 34 },
  { d: "M-200 820 C 250 660, 650 980, 1050 780 S 1650 640, 2000 860", w: 150, tone: "var(--ribbon-a)", dur: 30 },
];

// Thin paths with a light travelling along each.
const streaks = [
  "M-100 200 C 300 60, 600 360, 900 210 S 1500 60, 1900 240",
  "M-100 430 C 250 300, 650 560, 1000 400 S 1500 300, 1900 460",
  "M-100 660 C 350 520, 700 780, 1050 620 S 1550 520, 1900 700",
  "M-100 110 C 400 260, 800 0, 1150 160 S 1600 280, 1900 120",
  "M-100 900 C 300 760, 750 1000, 1100 860 S 1600 780, 1900 920",
];

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* misty base: a soft white haze from the top, settling into the page colour */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(110% 70% at 50% -10%, var(--mist), transparent 62%)" }}
      />

      {/* aurora fields */}
      <div
        className="aurora absolute -inset-x-[10%] -top-[25%] h-[85vh]"
        style={{
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 25%, #000 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 25%, #000 25%, transparent 75%)",
        }}
      />
      <div
        className="aurora absolute -inset-x-[10%] -bottom-[30%] h-[70vh]"
        style={{
          animationDirection: "reverse",
          animationDuration: "95s",
          opacity: "calc(var(--aurora-opacity) * 0.8)",
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 75%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 75%, #000 20%, transparent 75%)",
        }}
      />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1700 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="ribbon-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
          <filter id="streak-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        {/* drifting ribbons */}
        {ribbons.map((r, i) => (
          <path
            key={r.d}
            d={r.d}
            fill="none"
            stroke={r.tone}
            strokeWidth={r.w}
            strokeLinecap="round"
            filter="url(#ribbon-blur)"
            className="ribbon"
            style={{ animationDuration: `${r.dur}s`, animationDelay: `${i * -7}s` }}
          />
        ))}

        {/* fine lines with travelling light */}
        {streaks.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" stroke="var(--line-flow-a)" strokeOpacity="0.28" strokeWidth="1" />
            <path
              d={d}
              fill="none"
              stroke="var(--streak)"
              strokeWidth="2.6"
              strokeLinecap="round"
              className="flow-line"
              filter="url(#streak-glow)"
              style={{ animationDelay: `${i * -1.9}s`, animationDuration: `${7 + i * 1.3}s` }}
            />
          </g>
        ))}
      </svg>

      {/* faint grid near the top */}
      <div
        className="absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 45% at 50% 0%, #000 15%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 45% at 50% 0%, #000 15%, transparent 70%)",
        }}
      />

      {/* grain, so colour reads as material rather than flat */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay dark:opacity-[0.1]" style={{ backgroundImage: grain }} />
    </div>
  );
}
