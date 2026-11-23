"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { computeCommitment, loadCommit, randomSalt, saveCommit, type Side, type StoredCommit } from "@/lib/commit";
import { FEE_LABEL, MARKET_ADDRESS, TARGET_CHAIN, contractsReady, feeOfNum, marketAbi, txUrl } from "@/lib/contracts";
import type { Token } from "@/lib/types";

const Lock = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function BetPanel({ token }: { token: Token }) {
  const toast = useToast();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync, isPending } = useWriteContract();
  const [side, setSide] = useState<Side>(1);
  const [amount, setAmount] = useState("0.1");
  const [existing, setExisting] = useState<StoredCommit | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => setExisting(loadCommit(token.id)), [token.id]);

  const open = token.status === "open";

  async function placeBet() {
    if (!address) return openConnectModal?.();
    const amt = Number(amount);
    if (!(amt > 0)) return toast("Enter an amount", undefined, "error");
    const salt = randomSalt();
    const commitment = computeCommitment(side, salt, address);
    setPreview(commitment);
    if (!contractsReady(marketAbi, MARKET_ADDRESS)) {
      return toast("Contracts deploying soon", "Your commitment was computed locally but nothing was sent on-chain.", "info");
    }
    try {
      if (chainId !== TARGET_CHAIN.id) await switchChainAsync({ chainId: TARGET_CHAIN.id });
      const hash = await writeContractAsync({
        address: MARKET_ADDRESS,
        abi: marketAbi,
        functionName: "commit",
        args: [BigInt(token.id), commitment],
        value: parseEther(amount),
      });
      const c: StoredCommit = { marketId: token.id, side, salt, user: address, commitment, amountBnb: amount, createdAt: Date.now() };
      saveCommit(c);
      setExisting(c);
      toast("Sealed bet placed", `tx ${hash.slice(0, 10)}… — back up your salt!`, "success", { href: txUrl(hash), label: "View on BscScan" });
    } catch (err) {
      toast("Transaction failed", (err as Error).message.split("\n")[0], "error");
    }
  }

  function backup() {
    if (!existing) return;
    const blob = new Blob([JSON.stringify(existing, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `doommarket-bet-${token.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-acid/15 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <p className="font-medium">Place a sealed bet</p>
        <span className="flex items-center gap-1.5 rounded-full border border-acid/25 bg-acid/10 px-2.5 py-1 text-[11px] text-acid">
          <Lock className="h-3 w-3" /> Encrypted
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-1.5">
        {([1, 0] as Side[]).map((s) => (
          <button
            key={s}
            disabled={!open}
            onClick={() => setSide(s)}
            className={`relative rounded-xl py-3.5 text-sm font-semibold transition disabled:opacity-50 ${side === s ? (s === 1 ? "text-ink" : "text-white") : "text-white/50 hover:text-white"}`}
          >
            {side === s && (
              <motion.span layoutId="side" className={`absolute inset-0 rounded-xl ${s === 1 ? "bg-acid" : "bg-doom"}`} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{s === 1 ? "YES · Survives" : "NO · Doomed"}</span>
          </button>
        ))}
      </div>

      <label className="relative mt-4 block">
        <span className="mb-1.5 block text-xs text-white/50">Amount</span>
        <div className="relative">
          <input className="input pr-14" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!open} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">BNB</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {["0.05", "0.1", "0.5", "1"].map((v) => (
            <button key={v} type="button" onClick={() => setAmount(v)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/55 hover:border-white/25 hover:text-white">
              {v}
            </button>
          ))}
        </div>
      </label>

      <div className="relative mt-4 flex justify-between rounded-xl border border-white/[0.07] bg-black/30 px-4 py-2.5 text-[12px]">
        <span className="text-white/50">Bet fee ({FEE_LABEL})</span>
        <span className="font-mono text-white/70">
          {(Number(amount) > 0 ? feeOfNum(Number(amount)) : 0).toLocaleString("en-US", { maximumFractionDigits: 6 })} BNB
        </span>
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/[0.07] bg-black/40 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-acid">
            <Lock />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Your bet is encrypted until reveal</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              Only a hash of your side + a random salt goes on-chain. Nobody — not the creator, not whales — sees YES or NO until the market closes.
            </p>
            <AnimatePresence>
              {preview && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 break-all font-mono text-[10px] text-white/40">
                  commitment: {preview}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <button onClick={placeBet} disabled={!open || isPending} className={`relative mt-5 w-full !py-3.5 ${side === 1 ? "btn-acid" : "btn-ghost !border-doom/40 !bg-doom/90 !text-white hover:!bg-doom"} disabled:opacity-50`}>
        {!open ? "Market closed" : isPending ? "Confirm in wallet…" : address ? `Seal ${side === 1 ? "YES" : "NO"} bet` : "Connect wallet to bet"}
      </button>

      {existing && (
        <div className="relative mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-[11px] text-amber-100/80">
          <p className="font-medium text-amber-200">⚠ Back up your salt</p>
          <p className="mt-1 leading-relaxed">
            Your salt is stored only in this browser. Without it you cannot reveal, and an unrevealed bet is forfeited.
          </p>
          <button onClick={backup} className="mt-2 underline underline-offset-2 hover:text-white">
            Download backup (.json)
          </button>
        </div>
      )}
    </div>
  );
}
