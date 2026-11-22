/**
 * The page background, fixed behind everything.
 * Built to be cheap to draw: soft colour fields are plain radial gradients that only move (handled by the graphics
 * chip), the light streaks are thin lines without filters, and nothing is blurred or blended at run time.
 */

const fields = [
  { cls: "top-[-28%] left-[-18%] h-[80vh] w-[80vw]", color: "var(--field-a)", anim: "drift-a 38s ease-in-out infinite alternate" },
  { cls: "top-[-20%] right-[-22%] h-[75vh] w-[70vw]", color: "var(--field-b)", anim: "drift-b 46s ease-in-out infinite alternate" },
  { cls: "bottom-[-30%] left-[10%] h-[70vh] w-[80vw]", color: "var(--field-c)", anim: "drift-a 52s ease-in-out infinite alternate-reverse" },
];

const streaks = [
  "M-100 220 C 300 80, 600 380, 900 230 S 1500 80, 1900 260",
  "M-100 520 C 250 400, 650 660, 1000 500 S 1500 400, 1900 560",
  "M-100 820 C 350 700, 700 940, 1050 800 S 1550 720, 1900 860",
];

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* misty haze from the top */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(110% 70% at 50% -10%, var(--mist), transparent 62%)" }} />

      {/* soft colour fields that drift */}
      {fields.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-full ${f.cls}`}
          style={{
            background: `radial-gradient(closest-side, ${f.color}, transparent 72%)`,
            animation: f.anim,
            willChange: "transform",
          }}
        />
      ))}

      {/* thin lines with a light travelling along each */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1700 1000" preserveAspectRatio="xMidYMid slice">
        {streaks.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" stroke="var(--line-flow-a)" strokeOpacity="0.25" strokeWidth="1" />
            <path
              d={d}
              fill="none"
              stroke="var(--streak)"
              strokeWidth="2"
              strokeLinecap="round"
              className="flow-line"
              style={{ animationDelay: `${i * -2.4}s`, animationDuration: `${9 + i * 2}s` }}
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
    </div>
  );
}
