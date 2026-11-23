import Link from "next/link";
import MarketDetail from "@/components/app/MarketDetail";
import { getToken } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const token = await getToken(params.id);
  if (!token)
    return (
      <div className="py-24 text-center">
        <p className="h-display text-4xl">Market not found</p>
        <p className="mt-2 text-sm text-white/45">It may have been doomed already.</p>
        <Link href="/app" className="btn-acid mt-8">
          Back to markets
        </Link>
      </div>
    );
  return <MarketDetail token={token} />;
}
