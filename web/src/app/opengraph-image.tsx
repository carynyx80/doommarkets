import { ImageResponse } from "next/og";

export const alt = "Doom Market — Bet on which tokens survive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#07070A", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 22, background: "#F4F4F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="84" height="84" viewBox="0 0 64 64">
              <path fill="#000" fillRule="evenodd" d="M16 12h14a20 20 0 0 1 0 40H16Z M29 22a3 3 0 0 0-3 3v14a3 3 0 0 0 6 0V25a3 3 0 0 0-3-3Z" />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>DOOM MARKET</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>Bet on which tokens</div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: "#FF2E4D" }}>survive.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(255,255,255,0.55)" }}>Privacy-first memecoin launchpad on BNB Chain · doomarket.xyz</div>
        </div>
      </div>
    ),
    size,
  );
}
