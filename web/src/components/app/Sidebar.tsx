"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { X_HANDLE, X_URL } from "@/lib/site";
import { Logo } from "@/components/ui";

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const NAV: { href: string; label: string; icon: ReactNode; desc: string }[] = [
  { href: "/app", label: "Explore", desc: "Live markets", icon: <I d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z" /> },
  { href: "/app/launch", label: "Launch", desc: "Create a token", icon: <I d="M12 15c-3-3-3-8 0-12 3 4 3 9 0 12Zm0 0v6m-4-4-2 2m10-2 2 2M9 9H5l2 4m8-4h4l-2 4" /> },
  { href: "/app/portfolio", label: "Portfolio", desc: "Sealed bets", icon: <I d="M3 7h18v13H3zM8 7V4h8v3M3 12h18" /> },
  { href: "/app/creators", label: "Creators", desc: "Anon reputation", icon: <I d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" /> },
  { href: "/app/privacy", label: "Privacy", desc: "Sealed bets, view keys", icon: <I d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-2 9 2 2 4-4" /> },
  { href: "/app/docs", label: "Docs", desc: "Protocol docs", icon: <I d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" /> },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/app" ? path === "/app" || path.startsWith("/app/market") : path.startsWith(href));
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const on = active(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              on ? "text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {on && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.06]"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className={`relative ${on ? "text-acid" : ""}`}>{n.icon}</span>
            <span className="relative font-medium">{n.label}</span>
            {n.label === "Explore" && (
              <span className="relative ml-auto flex items-center gap-1 font-mono text-[10px] text-acid/80">
                <span className="h-1.5 w-1.5 rounded-full bg-acid" /> LIVE
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Wallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        if (!connected)
          return (
            <button onClick={openConnectModal} className="btn-acid w-full !py-3" aria-hidden={!ready} style={{ opacity: ready ? 1 : 0.6 }}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3zM3 7V5a2 2 0 0 1 2-2h11v4M16 13.5h.01" strokeLinecap="round" />
              </svg>
              Connect Wallet
            </button>
          );
        if (chain.unsupported)
          return (
            <button onClick={openChainModal} className="w-full rounded-full bg-doom px-4 py-3 text-sm font-semibold text-white">
              Wrong network
            </button>
          );
        return (
          <div className="flex flex-col gap-2">
            <button onClick={openChainModal} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:border-white/20">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F0B90B]" />
                {chain.name}
              </span>
              <span className="text-white/30">switch</span>
            </button>
            <button onClick={openAccountModal} className="flex items-center gap-3 rounded-xl border border-acid/25 bg-acid/[0.07] px-3 py-2.5 text-left transition hover:border-acid/50">
              <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-acid to-rose-900" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{account.displayName}</span>
                <span className="block truncate text-[11px] text-white/45">{account.displayBalance ?? "—"}</span>
              </span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-6 pt-5">
        <Logo />
      </div>
      <div className="px-3">
        <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">Menu</p>
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="mx-3 mt-6 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-acid/[0.08] to-transparent p-4">
        <p className="text-xs font-medium">Your bets are sealed</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">Positions are hidden until the market closes. Back up your salts.</p>
      </div>
      <div className="mt-auto border-t border-white/[0.06] p-3">
        <a href={X_URL} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" /></svg>
          <span>Follow @{X_HANDLE}</span>
        </a>
        <Wallet />
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed left-1/3 top-[-20%] h-[480px] w-[640px] max-w-[100vw] rounded-full bg-acid/[0.07] blur-[140px]" />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[0.06] bg-ink-900/80 backdrop-blur-xl lg:block">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-ink/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] border-r border-white/[0.08] bg-ink-900 lg:hidden"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/5"
              >
                ✕
              </button>
              <SidebarInner onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="relative lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
