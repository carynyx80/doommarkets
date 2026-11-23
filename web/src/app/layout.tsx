import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Doom Market — Bet on which tokens survive",
  description:
    "Privacy-first memecoin launchpad on BNB Chain. Every launch ships with a sealed prediction market and a creator bond. Bet on which tokens survive — without anyone seeing your bet.",
};

export const viewport: Viewport = { themeColor: "#07070A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="bg-ink font-sans text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
