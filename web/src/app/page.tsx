import Home from "@/components/home/Home";
import { getStats, getTokens } from "@/lib/api";

export const revalidate = 30;

export default async function Page() {
  const [tokens, stats] = await Promise.all([getTokens(), getStats()]);
  return <Home tokens={tokens} stats={stats} />;
}
