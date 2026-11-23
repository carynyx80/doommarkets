import Explore from "@/components/app/Explore";
import { getStats, getTokens } from "@/lib/api";

export const revalidate = 15;

export default async function ExplorePage() {
  const [tokens, stats] = await Promise.all([getTokens(), getStats()]);
  return <Explore tokens={tokens} stats={stats} />;
}
