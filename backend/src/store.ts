import { config } from "./config";

export type Phase = "commit" | "reveal" | "settled";

export interface TradeRec {
  trader: string;
  isBuy: boolean;
  bnb: number; // BNB
  tokens: number; // whole tokens
  price: number; // BNB per token
  ts: number; // unix seconds
  block: number;
  tx: string;
}

export interface LaunchMeta {
  image: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

export const FEE_KINDS = ["launch", "buy", "sell", "bet"] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export interface Launch extends LaunchMeta {
  id: string;
  token: string;
  creator: string;
  name: string;
  symbol: string;
  bond: number; // BNB
  targetMcap: number; // BNB
  deadline: number; // unix seconds
  createdAt: number;
  createdBlock: number;
  createdTx: string;
  trades: TradeRec[];
  volume: number;
  price: number;
  // Sealed market aggregates (never per-user sides before reveal)
  committedTotal: number;
  commitCount: number;
  bettors: Set<string>;
  revealedCount: number;
  revealedSurvive: number;
  revealedDoom: number;
  settled: boolean;
  survived?: boolean;
  twapMcap?: number;
  /** Creator trading fees (0.1% of buys/sells) accrued on this token, BNB. */
  creatorFees: number;
}

export const WEI = 1e18;
export const toNum = (v: unknown): number => {
  if (typeof v === "bigint") return Number(v) / WEI;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v) return Number(v) / WEI;
  return 0;
};

export class Store {
  launches = new Map<string, Launch>();
  lastBlock = 0;
  headBlock = 0;
  synced = false;
  lastError: string | null = null;
  /** LaunchMetadata seen before its LaunchCreated (shouldn't happen, but be order-tolerant). */
  pendingMeta = new Map<string, LaunchMeta>();
  fees: Record<FeeKind, number> = { launch: 0, buy: 0, sell: 0, bet: 0 };
  feesTotal = 0;
  /** Sum of CreatorFeeAccrued across all tokens, BNB. */
  creatorFeesTotal = 0;
  /** CreatorFeesClaimed totals keyed by lowercase creator address, BNB. */
  creatorFeesClaimed = new Map<string, number>();

  addCreatorFee(l: Launch, amt: number) {
    l.creatorFees += amt;
    this.creatorFeesTotal += amt;
  }

  addCreatorClaim(creator: string, amt: number) {
    const k = creator.toLowerCase();
    this.creatorFeesClaimed.set(k, (this.creatorFeesClaimed.get(k) ?? 0) + amt);
  }

  now(): number {
    return Math.floor(Date.now() / 1000);
  }

  phase(l: Launch): Phase {
    if (l.settled) return "settled";
    return this.now() < l.deadline ? "commit" : "reveal";
  }

  mcap(l: Launch): number {
    return l.price * config.totalSupply;
  }

  change24h(l: Launch): number {
    if (!l.trades.length) return 0;
    const cutoff = this.now() - 86400;
    let ref = l.trades[0].price;
    for (const t of l.trades) {
      if (t.ts <= cutoff) ref = t.price;
      else break;
    }
    return ref > 0 ? ((l.price - ref) / ref) * 100 : 0;
  }

  summary(l: Launch) {
    const phase = this.phase(l);
    return {
      id: l.id,
      token: l.token,
      name: l.name,
      symbol: l.symbol,
      creator: creatorHandle(l.creator),
      creatorAddress: truncate(l.creator),
      image: l.image ?? null,
      description: l.description ?? null,
      website: l.website ?? null,
      twitter: l.twitter ?? null,
      telegram: l.telegram ?? null,
      price: l.price,
      mcap: this.mcap(l),
      change: round(this.change24h(l), 2),
      volume: l.volume,
      target: l.targetMcap,
      progress: l.targetMcap > 0 ? Math.min(1, this.mcap(l) / l.targetMcap) : 0,
      bond: l.bond,
      deadline: l.deadline,
      createdAt: l.createdAt,
      phase,
      committedTotal: l.committedTotal,
      bets: l.commitCount,
      bettors: l.bettors.size,
      // Side totals only become meaningful once the reveal window opens; before that they're sealed.
      revealed:
        phase === "commit"
          ? null
          : { count: l.revealedCount, survive: l.revealedSurvive, doom: l.revealedDoom },
      settled: l.settled,
      survived: l.survived ?? null,
      twapMcap: l.twapMcap ?? null,
      creatorFeesBnb: round(l.creatorFees, 6),
    };
  }

  detail(l: Launch) {
    const recent = l.trades.slice(-50).reverse().map((t) => ({
      trader: truncate(t.trader),
      isBuy: t.isBuy,
      bnb: t.bnb,
      tokens: t.tokens,
      price: t.price,
      ts: t.ts,
      tx: t.tx,
    }));
    return { ...this.summary(l), recentTrades: recent, priceSeries: priceSeries(l) };
  }

  list() {
    return [...this.launches.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  stats() {
    const all = this.list();
    const settled = all.filter((l) => l.settled);
    const survived = settled.filter((l) => l.survived).length;
    const tvl = all
      .filter((l) => !l.settled)
      .reduce((s, l) => s + l.committedTotal + l.bond, 0);
    return {
      tvl: round(tvl, 4),
      launches: all.length,
      live: all.length - settled.length,
      settled: settled.length,
      totalBets: all.reduce((s, l) => s + l.commitCount, 0),
      totalVolume: round(all.reduce((s, l) => s + l.volume, 0), 4),
      survivalRate: settled.length ? round(survived / settled.length, 4) : 0,
      feesBnb: round(this.feesTotal, 6),
      creatorFeesBnb: round(this.creatorFeesTotal, 6),
      feesByKind: {
        launch: round(this.fees.launch, 6),
        buy: round(this.fees.buy, 6),
        sell: round(this.fees.sell, 6),
        bet: round(this.fees.bet, 6),
      },
    };
  }

  creators() {
    const map = new Map<string, Launch[]>();
    for (const l of this.launches.values()) {
      const k = l.creator.toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return [...map.entries()]
      .map(([addr, ls]) => creatorRow(addr, ls, this.creatorFeesClaimed.get(addr) ?? 0))
      .sort((a, b) => b.survived - a.survived || b.rate - a.rate || b.launched - a.launched);
  }

  /** Lookup by full address or by anonymized handle (creator-xxxx). */
  creator(key: string) {
    const k = key.toLowerCase();
    const match = (c: string) => c.toLowerCase() === k || creatorHandle(c) === k;
    const ls = [...this.launches.values()].filter((l) => match(l.creator));
    if (!ls.length) return null;
    const claimed = this.creatorFeesClaimed.get(ls[0].creator.toLowerCase()) ?? 0;
    return { ...creatorRow(ls[0].creator, ls, claimed), launches: ls.map((l) => this.summary(l)) };
  }
}

function creatorRow(addr: string, ls: Launch[], claimed: number) {
  const settled = ls.filter((l) => l.settled);
  const survived = settled.filter((l) => l.survived).length;
  return {
    handle: creatorHandle(addr),
    address: truncate(addr),
    launched: ls.length,
    settled: settled.length,
    survived,
    doomed: settled.length - survived,
    rate: settled.length ? round(survived / settled.length, 4) : 0,
    bonded: round(ls.reduce((s, l) => s + l.bond, 0), 4),
    creatorFeesEarned: round(ls.reduce((s, l) => s + l.creatorFees, 0), 6),
    creatorFeesClaimed: round(claimed, 6),
  };
}

/** Bucketed close-price series (max ~120 points) for charts. */
function priceSeries(l: Launch) {
  if (!l.trades.length) return [{ t: l.createdAt, p: 0 }];
  const start = l.createdAt;
  const end = Math.max(l.trades[l.trades.length - 1].ts, start + 60);
  const buckets = 120;
  const step = Math.max(60, Math.ceil((end - start) / buckets));
  const out: { t: number; p: number; v: number }[] = [];
  let i = 0;
  let last = l.trades[0].price;
  for (let t = start; t <= end + step; t += step) {
    let v = 0;
    while (i < l.trades.length && l.trades[i].ts < t + step) {
      last = l.trades[i].price;
      v += l.trades[i].bnb;
      i++;
    }
    out.push({ t, p: last, v: round(v, 6) });
  }
  return out;
}

// ---- metadata sanitization ----
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // strip control chars (keep \n), trim, cap length
  const s = v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
};

/** Only absolute http(s) URLs survive; javascript:, data:, etc. are dropped. */
export function safeUrl(v: unknown): string | null {
  const s = clean(v, 512);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Accept an http(s) URL, or a bare handle ("@name" / "name"), normalized to a URL on `base`. */
function socialLink(v: unknown, base: string): string | null {
  const s = clean(v, 256);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return safeUrl(s);
  const handle = s.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,32}$/.test(handle)) return `${base}${handle}`;
  return null;
}

/** ipfs://CID/path is rewritten to a public gateway; otherwise must be http(s). */
function safeImage(v: unknown): string | null {
  const s = clean(v, 1024);
  if (!s) return null;
  const ipfs = /^ipfs:\/\/(?:ipfs\/)?([A-Za-z0-9]+(?:\/[A-Za-z0-9._\-\/]*)?)$/.exec(s);
  if (ipfs) return `https://ipfs.io/ipfs/${ipfs[1]}`;
  return safeUrl(s);
}

export function sanitizeMeta(m: Partial<Record<keyof LaunchMeta, unknown>>): LaunchMeta {
  return {
    image: safeImage(m.image),
    description: clean(m.description, 1000),
    website: safeUrl(m.website),
    twitter: socialLink(m.twitter, "https://x.com/"),
    telegram: socialLink(m.telegram, "https://t.me/"),
  };
}

export const creatorHandle = (addr: string) => `creator-${addr.toLowerCase().slice(2, 6)}`;
export const truncate = (addr: string) => (addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr);
export const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export const store = new Store();
