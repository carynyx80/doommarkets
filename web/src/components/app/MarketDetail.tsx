"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { StatusPill, TokenAvatar } from "@/components/ui";
import { tokenUrl } from "@/lib/contracts";
import { bnb, countdown, num, short, usd } from "@/lib/format";
import type { Token } from "@/lib/types";
import BetPanel from "./BetPanel";
import TradePanel from "./TradePanel";

const normUrl = (v: string, base?: string) => {
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (base && t.startsWith("@")) return `${base}${t.slice(1)}`;
  if (base && !t.includes(".") && !t.includes("/")) return `${base}${t}`;
  return `https://${t}`;
};

const icons = {
  website: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M9.78 15.2 9.6 19.3c.4 0 .57-.17.78-.37l1.87-1.79 3.88 2.84c.71.39 1.22.19 1.41-.66l2.55-11.97c.26-1.05-.39-1.5-1.09-1.25L2.98 10.3c-1.02.41-1.01.98-.18 1.23l3.83 1.2 8.9-5.61c.42-.26.8-.12.49.16" />
    </svg>
  ),
};

function Socials({ token }: { token: Token }) {
  const links = [
    ["website", normUrl(token.website)],
    ["twitter", normUrl(token.twitter, "https://x.com/")],
    ["telegram", normUrl(token.telegram, "https://t.me/")],
  ] as const;
  const shown = links.filter(([, u]) => u);
  if (!shown.length) return null;
  return (
    <div className="flex gap-1.5">
      {shown.map(([k, u]) => (
        <a
          key={k}
          href={u}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={k}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-acid/40 hover:text-acid"
        >
          {icons[k]}
        </a>
      ))}
    </div>
  );
}

function AddressChip({ address }: { address: string }) {
  const toast = useToast();
  const valid = /^0x[0-9a-fA-F]{40}$/.test(address);
  if (!valid) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-0.5 pl-2.5 pr-1 font-mono text-[11px] text-white/60">
      CA {short(address)}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(address).then(
            () => toast("Address copied", address, "success"),
            () => toast("Copy failed", undefined, "error"),
          );
        }}
        className="rounded-full px-1.5 py-0.5 hover:bg-white/10 hover:text-white"
        aria-label="Copy token address"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
      <a href={tokenUrl(address)} target="_blank" rel="noreferrer" className="rounded-full px-1.5 py-0.5 hover:bg-white/10 hover:text-acid" aria-label="View on BscScan">
        ↗
      </a>
    </span>
  );
}

function CurveChart({ token }: { token: Token }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = token.curve;
  const W = 600;
  const H = 240;
  const max = Math.max(...data) * 1.08;
  const min = Math.min(...data) * 0.92;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const path = data.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const last = data[data.length - 1];
  // target line, scaled relative to current mcap
  const targetV = last * (token.targetMcap / token.marketCap);
  const ty = y(Math.min(max, Math.max(min, targetV)));
  const up = data[data.length - 1] >= data[0];
  const color = up ? "#C6FF3D" : "#FF3B30";
  const idx = hover ?? data.length - 1;
  const shownMcap = token.marketCap * (data[idx] / last);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-white/45">Bonding curve · market cap</p>
          <p className="h-display mt-1 text-3xl">{usd(shownMcap)}</p>
        </div>
        <div className="flex gap-1 text-[11px]">
          {["1H", "1D", "1W", "ALL"].map((t, i) => (
            <span key={t} className={`rounded-lg px-2.5 py-1 ${i === 3 ? "bg-white/10 text-white" : "text-white/40"}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="relative mt-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-56 w-full sm:h-64"
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)));
          }}
        >
          <defs>
            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.05)" />
          ))}
          <line x1="0" x2={W} y1={ty} y2={ty} stroke="#C6FF3D" strokeOpacity="0.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
          <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#fill)" />
          <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1={x(idx)} x2={x(idx)} y1="0" y2={H} stroke="rgba(255,255,255,0.15)" vectorEffect="non-scaling-stroke" />
          <circle cx={x(idx)} cy={y(data[idx])} r="4" fill={color} />
        </svg>
        <span className="absolute right-0 rounded-md bg-acid/15 px-2 py-0.5 font-mono text-[10px] text-acid" style={{ top: `calc(${(ty / H) * 100}% - 22px)` }}>
          target {usd(token.targetMcap)}
        </span>
      </div>
    </div>
  );
}

export default function MarketDetail({ token }: { token: Token }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // If mock end time is in the past relative to the real clock, roll it forward so the demo countdown stays alive.
  const endsAt = useMemo(() => {
    if (token.status !== "open" || !now) return token.endsAt;
    let e = token.endsAt;
    while (e < now) e += token.durationDays * 86_400_000;
    return e;
  }, [token, now]);
  const progress = Math.min(1, token.marketCap / token.targetMcap);

  return (
    <>
      <Link href="/app" className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white">
        ← All markets
      </Link>
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <TokenAvatar token={token} className="h-20 w-20 rounded-3xl text-4xl sm:h-24 sm:w-24" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h-display text-3xl sm:text-4xl">{token.name}</h1>
              <StatusPill status={token.status} />
            </div>
            <p className="mt-1 text-sm text-white/45">
              ${token.symbol} · by <Link href="/app/creators" className="text-white/75 hover:text-acid">{token.creator}</Link>
            </p>
            {token.description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">{token.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AddressChip address={token.address} />
              <Socials token={token} />
            </div>
          </div>
        </div>
        <div className="card flex shrink-0 items-center gap-4 px-5 py-4">
          <div>
            <p className="text-[11px] text-white/45">{token.status === "open" ? "Bets close in" : "Market"}</p>
            <p className="h-display font-mono text-2xl tabular-nums" suppressHydrationWarning>
              {token.status === "open" ? (now ? countdown(endsAt - now) : "—") : token.status === "reveal" ? "Reveal phase" : "Resolved"}
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6 p-5 sm:p-6">
        <p className="text-[11px] text-white/45">The question</p>
        <p className="h-display mt-1 text-xl leading-snug sm:text-2xl">
          Will ${token.symbol} be above <span className="text-acid">{usd(token.targetMcap)}</span> market cap in {token.durationDays} days?
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={`h-full rounded-full ${progress >= 1 ? "bg-acid" : "bg-gradient-to-r from-doom to-acid"}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-white/45">
          <span>Now {usd(token.marketCap)}</span>
          <span>{Math.round(progress * 100)}% of target</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <CurveChart token={token} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Creator bond", bnb(token.bondBnb), "text-doom"],
              ["Sealed pool", bnb(token.poolBnb), ""],
              ["Sealed bets", num(token.sealedBets), ""],
              ["Holders", num(token.holders), ""],
            ].map(([k, v, c]) => (
              <div key={k} className="card p-4">
                <p className="text-[11px] text-white/45">{k}</p>
                <p className={`h-display mt-1 text-lg ${c}`}>{v}</p>
              </div>
            ))}
          </div>
          <div className="card p-5 sm:p-6">
            <p className="font-medium">Position split</p>
            <p className="mt-1 text-xs text-white/45">Hidden until the market closes. That’s the point.</p>
            <div className="mt-4 flex h-10 overflow-hidden rounded-xl border border-white/[0.07]">
              <div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.05)_0_8px,transparent_8px_16px)] font-mono text-xs text-white/40">
                ██████ YES ?? · NO ?? ██████
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <TradePanel token={token} />
          <BetPanel token={token} />
        </div>
      </div>
    </>
  );
}
