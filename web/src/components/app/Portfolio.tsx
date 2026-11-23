"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { TokenAvatar } from "@/components/ui";
import { loadAllCommits, saveCommit, type StoredCommit } from "@/lib/commit";
import { MARKET_ADDRESS, contractsReady, marketAbi } from "@/lib/contracts";
import { mockTokens } from "@/lib/mock";
import PageHeader from "./PageHeader";

export default function Portfolio() {
  const toast = useToast();
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const [commits, setCommits] = useState<StoredCommit[]>([]);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  useEffect(() => setCommits(loadAllCommits()), []);

  async function act(c: StoredCommit, kind: "reveal" | "claim") {
    if (!contractsReady(marketAbi, MARKET_ADDRESS)) return toast("Contracts deploying soon", `${kind === "reveal" ? "Reveal" : "Claim"} will be available once the market contract is live.`);
    if (!address) return openConnectModal?.();
    try {
      const hash = await writeContractAsync({
        address: MARKET_ADDRESS,
        abi: marketAbi,
        functionName: kind === "reveal" ? "reveal" : "claim",
        args: kind === "reveal" ? [BigInt(c.marketId), c.side, c.salt] : [BigInt(c.marketId)],
      });
      if (kind === "reveal") {
        const next = { ...c, revealed: true };
        saveCommit(next);
        setCommits((s) => s.map((x) => (x.marketId === c.marketId ? next : x)));
      }
      toast(kind === "reveal" ? "Bet revealed" : "Claim submitted", `tx ${hash.slice(0, 10)}…`, "success");
    } catch (err) {
      toast("Transaction failed", (err as Error).message.split("\n")[0], "error");
    }
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(commits, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "doommarket-salts-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title={
          <>
            Your sealed bets<span className="text-acid">.</span>
          </>
        }
        sub="Only you can see this page. Bets are stored as commitments on-chain; your sides and salts live in this browser."
        right={
          commits.length > 0 && (
            <button onClick={exportAll} className="btn-ghost self-start sm:self-auto">
              Back up all salts
            </button>
          )
        }
      />

      <div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-xs text-amber-100/80">
        <span className="font-medium text-amber-200">⚠ Your salts are stored locally.</span> Clearing browser data deletes them. Without a salt you
        can’t reveal — and unrevealed bets are forfeited. Export a backup.
      </div>

      {commits.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl">🔒</span>
          <p className="h-display mt-5 text-2xl">No sealed bets yet</p>
          <p className="mt-2 max-w-sm text-sm text-white/45">Pick a market and seal a YES or NO. It will show up here with reveal and claim actions.</p>
          <Link href="/app" className="btn-acid mt-7">
            Explore markets
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {commits.map((c) => {
            const t = mockTokens.find((x) => x.id === c.marketId);
            const phase = t?.status ?? "open";
            return (
              <div key={c.marketId} className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <TokenAvatar token={t ?? { emoji: "💀", symbol: "?" }} />
                  <div className="min-w-0">
                    <Link href={`/app/market/${c.marketId}`} className="font-semibold hover:text-acid">
                      {t ? `${t.name} ($${t.symbol})` : `Market #${c.marketId}`}
                    </Link>
                    <p className="truncate font-mono text-[11px] text-white/40">{c.commitment}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs">{c.amountBnb} BNB</span>
                  <button
                    onClick={() => setShown((s) => ({ ...s, [c.marketId]: !s[c.marketId] }))}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      shown[c.marketId] ? (c.side === 1 ? "border-acid/40 text-acid" : "border-doom/40 text-doom") : "border-white/10 text-white/50"
                    }`}
                  >
                    {shown[c.marketId] ? (c.side === 1 ? "YES" : "NO") : "•••• tap to peek"}
                  </button>
                  <button onClick={() => act(c, "reveal")} disabled={c.revealed} className="btn-ghost !px-4 !py-1.5 !text-xs disabled:opacity-40">
                    {c.revealed ? "Revealed" : phase === "open" ? "Reveal (after close)" : "Reveal"}
                  </button>
                  <button onClick={() => act(c, "claim")} className="btn-acid !px-4 !py-1.5 !text-xs">
                    Claim
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
