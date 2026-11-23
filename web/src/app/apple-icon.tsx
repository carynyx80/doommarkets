import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F4F2" }}>
        <svg width="150" height="150" viewBox="0 0 64 64">
          <path fill="#000" fillRule="evenodd" d="M16 12h14a20 20 0 0 1 0 40H16Z M29 22a3 3 0 0 0-3 3v14a3 3 0 0 0 6 0V25a3 3 0 0 0-3-3Z" />
        </svg>
      </div>
    ),
    size,
  );
}
