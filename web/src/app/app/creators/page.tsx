import PageHeader from "@/components/app/PageHeader";
import Link from "next/link";
import { TokenAvatar } from "@/components/ui";
import { getCreators, getTokens } from "@/lib/api";

export const revalidate = 30;
export const metadata = { title: "Creators — Doom Market" };

export default async function Page() {
  const [rawCreators, tokens] = await Promise.all([getCreators(), getTokens()]);
  const creators = [...rawCreators].sort((a, b) => b.score - a.score);
  const byCreator = (h: string) => tokens.filter((t) => t.creator.toLowerCase() === h.toLowerCase()).slice(0, 4);
  return (
    <>
      <PageHeader
        eyebrow="Creators"
        title={
          <>
            Anonymous reputation<span className="text-acid">.</span>
          </>
        }
        sub="Pseudonymous creators ranked by how many of their launches survived. Track records, not faces."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {creators.slice(0, 3).map((c, i) => (
          <div key={c.handle} className={`card relative overflow-hidden p-5 ${i === 0 ? "border-acid/30" : ""}`}>
            {i === 0 && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-acid/25 blur-3xl" />}
            <p className="font-mono text-xs text-white/40">#{i + 1}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`h-10 w-10 rounded-full ${i === 0 ? "bg-gradient-to-br from-acid to-emerald-700" : "bg-gradient-to-br from-white/40 to-white/5"}`} />
              <div>
                <p className="font-semibold">{c.handle}</p>
                <p className="text-xs text-white/45">
                  {c.survived}/{c.launched} survived
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-1.5">
              {byCreator(c.handle).map((t) => (
                <Link key={t.id} href={`/app/market/${t.id}`} title={`$${t.symbol}`}>
                  <TokenAvatar token={t} className="h-8 w-8 rounded-lg text-base" />
                </Link>
              ))}
            </div>
            <p className="h-display mt-4 text-4xl">{c.score}</p>
            <p className="text-[11px] text-white/40">reputation score</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-white/35">
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Creator</th>
                <th className="px-5 py-3 font-medium">Launched</th>
                <th className="px-5 py-3 font-medium">Survival</th>
                <th className="px-5 py-3 font-medium">Bonds posted</th>
                <th className="px-5 py-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c, i) => {
                const rate = c.launched ? c.survived / c.launched : 0;
                return (
                  <tr key={c.handle} className="border-b border-white/[0.04] transition hover:bg-white/[0.025]">
                    <td className="px-5 py-4 font-mono text-white/40">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-5 py-4 font-medium">
                      <span className="inline-flex items-center gap-2 align-middle">
                        <span className="flex -space-x-2">
                          {byCreator(c.handle).slice(0, 3).map((t) => (
                            <TokenAvatar key={t.id} token={t} className="h-7 w-7 rounded-lg text-sm ring-2 ring-[#07070a]" />
                          ))}
                        </span>
                        {c.handle}
                      </span>
                      {c.streak >= 3 && <span className="ml-2 rounded-full bg-acid/10 px-2 py-0.5 text-[10px] text-acid">🔥 {c.streak} streak</span>}
                    </td>
                    <td className="px-5 py-4 text-white/70">{c.launched}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={`h-full ${rate >= 0.5 ? "bg-acid" : "bg-doom"}`} style={{ width: `${rate * 100}%` }} />
                        </div>
                        <span className="text-xs text-white/60">{Math.round(rate * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white/70">{c.bondsPostedBnb} BNB</td>
                    <td className="px-5 py-4 text-right font-semibold">{c.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
