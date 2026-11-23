import type { Creator, Stats, Token } from "./types";

const DAY = 86_400_000;
// Fixed reference time so SSR and client renders match.
export const MOCK_NOW = Date.UTC(2026, 10, 23, 12, 0, 0);

function curve(seed: number, n = 48, trend = 1): number[] {
  const out: number[] = [];
  let v = 1;
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.5;
    v = Math.max(0.05, v * (1 + r * 0.18 + 0.012 * trend));
    out.push(Number(v.toFixed(4)));
  }
  return out;
}

type Row = [string, string, string, string, number, number, number, number, number, number, Token["status"], number];

const raw: Row[] = [
  // name, symbol, emoji, creator, mcap, target, bond, days, bets, pool, status, trend
  ["Cope Coin", "COPE", "🫠", "anon_0x7f", 412_000, 1_000_000, 5, 7, 312, 48.2, "open", 1],
  ["Rug Insurance", "RUGI", "🛡️", "ghostwriter", 1_840_000, 1_500_000, 12, 14, 904, 162.4, "open", 2],
  ["Last Candle", "CNDL", "🕯️", "nightshift", 96_000, 500_000, 2, 3, 77, 9.1, "open", -1],
  ["Exit Liquidity", "EXIT", "🚪", "anon_0x2a", 2_900_000, 2_000_000, 20, 30, 1_402, 311.0, "open", 2],
  ["Doom Frog", "DFROG", "🐸", "pondlord", 640_000, 750_000, 6, 7, 455, 71.5, "reveal", 0.5],
  ["Paper Hands", "PAPR", "🧻", "anon_0xc3", 38_000, 250_000, 1, 3, 41, 3.3, "doomed", -2],
  ["Diamond Cope", "DCOPE", "💎", "ghostwriter", 3_400_000, 3_000_000, 25, 30, 1_980, 402.7, "survived", 2],
  ["Ser Pls", "SER", "🙏", "nightshift", 220_000, 400_000, 3, 5, 133, 18.0, "open", 0.5],
  ["Moon Or Tomb", "TOMB", "⚰️", "cryptkeeper", 870_000, 1_000_000, 8, 10, 611, 96.8, "open", 1],
  ["Ngmi Dog", "NGMI", "🐕", "anon_0x91", 154_000, 300_000, 2, 5, 98, 11.2, "open", 0],
  ["Sealed Ape", "SAPE", "🦍", "cryptkeeper", 1_120_000, 1_000_000, 10, 14, 720, 120.3, "open", 1.5],
  ["Copium Tank", "CPIUM", "🫧", "pondlord", 58_000, 200_000, 1.5, 3, 52, 4.6, "open", -1],
];

export const mockTokens: Token[] = raw.map((r, i) => {
  const [name, symbol, emoji, creator, mcap, target, bond, days, bets, pool, status, trend] = r;
  const c = curve(i * 7919 + 13, 48, trend);
  const ends = status === "open" ? MOCK_NOW + (days * DAY) / (1.4 + (i % 3)) : MOCK_NOW - DAY;
  return {
    id: String(i + 1),
    name,
    symbol,
    emoji,
    image: null,
    description: `${name} — a bonded memecoin with a sealed survival market. Survive above the target or the bond pays holders.`,
    website: "",
    twitter: "",
    telegram: "",
    creator,
    creatorScore: 40 + ((i * 37) % 60),
    address: `0x${((i + 11) * 2654435761).toString(16).padStart(40, "d")}`,
    marketCap: mcap,
    targetMcap: target,
    priceUsd: mcap / 1_000_000_000,
    change24h: Number(((c[c.length - 1] / c[c.length - 8] - 1) * 100).toFixed(1)),
    bondBnb: bond,
    durationDays: days,
    endsAt: Math.round(ends),
    sealedBets: bets,
    poolBnb: pool,
    holders: 120 + bets * 3,
    status,
    curve: c,
    createdAt: Math.round(MOCK_NOW - (i + 1) * DAY * 0.7),
  };
});

export const mockStats: Stats = {
  tokensLaunched: 1284,
  bondsLockedBnb: 4912.6,
  sealedBets: 38417,
  survivalRate: 0.31,
  paidOutBnb: 2207.4,
  feesBnb: 18.6,
};

export const mockCreators: Creator[] = [
  { handle: "ghostwriter", launched: 14, survived: 11, bondsPostedBnb: 182, score: 94, streak: 6 },
  { handle: "cryptkeeper", launched: 9, survived: 7, bondsPostedBnb: 96, score: 88, streak: 4 },
  { handle: "pondlord", launched: 21, survived: 12, bondsPostedBnb: 140, score: 79, streak: 2 },
  { handle: "nightshift", launched: 11, survived: 6, bondsPostedBnb: 58, score: 71, streak: 1 },
  { handle: "anon_0x2a", launched: 4, survived: 3, bondsPostedBnb: 64, score: 69, streak: 3 },
  { handle: "anon_0x7f", launched: 6, survived: 3, bondsPostedBnb: 31, score: 58, streak: 0 },
  { handle: "anon_0x91", launched: 8, survived: 2, bondsPostedBnb: 22, score: 41, streak: 0 },
  { handle: "anon_0xc3", launched: 12, survived: 1, bondsPostedBnb: 14, score: 18, streak: 0 },
];
