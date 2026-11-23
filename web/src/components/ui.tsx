"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Token } from "@/lib/types";
import { usd } from "@/lib/format";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-acid text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 19V5h6a7 7 0 0 1 0 14H5Z" />
          <path d="M9 12h3" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-doom" />
      </span>
      <span className="font-display text-[15px] font-bold tracking-[-0.02em]">DOOM MARKET</span>
    </Link>
  );
}

export function Reveal({ children, delay = 0, y = 24, ...rest }: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Sparkline({ data, up, className = "" }: { data: number[]; up: boolean; className?: string }) {
  const w = 100;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke={up ? "#C6FF3D" : "#FF3B30"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatusPill({ status }: { status: Token["status"] }) {
  const map = {
    open: ["Sealed · Open", "text-acid border-acid/30 bg-acid/10"],
    reveal: ["Reveal phase", "text-amber-300 border-amber-300/30 bg-amber-300/10"],
    survived: ["Survived", "text-acid border-acid/30 bg-acid/10"],
    doomed: ["Doomed", "text-doom border-doom/30 bg-doom/10"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

export function Marquee({ tokens }: { tokens: Token[] }) {
  const row = [...tokens, ...tokens];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
        {row.map((t, i) => {
          const up = t.change24h >= 0;
          return (
            <Link
              key={`${t.id}-${i}`}
              href={`/app/market/${t.id}`}
              className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 transition hover:border-white/20"
            >
              <span className="text-xl">{t.emoji}</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">${t.symbol}</p>
                <p className="text-[11px] text-white/45">{usd(t.marketCap)} mcap</p>
              </div>
              <Sparkline data={t.curve.slice(-20)} up={up} className="h-6 w-16" />
              <span className={`font-mono text-xs ${up ? "text-acid" : "text-doom"}`}>
                {up ? "+" : ""}
                {t.change24h}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
