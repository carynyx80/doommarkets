export const usd = (n: number) =>
  n >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6
      ? `$${(n / 1e6).toFixed(2)}M`
      : n >= 1e3
        ? `$${(n / 1e3).toFixed(1)}K`
        : `$${n.toFixed(2)}`;
export const num = (n: number) => n.toLocaleString("en-US");
export const bnb = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} BNB`;
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export function countdown(ms: number) {
  if (ms <= 0) return "Closed";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}
