"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { erc20Abi, formatEther, parseEther, type Address, type Hex } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { FEE_LABEL, LAUNCHPAD_ADDRESS, TARGET_CHAIN, contractsReady, feeOf, launchpadAbi, txUrl } from "@/lib/contracts";
import { short } from "@/lib/format";
import type { Token } from "@/lib/types";

type Mode = "buy" | "sell";
const ZERO = BigInt(0);
const isAddr = (v: unknown): v is Address => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/.test(v);

function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function toWei(v: string): bigint {
  try {
    const n = Number(v);
    return n > 0 && Number.isFinite(n) ? parseEther(v as `${number}`) : ZERO;
  } catch {
    return ZERO;
  }
}

const fmt = (wei: bigint | undefined, dp = 4) =>
  wei === undefined ? "—" : Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: dp });

export default function TradePanel({ token }: { token: Token }) {
  const toast = useToast();
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });
  const ready = contractsReady(launchpadAbi, LAUNCHPAD_ADDRESS);
  const id = (() => {
    try {
      return BigInt(token.id);
    } catch {
      return ZERO;
    }
  })();

  const [mode, setMode] = useState<Mode>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("2");
  const [showSlip, setShowSlip] = useState(false);
  const [busy, setBusy] = useState<null | "switch" | "approve" | "trade">(null);

  // token address: on-chain getLaunch().token, falling back to the API value
  const { data: launch } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: "getLaunch",
    args: [id],
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready },
  });
  const l = launch as { token?: string } | readonly unknown[] | undefined;
  const chainToken = l && !Array.isArray(l) ? (l as { token?: string }).token : Array.isArray(l) ? l[1] : undefined;
  const tokenAddr: Address | undefined = isAddr(chainToken) ? chainToken : isAddr(token.address) ? (token.address as Address) : undefined;

  const bnbBal = useBalance({ address, chainId: TARGET_CHAIN.id, query: { enabled: !!address } });
  const tokBal = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready && !!address && !!tokenAddr },
  });
  const allowance = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && LAUNCHPAD_ADDRESS ? [address, LAUNCHPAD_ADDRESS] : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready && !!address && !!tokenAddr },
  });

  const amountWei = toWei(amount);
  const debounced = useDebounced(amountWei);
  const quote = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: mode === "buy" ? "quoteBuy" : "quoteSell",
    args: [id, debounced],
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready && debounced > ZERO, refetchInterval: 10_000 },
  });
  const quoteOut = typeof quote.data === "bigint" && debounced === amountWei ? quote.data : undefined;
  const slipBps = BigInt(Math.round(Math.min(50, Math.max(0, Number(slippage) || 0)) * 100));
  const minOut = quoteOut !== undefined ? (quoteOut * (BigInt(10_000) - slipBps)) / BigInt(10_000) : ZERO;
  // fee: 0.1% of BNB in (buy) or of BNB out (sell)
  const feeWei = mode === "buy" ? feeOf(amountWei) : quoteOut !== undefined ? feeOf(quoteOut) : undefined;

  const tokenBalance = typeof tokBal.data === "bigint" ? tokBal.data : undefined;
  const bnbBalance = bnbBal.data?.value;
  const needsApproval = mode === "sell" && amountWei > ZERO && (typeof allowance.data === "bigint" ? allowance.data < amountWei : true);
  const insufficient =
    mode === "buy" ? bnbBalance !== undefined && amountWei > bnbBalance : tokenBalance !== undefined && amountWei > tokenBalance;
  const open = true; // curve trading stays open through every market phase; the contract enforces limits

  useEffect(() => setAmount(""), [mode]);

  function quick(v: string) {
    if (mode === "buy") return setAmount(v);
    if (tokenBalance === undefined) return;
    const pct = BigInt(Number(v));
    setAmount(formatEther((tokenBalance * pct) / BigInt(100)));
  }

  async function wait(hash: Hex, label: string) {
    toast(`${label} submitted`, `tx ${short(hash)}`, "info", { href: txUrl(hash), label: "View on BscScan" });
    if (!publicClient) return;
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw Object.assign(new Error(`${label} reverted`), { hash });
  }

  async function submit() {
    if (!ready || !LAUNCHPAD_ADDRESS) return toast("Contracts deploying soon", "Trading opens once the launchpad is live.", "info");
    if (!address) return openConnectModal?.();
    if (amountWei === ZERO) return toast("Enter an amount", undefined, "error");
    if (insufficient) return toast("Insufficient balance", undefined, "error");
    if (quoteOut === undefined) return toast("Waiting for quote", "Try again in a second.", "info");
    let lastHash: Hex | undefined;
    try {
      if (chainId !== TARGET_CHAIN.id) {
        setBusy("switch");
        await switchChainAsync({ chainId: TARGET_CHAIN.id });
      }
      if (mode === "sell") {
        if (!tokenAddr) throw new Error("Token address unknown");
        if (needsApproval) {
          setBusy("approve");
          lastHash = await writeContractAsync({
            address: tokenAddr,
            abi: erc20Abi,
            functionName: "approve",
            args: [LAUNCHPAD_ADDRESS, amountWei],
            chainId: TARGET_CHAIN.id,
          });
          await wait(lastHash, "Approval");
          await allowance.refetch();
        }
        setBusy("trade");
        lastHash = await writeContractAsync({
          address: LAUNCHPAD_ADDRESS,
          abi: launchpadAbi,
          functionName: "sell",
          args: [id, amountWei, minOut],
          chainId: TARGET_CHAIN.id,
        });
        await wait(lastHash, "Sell");
      } else {
        setBusy("trade");
        lastHash = await writeContractAsync({
          address: LAUNCHPAD_ADDRESS,
          abi: launchpadAbi,
          functionName: "buy",
          args: [id, minOut],
          value: amountWei,
          chainId: TARGET_CHAIN.id,
        });
        await wait(lastHash, "Buy");
      }
      toast(mode === "buy" ? `Bought $${token.symbol}` : `Sold $${token.symbol}`, "Confirmed on-chain", "success", { href: txUrl(lastHash), label: "View on BscScan" });
      setAmount("");
    } catch (err) {
      const msg = (err as { shortMessage?: string }).shortMessage ?? (err as Error).message.split("\n")[0];
      toast("Transaction failed", msg, "error", lastHash ? { href: txUrl(lastHash), label: "View on BscScan" } : undefined);
    } finally {
      setBusy(null);
      bnbBal.refetch();
      tokBal.refetch();
      allowance.refetch();
      quote.refetch();
    }
  }

  const label =
    busy === "switch"
      ? `Switching to ${TARGET_CHAIN.name}…`
      : busy === "approve"
        ? `Approving $${token.symbol}…`
        : busy === "trade"
          ? "Confirming…"
          : !address && ready
            ? "Connect wallet to trade"
            : insufficient
              ? "Insufficient balance"
              : mode === "buy"
                ? `Buy $${token.symbol}`
                : needsApproval && ready
                  ? `Approve & sell $${token.symbol}`
                  : `Sell $${token.symbol}`;

  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="relative flex items-center justify-between">
        <p className="font-medium">Trade ${token.symbol}</p>
        <button onClick={() => setShowSlip((s) => !s)} className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55 hover:border-white/25 hover:text-white">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
          </svg>
          Slippage {slippage || 0}%
        </button>
      </div>

      {showSlip && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 flex items-center gap-1.5">
          {["0.5", "1", "2", "5"].map((v) => (
            <button
              key={v}
              onClick={() => setSlippage(v)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] ${slippage === v ? "border-acid/50 text-acid" : "border-white/10 text-white/55 hover:border-white/25"}`}
            >
              {v}%
            </button>
          ))}
          <div className="relative w-20">
            <input className="input !py-1 !pr-6 !text-[11px]" type="number" min="0" max="50" step="0.1" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40">%</span>
          </div>
        </motion.div>
      )}

      <div className="relative mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-1.5">
        {(["buy", "sell"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`relative rounded-xl py-3 text-sm font-semibold capitalize transition ${mode === m ? (m === "buy" ? "text-ink" : "text-white") : "text-white/50 hover:text-white"}`}>
            {mode === m && (
              <motion.span layoutId="trade-mode" className={`absolute inset-0 rounded-xl ${m === "buy" ? "bg-acid" : "bg-doom"}`} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{m}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-white/50">
          <span>{mode === "buy" ? "You pay" : "You sell"}</span>
          <span className="font-mono text-[11px] text-white/40">
            Bal: {mode === "buy" ? `${fmt(bnbBalance)} BNB` : `${fmt(tokenBalance, 2)} ${token.symbol}`}
          </span>
        </div>
        <div className="relative">
          <input className="input pr-20" type="number" min="0" step="any" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">{mode === "buy" ? "BNB" : token.symbol}</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {(mode === "buy" ? ["0.1", "0.5", "1"] : ["25", "50", "100"]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => quick(v)}
              disabled={mode === "sell" && tokenBalance === undefined}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/55 hover:border-white/25 hover:text-white disabled:opacity-40"
            >
              {mode === "buy" ? `${v} BNB` : `${v}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 rounded-2xl border border-white/[0.07] bg-black/40 p-4 text-[12px]">
        <div className="flex justify-between">
          <span className="text-white/50">You receive (est.)</span>
          <span className="font-mono text-white/85">
            {!ready ? "—" : amountWei === ZERO ? "0" : quote.isFetching && quoteOut === undefined ? "…" : quoteOut === undefined ? "—" : `${fmt(quoteOut, mode === "buy" ? 2 : 6)} ${mode === "buy" ? token.symbol : "BNB"}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Min received ({slippage || 0}% slippage)</span>
          <span className="font-mono text-white/60">{quoteOut === undefined ? "—" : `${fmt(minOut, mode === "buy" ? 2 : 6)} ${mode === "buy" ? token.symbol : "BNB"}`}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Fee ({FEE_LABEL})</span>
          <span className="font-mono text-white/60">{feeWei === undefined ? "—" : `${fmt(feeWei, 6)} BNB`}</span>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!!busy || !open}
        className={`mt-4 w-full !py-3.5 ${mode === "buy" ? "btn-acid" : "btn-ghost !border-doom/40 !bg-doom/90 !text-white hover:!bg-doom"} disabled:opacity-50`}
      >
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-current" />}
        {!open ? "Trading closed" : label}
      </button>
      <p className="mt-3 text-center text-[11px] text-white/35">
        {FEE_LABEL} flat fee on every buy and sell · {ready ? "bonding-curve pricing" : "contracts deploying soon"}
      </p>
    </div>
  );
}
