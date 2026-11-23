"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo, Marquee, Reveal } from "@/components/ui";
import { TREASURY_ADDRESS } from "@/lib/contracts";
import { bnb, num, short } from "@/lib/format";
import { X_HANDLE, X_URL } from "@/lib/site";
import type { Stats, Token } from "@/lib/types";

const Arrow = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:pt-4">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 pl-4 transition-all duration-300 ${
          scrolled ? "glass shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)]" : "border border-transparent"
        }`}
      >
        <Logo />
        <div className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#privacy" className="transition hover:text-white">Privacy</a>
          <a href="#stats" className="transition hover:text-white">Stats</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <a href={X_URL} target="_blank" rel="noreferrer" aria-label="Doom Market on X" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/25 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" /></svg>
          </a>
          <Link href="/app" className="btn-acid !px-4 !py-2">
            Open App <Arrow />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero({ tokens }: { tokens: Token[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const words = ["Bet", "on", "which", "tokens", "survive."];
  return (
    <section ref={ref} className="relative overflow-hidden pb-16 pt-32 sm:pt-40">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full bg-acid/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[30%] h-[320px] w-[420px] rounded-full bg-doom/15 blur-[120px]" />
      <motion.div style={{ y, opacity: op }} className="relative mx-auto max-w-6xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/70"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-acid" />
          </span>
          Live on BNB Chain · sealed bets enabled
        </motion.div>
        <h1 className="h-display mx-auto mt-7 max-w-5xl text-[44px] leading-[0.92] sm:text-7xl md:text-8xl lg:text-[112px]">
          {words.map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`mr-[0.22em] inline-block ${w === "survive." ? "text-acid" : "text-gradient"}`}
            >
              {w}
            </motion.span>
          ))}
          <motion.span
            initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="block text-white/35"
          >
            Without anyone seeing your bet.
          </motion.span>
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="mx-auto mt-7 max-w-xl text-base text-white/55 sm:text-lg"
        >
          The privacy-first memecoin launchpad. Every token ships with a creator bond and a sealed prediction market. If it dies, the
          bond pays the believers in doom.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/app" className="btn-acid !px-8 !py-4 !text-base">
            Open App <Arrow />
          </Link>
          <Link href="/app/launch" className="btn-ghost !px-7 !py-4 !text-base">
            Launch a token
          </Link>
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }} className="relative mt-20">
        <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">Live launches</p>
        <Marquee tokens={tokens} />
      </motion.div>
    </section>
  );
}

const steps = [
  {
    n: "01",
    title: "Launch with a bond",
    body: "Creators lock BNB as a bond and set a target: “above $X market cap in N days.” Skin in the game, from block one.",
    accent: "acid",
  },
  {
    n: "02",
    title: "Sealed bets",
    body: "Anyone bets YES (survives) or NO (doom). Bets are commit-reveal encrypted — no creator, whale or bot can see positions until close.",
    accent: "white",
  },
  {
    n: "03",
    title: "Survive or get paid",
    body: "Hit the target and the creator earns reputation plus their bond back. Miss it and the bond is split between holders and NO bettors.",
    accent: "doom",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h2 className="h-display mt-4 text-4xl leading-[0.95] sm:text-6xl">
          Three steps. <span className="text-white/35">Zero rugs left unpunished.</span>
        </h2>
      </Reveal>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="card group relative h-full overflow-hidden p-7">
              <div
                className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${
                  s.accent === "acid" ? "bg-acid/25" : s.accent === "doom" ? "bg-doom/25" : "bg-white/15"
                } opacity-40`}
              />
              <span className="font-mono text-xs text-white/35">{s.n}</span>
              <h3 className="h-display mt-10 text-2xl sm:text-3xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{s.body}</p>
              {i < 2 && <div className="absolute right-6 top-7 hidden text-white/25 md:block"><Arrow /></div>}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function SealedVisual() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1400);
    return () => clearInterval(t);
  }, []);
  const hex = "0123456789abcdef";
  const line = (seed: number) =>
    Array.from({ length: 24 }, (_, i) => hex[(seed * 31 + i * 17 + tick * 7) % 16]).join("");
  return (
    <div className="mt-6 space-y-2 font-mono text-[11px] text-white/40">
      {[1, 2, 3].map((k) => (
        <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2">
          <span className="truncate">0x{line(k)}</span>
          <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-white/50">sealed</span>
        </div>
      ))}
    </div>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
      <div className="pointer-events-none absolute left-0 top-1/3 h-72 w-72 rounded-full bg-acid/10 blur-[120px]" />
      <Reveal className="max-w-2xl">
        <p className="eyebrow">Privacy by default</p>
        <h2 className="h-display mt-4 text-4xl leading-[0.95] sm:text-6xl">
          Your bet is nobody’s <span className="text-acid">business.</span>
        </h2>
        <p className="mt-5 max-w-lg text-white/55">
          Public order books get front-run. Visible whales move markets. Doom Market seals everything until the market closes.
        </p>
      </Reveal>
      <div className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-4">
          <div className="card relative h-full overflow-hidden p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Commit · Reveal</p>
            <h3 className="h-display mt-3 text-3xl">Sealed bets</h3>
            <p className="mt-2 max-w-md text-sm text-white/55">
              You submit keccak256(side, salt, you). The chain sees a hash and a deposit — never your side. Reveal after close to claim.
            </p>
            <SealedVisual />
          </div>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.1}>
          <div className="card relative h-full overflow-hidden p-7">
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-acid/20 blur-3xl" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Stealth</p>
            <h3 className="h-display mt-3 text-3xl">Stealth wallets</h3>
            <p className="mt-2 text-sm text-white/55">Bet from one-time stealth addresses so positions can’t be linked to your main wallet.</p>
          </div>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.05}>
          <div className="card h-full p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Reputation</p>
            <h3 className="h-display mt-3 text-3xl">Anonymous reputation</h3>
            <p className="mt-2 text-sm text-white/55">
              Creators build a track record of tokens that survived — tied to a pseudonym, not a face. Trust without doxxing.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {["ghostwriter", "cryptkeeper", "pondlord"].map((h, i) => (
                <div key={h} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-xs">
                  <span className={`h-5 w-5 rounded-full ${i === 0 ? "bg-acid" : i === 1 ? "bg-white/60" : "bg-white/25"}`} />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.15}>
          <div className="card h-full p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Compliance</p>
            <h3 className="h-display mt-3 text-3xl">View keys</h3>
            <p className="mt-2 text-sm text-white/55">
              Private to the public, provable to who you choose. Share a scoped view key with an auditor or tax tool — and nobody else.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-acid/25 bg-acid/10 px-3 py-2 font-mono text-xs text-acid">
              vk_7f3a…e91c · read-only
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatsStrip({ stats }: { stats: Stats }) {
  const items = [
    ["Tokens launched", num(stats.tokensLaunched)],
    ["Bonds locked", bnb(stats.bondsLockedBnb)],
    ["Sealed bets", num(stats.sealedBets)],
    ["Survival rate", `${Math.round(stats.survivalRate * 100)}%`],
    ["Paid to doomers", bnb(stats.paidOutBnb)],
  ];
  return (
    <section id="stats" className="border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 md:grid-cols-5">
        {items.map(([k, v], i) => (
          <Reveal key={k} delay={i * 0.05} className={`py-10 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="h-display text-3xl sm:text-4xl">{v}</p>
            <p className="mt-1 text-xs text-white/45">{k}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const faqs = [
  ["What happens if a token dies?", "If the token is below its target market cap when the market closes, the creator’s BNB bond is distributed to token holders and NO bettors, pro-rata."],
  ["How are bets sealed?", "You commit a hash of (side, random salt, your address) with your deposit. Nobody can tell YES from NO. After close you reveal the salt to prove your side and claim."],
  ["What if I lose my salt?", "Your salt is stored locally in your browser. Back it up — without it you can’t reveal, and an unrevealed bet forfeits. We show a warning every time you bet."],
  ["Can creators see who bet against them?", "No. Positions stay sealed until close, and with stealth wallets they can’t be linked to your main address even after."],
  ["Is this compliant?", "View keys let you selectively disclose your activity to an auditor, exchange or tax tool, without making it public."],
  ["What are the fees?", "A 0.1% flat fee on launches, trades and bets: 0.1% of the creator bond at launch, 0.1% of every buy and sell, and 0.1% of every sealed bet. Fees go to the company wallet 0x0DbF…57e0 and are shown before you sign. Creators also earn a 0.1% creator fee on every buy and sell of their token."],
  ["Which wallets work?", "MetaMask, Binance Wallet, Trust, OKX, Bitget, SafePal, TokenPocket, Rabby, Coinbase Wallet and anything WalletConnect-compatible on BNB Chain."],
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:py-32 md:grid-cols-[1fr_1.4fr]">
      <Reveal>
        <p className="eyebrow">FAQ</p>
        <h2 className="h-display mt-4 text-4xl leading-[0.95] sm:text-6xl">Questions, answered.</h2>
      </Reveal>
      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {faqs.map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
              <span className="text-base font-medium sm:text-lg">{q}</span>
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-white/60">
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="pb-5 pr-10 text-sm leading-relaxed text-white/55">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-6 py-16 text-center sm:py-24">
          <div className="pointer-events-none absolute left-1/2 top-full h-80 w-[700px] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/30 blur-[120px]" />
          <h2 className="h-display relative mx-auto max-w-3xl text-4xl leading-[0.95] sm:text-7xl">
            Survive, or <span className="text-doom">get paid.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-white/55">Pick a side. Seal it. Let the chart decide.</p>
          <Link href="/app" className="btn-acid relative mt-9 !px-8 !py-4 !text-base">
            Open App <Arrow />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-white/45">Bet on which tokens survive. Without anyone seeing your bet.</p>
          <p className="mt-4 break-all font-mono text-[11px] text-white/30">
            Treasury: <span title={TREASURY_ADDRESS}>{short(TREASURY_ADDRESS)}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-4">
          <div className="space-y-3">
            <p className="text-white/35">Product</p>
            <Link href="/app" className="block text-white/70 hover:text-white">Explore</Link>
            <Link href="/app/launch" className="block text-white/70 hover:text-white">Launch</Link>
            <Link href="/app/creators" className="block text-white/70 hover:text-white">Creators</Link>
          </div>
          <div className="space-y-3">
            <p className="text-white/35">Learn</p>
            <Link href="/app/privacy" className="block text-white/70 hover:text-white">Privacy</Link>
            <Link href="/app/docs" className="block text-white/70 hover:text-white">Docs</Link>
            <a href="#faq" className="block text-white/70 hover:text-white">FAQ</a>
          </div>
          <div className="space-y-3">
            <p className="text-white/35">Network</p>
            <span className="block text-white/70">BNB Chain</span>
            <span className="block text-white/70">BSC Testnet</span>
          </div>
          <div className="space-y-3">
            <p className="text-white/35">Community</p>
            <a href={X_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/70 hover:text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" /></svg> @{X_HANDLE}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] py-6 text-center text-xs text-white/30">© 2026 Doom Market. Not financial advice. Memecoins can go to zero.</div>
    </footer>
  );
}

export default function Home({ tokens, stats }: { tokens: Token[]; stats: Stats }) {
  return (
    <main className="grain relative overflow-x-hidden">
      <Nav />
      <Hero tokens={tokens} />
      <HowItWorks />
      <StatsStrip stats={stats} />
      <Privacy />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
