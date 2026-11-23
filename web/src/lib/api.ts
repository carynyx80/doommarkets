import { mockCreators, mockStats, mockTokens } from "./mock";
import type { Creator, MarketStatus, Stats, Token } from "./types";
import { BNB_USD } from "./contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const EMOJI = ["🐸", "💀", "🕯️", "🦍", "🔥", "🧪", "🐶", "🪦", "🚀", "🧻", "👁️", "⚰️"];

async function fetchJson(path: string): Promise<any> {
  if (!API_URL) throw new Error("no api");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Map a backend token (BNB-denominated) into the UI Token shape (USD). */
function toToken(b: any): Token {
  const id = String(b.id);
  const status: MarketStatus =
    b.phase === "settled" ? (b.survived ? "survived" : "doomed") : b.phase === "reveal" ? "reveal" : "open";
  const series: number[] = Array.isArray(b.priceSeries) && b.priceSeries.length
    ? b.priceSeries.map((p: any) => Number(p.p) * BNB_USD)
    : Array.from({ length: 24 }, (_, i) => (Number(b.price) || 0) * BNB_USD * (1 + Math.sin(i / 3 + Number(id)) * 0.08));
  const created = Number(b.createdAt) * 1000 || Date.now();
  const ends = Number(b.deadline) * 1000 || Date.now();
  return {
    id,
    name: b.name,
    symbol: b.symbol,
    emoji: EMOJI[Number(id) % EMOJI.length] ?? "🪙",
    creator: b.creator ?? "anon",
    creatorScore: 0,
    address: b.token ?? "",
    marketCap: (Number(b.mcap) || 0) * BNB_USD,
    targetMcap: (Number(b.target) || 0) * BNB_USD,
    priceUsd: (Number(b.price) || 0) * BNB_USD,
    change24h: Number(b.change) || 0,
    bondBnb: Number(b.bond) || 0,
    durationDays: Math.max(1, Math.round((ends - created) / 86_400_000)),
    endsAt: ends,
    sealedBets: Number(b.bets) || 0,
    poolBnb: Number(b.committedTotal) || 0,
    holders: Number(b.bettors) || 0,
    status,
    curve: series,
    createdAt: created,
  };
}

export async function getTokens(): Promise<Token[]> {
  try {
    const j = await fetchJson("/tokens");
    const list = Array.isArray(j) ? j : j.tokens;
    return Array.isArray(list) && list.length ? list.map(toToken) : mockTokens;
  } catch {
    return mockTokens;
  }
}

export async function getToken(id: string): Promise<Token | undefined> {
  try {
    const j = await fetchJson(`/tokens/${id}`);
    return toToken(j.token ? { ...j.token, priceSeries: j.priceSeries ?? j.token.priceSeries } : j);
  } catch {
    return mockTokens.find((t) => t.id === id);
  }
}

export async function getStats(): Promise<Stats> {
  try {
    const s = await fetchJson("/stats");
    return {
      tokensLaunched: Number(s.launches) || 0,
      bondsLockedBnb: Number(s.tvl) || 0,
      sealedBets: Number(s.totalBets) || 0,
      survivalRate: Number(s.survivalRate) || 0,
      paidOutBnb: Number(s.totalVolume) || 0,
    };
  } catch {
    return mockStats;
  }
}

export async function getCreators(): Promise<Creator[]> {
  try {
    const j = await fetchJson("/creators");
    const list = Array.isArray(j) ? j : j.creators;
    if (!Array.isArray(list) || !list.length) return mockCreators;
    return list.map((c: any) => ({
      ...(mockCreators[0] as Creator),
      handle: c.handle,
      launched: Number(c.launched) || 0,
      survived: Number(c.survived) || 0,
      bondsPostedBnb: Number(c.bonded) || 0,
      score: Math.round((Number(c.rate) || 0) * 100),
      streak: Number(c.survived) || 0,
    }));
  } catch {
    return mockCreators;
  }
}
