import { config } from "./config";
import { store, type Launch } from "./store";

// Deterministic PRNG so demo data is stable across restarts (except timing).
let seed = 0xd00d;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
const addr = () => `0x${hex(40)}`;

const TOKENS: [string, string][] = [
  ["Doomer Pepe", "DPEPE"], ["Last Candle", "CANDLE"], ["Rug Survivor", "RUGSRV"], ["Exit Liquidity", "EXIT"],
  ["Ngmi Cat", "NGMI"], ["Moon or Bust", "MOB"], ["Wojak Capital", "WOJAK"], ["Sealed Bet", "SEAL"],
  ["BNB Cockroach", "ROACH"], ["Copium", "COPE"], ["Diamond Paws", "PAWS"], ["Zero Day", "ZDAY"],
  ["Ape Funeral", "RIP"], ["Phoenix Inu", "PHNX"],
];

export function seedDemo() {
  const now = Math.floor(Date.now() / 1000);
  const creators = Array.from({ length: 7 }, addr);
  const traders = Array.from({ length: 40 }, addr);

  TOKENS.forEach(([name, symbol], i) => {
    // First ~5 settled, next 3 in reveal, rest live in commit phase.
    const settled = i < 5;
    const reveal = !settled && i < 8;
    const ageH = settled ? 72 + rand() * 96 : reveal ? 25 + rand() * 20 : 1 + rand() * 20;
    const createdAt = Math.floor(now - ageH * 3600);
    const deadline = settled ? createdAt + 24 * 3600 : reveal ? now - Math.floor(rand() * 3600) : createdAt + 24 * 3600;
    const targetMcap = [50, 100, 150, 250, 500][Math.floor(rand() * 5)];
    const survived = settled ? rand() > 0.45 : undefined;

    const l: Launch = {
      id: String(i + 1),
      token: addr(),
      creator: creators[i % creators.length],
      name,
      symbol,
      bond: [0.5, 1, 2, 5][Math.floor(rand() * 4)],
      targetMcap,
      deadline,
      createdAt,
      createdBlock: 44_000_000 + i * 12_000,
      createdTx: `0x${hex(64)}`,
      trades: [],
      volume: 0,
      price: 0,
      committedTotal: 0,
      commitCount: 0,
      bettors: new Set(),
      revealedCount: 0,
      revealedSurvive: 0,
      revealedDoom: 0,
      settled,
      survived,
    };

    // Random-walk price path, biased toward/away from target depending on outcome.
    const startMcap = targetMcap * (0.05 + rand() * 0.1);
    let price = startMcap / config.totalSupply;
    const end = settled ? deadline + 3600 * 6 : now;
    const n = 60 + Math.floor(rand() * 140);
    const drift = survived === undefined ? 0.012 : survived ? 0.02 : -0.004;
    for (let k = 0; k < n; k++) {
      const ts = Math.floor(createdAt + ((end - createdAt) * (k + 1)) / (n + 1));
      const isBuy = rand() < 0.5 + drift * 10;
      const bnb = +(0.02 + rand() ** 2 * 3).toFixed(4);
      price *= 1 + (isBuy ? 1 : -1) * (0.01 + rand() * 0.05) + drift * 0.3;
      price = Math.max(price, 1e-12);
      l.trades.push({
        trader: traders[Math.floor(rand() * traders.length)],
        isBuy, bnb, tokens: bnb / price, price, ts, block: l.createdBlock + k * 40, tx: `0x${hex(64)}`,
      });
      l.volume += bnb;
    }
    l.price = price;

    const bets = 8 + Math.floor(rand() * 60);
    for (let b = 0; b < bets; b++) {
      const amt = +(0.05 + rand() ** 2 * 4).toFixed(3);
      l.committedTotal += amt;
      l.commitCount++;
      l.bettors.add(traders[Math.floor(rand() * traders.length)]);
      if (settled || (reveal && rand() < 0.6)) {
        l.revealedCount++;
        if (rand() < (survived === undefined ? 0.5 : survived ? 0.65 : 0.35)) l.revealedSurvive += amt;
        else l.revealedDoom += amt;
      }
    }
    l.committedTotal = +l.committedTotal.toFixed(4);
    if (settled) l.twapMcap = +(survived ? targetMcap * (1.05 + rand()) : targetMcap * rand() * 0.6).toFixed(3);
    store.launches.set(l.id, l);
  });
  store.synced = true;

  // Keep the demo "alive": occasional trades/commits on commit-phase markets.
  setInterval(() => {
    const live = store.list().filter((l) => store.phase(l) === "commit");
    if (!live.length) return;
    const l = live[Math.floor(Math.random() * live.length)];
    const isBuy = Math.random() < 0.55;
    const bnb = +(0.02 + Math.random() ** 2 * 2).toFixed(4);
    l.price *= 1 + (isBuy ? 1 : -1) * (0.005 + Math.random() * 0.03);
    l.trades.push({
      trader: traders[Math.floor(Math.random() * traders.length)],
      isBuy, bnb, tokens: bnb / l.price, price: l.price,
      ts: Math.floor(Date.now() / 1000), block: 0, tx: `0x${hex(64)}`,
    });
    l.volume += bnb;
    if (Math.random() < 0.3) {
      l.committedTotal = +(l.committedTotal + 0.05 + Math.random()).toFixed(4);
      l.commitCount++;
      l.bettors.add(traders[Math.floor(Math.random() * traders.length)]);
    }
  }, config.pollMs);
}
