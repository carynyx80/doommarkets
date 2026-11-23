"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { BNB_USD, LAUNCHPAD_ADDRESS, contractsReady, launchpadAbi } from "@/lib/contracts";
import { usd } from "@/lib/format";
import PageHeader from "./PageHeader";

const durations = [3, 7, 14, 30];

export default function Launch() {
  const toast = useToast();
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync, isPending } = useWriteContract();
  const [form, setForm] = useState({ name: "", symbol: "", description: "", emoji: "💀", bond: "5", target: "1000000", days: 7 });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((s) => ({ ...s, [k]: v }));

  const bond = Number(form.bond) || 0;
  const target = Number(form.target) || 0;
  const valid = form.name.trim() && form.symbol.trim() && bond >= 0.1 && target >= 10_000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return toast("Check the form", "Name, symbol, bond ≥ 0.1 BNB and target ≥ $10K are required.", "error");
    if (!contractsReady(launchpadAbi, LAUNCHPAD_ADDRESS)) return toast("Contracts deploying soon", "The launchpad isn't live yet — your settings look good.", "info");
    if (!address) return openConnectModal?.();
    try {
      const hash = await writeContractAsync({
        address: LAUNCHPAD_ADDRESS,
        abi: launchpadAbi,
        functionName: "createLaunch",
        args: [form.name, form.symbol.toUpperCase(), parseEther((target / BNB_USD).toFixed(6)), BigInt(form.days * 86400)],
        value: parseEther(form.bond),
      });
      toast("Launch submitted", `tx ${hash.slice(0, 10)}…`, "success");
    } catch (err) {
      toast("Transaction failed", (err as Error).message.split("\n")[0], "error");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Launch"
        title={
          <>
            Launch with a bond<span className="text-acid">.</span>
          </>
        }
        sub="Put BNB behind your token. If it survives past the target, you get the bond back plus reputation. If it dies, the bond pays holders and NO bettors."
      />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-[80px_1fr_140px]">
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/50">Icon</span>
              <input className="input text-center text-xl" maxLength={2} value={form.emoji} onChange={(e) => set("emoji", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/50">Token name</span>
              <input className="input" placeholder="Cope Coin" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/50">Symbol</span>
              <input className="input uppercase" placeholder="COPE" maxLength={8} value={form.symbol} onChange={(e) => set("symbol", e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs text-white/50">Description</span>
            <textarea className="input min-h-[90px] resize-none" placeholder="What is it? Why will it survive?" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/50">Creator bond (BNB)</span>
              <input className="input" type="number" step="0.1" min="0.1" value={form.bond} onChange={(e) => set("bond", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/50">Target market cap (USD)</span>
              <input className="input" type="number" step="10000" min="10000" value={form.target} onChange={(e) => set("target", e.target.value)} />
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-white/50">Market duration</span>
            <div className="grid grid-cols-4 gap-2">
              {durations.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => set("days", d)}
                  className={`rounded-xl border py-3 text-sm font-medium transition ${
                    form.days === d ? "border-acid bg-acid/10 text-acid" : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isPending} className="btn-acid w-full !py-3.5 disabled:opacity-60">
            {isPending ? "Confirm in wallet…" : `Launch & lock ${bond || 0} BNB`}
          </button>
          <p className="text-center text-[11px] text-white/35">A 1% launch fee goes to the protocol treasury.</p>
        </form>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Preview</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">{form.emoji || "💀"}</span>
              <div>
                <p className="font-semibold">{form.name || "Your token"}</p>
                <p className="text-xs text-white/45">${(form.symbol || "TICKER").toUpperCase()}</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
              <p className="text-[11px] text-white/45">Prediction market</p>
              <p className="mt-1 text-lg font-medium leading-snug">
                Will ${(form.symbol || "TICKER").toUpperCase()} be above <span className="text-acid">{usd(target)}</span> market cap in{" "}
                <span className="text-acid">{form.days} days</span>?
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-acid/20 bg-acid/[0.06] p-3">
                <p className="text-[11px] text-acid/80">If it survives</p>
                <p className="mt-1 text-xs text-white/70">Bond returned + reputation</p>
              </div>
              <div className="rounded-xl border border-doom/25 bg-doom/[0.07] p-3">
                <p className="text-[11px] text-doom">If it dies</p>
                <p className="mt-1 text-xs text-white/70">{bond || 0} BNB → holders & NO</p>
              </div>
            </div>
          </div>
          <div className="card p-6 text-sm text-white/55">
            <p className="font-medium text-white">Anonymous by design</p>
            <p className="mt-1.5 text-xs leading-relaxed">
              Your launch is tied to a pseudonymous creator handle. Survived launches build your score on the Creators leaderboard — no KYC, no doxxing.
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
