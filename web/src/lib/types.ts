export type MarketStatus = "open" | "reveal" | "survived" | "doomed";

export interface Token {
  id: string;
  name: string;
  symbol: string;
  emoji: string; // fallback when no image
  image?: string | null;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  creator: string; // anonymous handle
  creatorScore: number;
  address: string;
  marketCap: number; // USD
  targetMcap: number; // USD
  priceUsd: number;
  change24h: number;
  bondBnb: number;
  durationDays: number;
  endsAt: number; // unix ms
  sealedBets: number;
  poolBnb: number;
  holders: number;
  status: MarketStatus;
  curve: number[]; // price series
  createdAt: number;
}

export interface Stats {
  tokensLaunched: number;
  bondsLockedBnb: number;
  sealedBets: number;
  survivalRate: number; // 0..1
  paidOutBnb: number;
  feesBnb: number;
}

export interface Creator {
  handle: string;
  launched: number;
  survived: number;
  bondsPostedBnb: number;
  score: number;
  streak: number;
}
