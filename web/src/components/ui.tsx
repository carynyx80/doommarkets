"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Token } from "@/lib/types";
import { usd } from "@/lib/format";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group flex items-center gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F4F4F2] transition-transform duration-300 group-hover:-rotate-6">
        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
          <path fill="#000" fillRule="evenodd" d="M16 12h14a20 20 0 0 1 0 40H16Z M29 22a3 3 0 0 0-3 3v14a3 3 0 0 0 6 0V25a3 3 0 0 0-3-3Z" />
        </svg>
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

/** Rounded-square token image with emoji fallback (missing or broken image). */
export function TokenAvatar({
  token,
  className = "h-11 w-11 rounded-2xl text-2xl",
}: {
  token: Pick<Token, "emoji" | "symbol"> & { image?: string | null };
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = !!token.image && !broken;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-white/10 bg-white/[0.04] ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image!} alt={token.symbol} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden>{token.emoji || "💀"}</span>
      )}
    </span>
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
      <polyline points={pts} fill="none" stroke={up ? "#FF2E4D" : "#FF8A1F"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
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
              <TokenAvatar token={t} className="h-8 w-8 rounded-lg text-xl" />
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
