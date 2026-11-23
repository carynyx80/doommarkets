"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { ToastProvider } from "./Toast";

const theme = darkTheme({
  accentColor: "#C6FF3D",
  accentColorForeground: "#07070A",
  borderRadius: "large",
  overlayBlur: "small",
  fontStack: "system",
});
theme.colors.modalBackground = "#0B0B10";
theme.colors.modalBorder = "rgba(255,255,255,0.08)";
theme.colors.connectButtonBackground = "#111118";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "Doom Market" }}>
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
