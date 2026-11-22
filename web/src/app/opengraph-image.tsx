import { ImageResponse } from "next/og";

export const alt = "Greenlight: let an AI trade for you, on a limit it has to earn.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f7f4",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 52, background: "#138a4a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 20, background: "#ffffff" }} />
          </div>
          <div style={{ fontSize: 38, fontWeight: 700, color: "#10151c" }}>Greenlight</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#10151c", lineHeight: 1.05, letterSpacing: -2 }}>
            Let an AI trade for you, on a limit it has to earn.
          </div>
          <div style={{ fontSize: 30, color: "#3d4652", lineHeight: 1.35 }}>
            Sign the rules once. Every trade is judged on Reactive Network, and the limit rises, falls or freezes on every chain.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {[0.3, 0.55, 0.42, 0.7].map((w, i) => (
            <div key={i} style={{ height: 14, width: 220, borderRadius: 14, background: "#e6f4ec", display: "flex" }}>
              <div style={{ height: 14, width: 220 * w, borderRadius: 14, background: "#138a4a" }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
