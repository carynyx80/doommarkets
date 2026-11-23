"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline, StatusPill, TokenAvatar } from "@/components/ui";
import { bnb, num, usd } from "@/lib/format";
import type { Stats, Token } from "@/lib/types";
import PageHeader from "./PageHeader";

const filters = ["All", "Open", "Ending soon", "Near target", "Resolved"] as const;
type F = (typeof filters)[number];

export default function Explore({ tokens, stats }: { tokens: Token[]; stats: Stats }) {
  const [f, setF] = useState<F>("All");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let l = tokens.filter((t) => `${t.name} ${t.symbol} ${t.creator} ${t.description}`.toLowerCase().includes(q.toLowerCase()));
    if (f === "Open") l = l.filter((t) => t.status === "open");
    if (f === "Ending soon") l = l.filter((t) => t.status === "open").sort((a, b) => a.endsAt - b.endsAt);
    if (f === "Near target") l = l.filter((t) => t.status === "open").sort((a, b) => b.marketCap / b.targetMcap - a.marketCap / a.targetMcap);
    if (f === "Resolved") l = l.filter((t) => t.status === "survived" || t.status === "doomed");
    return l;
  }, [tokens, f, q]);

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title={
          <>
            Live markets<span className="text-acid">.</span>
          </>
        }
        sub="Every token has a bond and a sealed survival market. Pick a side — nobody will know which."
        right={
          <Link href="/app/launch" className="btn-acid self-start sm:self-auto">
            + Launch token
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Tokens launched", num(stats.tokensLaunched)],
          ["Bonds locked", bnb(stats.bondsLockedBnb)],
          ["Sealed bets", num(stats.sealedBets)],
          ["Survival rate", `${Math.round(stats.survivalRate * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-[11px] text-white/45">{k}</p>
            <p className="h-display mt-1 text-xl sm:text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {filters.map((x) => (
            <button
              key={x}
              onClick={() => setF(x)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${f === x ? "text-ink" : "text-white/55 hover:text-white"}`}
            >
              {f === x && <motion.span layoutId="filter" className="absolute inset-0 rounded-full bg-acid" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{x}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens or creators…" className="input md:max-w-xs" />
      </div>

      <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((t, i) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
            >
              <MarketCard t={t} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-sm text-white/40">{tokens.length === 0 ? "No launches yet. Be the first to launch a token with a bond." : "No markets match."}</p>
          {tokens.length === 0 && (
            <a href="/app/launch" className="btn-acid mt-6 inline-flex">
              + Launch token
            </a>
          )}
        </div>
      )}
    </>
  );
}

export function MarketCard({ t }: { t: Token }) {
  const up = t.change24h >= 0;
  const progress = Math.min(1, t.marketCap / t.targetMcap);
  const daysLeft = Math.max(0, Math.ceil((t.endsAt - Date.UTC(2026, 10, 23, 12)) / 86_400_000));
  return (
    <Link href={`/app/market/${t.id}`} className="card group block p-5 hover:-translate-y-0.5 hover:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar token={t} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{t.name}</p>
            <p className="truncate text-xs text-white/45">
              ${t.symbol} · by <span className="text-white/70">{t.creator}</span>
            </p>
          </div>
        </div>
        <StatusPill status={t.status} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="h-display text-2xl">{usd(t.marketCap)}</p>
          <p className={`font-mono text-xs ${up ? "text-acid" : "text-doom"}`}>
            {up ? "▲" : "▼"} {Math.abs(t.change24h)}% 24h
          </p>
        </div>
        <Sparkline data={t.curve} up={up} className="h-10 w-28" />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-[11px] text-white/45">
          <span>Survive above {usd(t.targetMcap)}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={`h-full rounded-full ${progress >= 1 ? "bg-acid" : "bg-gradient-to-r from-doom to-acid"}`} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-[11px]">
        <div>
          <p className="text-white/40">Bond</p>
          <p className="mt-0.5 font-medium">{t.bondBnb} BNB</p>
        </div>
        <div>
          <p className="text-white/40">Sealed bets</p>
          <p className="mt-0.5 flex items-center gap-1 font-medium">
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-acid" fill="none" stroke="currentColor" strokeWidth="2.4">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {num(t.sealedBets)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/40">{t.status === "open" ? "Closes" : "Status"}</p>
          <p className="mt-0.5 font-medium">{t.status === "open" ? `${daysLeft}d` : t.status}</p>
        </div>
      </div>
    </Link>
  );
}
