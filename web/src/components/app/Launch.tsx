"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog, formatEther, parseEther, type Hex, type Log } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES, uploadImage } from "@/lib/api";
import {
  BNB_USD,
  CREATOR_FEE_LABEL,
  FEE_LABEL,
  creatorFeeOf,
  LAUNCHPAD_ADDRESS,
  TARGET_CHAIN,
  TREASURY_ADDRESS,
  contractsReady,
  feeOf,
  launchpadAbi,
  txUrl,
} from "@/lib/contracts";
import { short, usd } from "@/lib/format";
import PageHeader from "./PageHeader";

const durations = [3, 7, 14, 30];
const DEFAULT_MIN_BOND = 0.1;
const DEV_BUY_SLIPPAGE_BPS = BigInt(200); // 2%

type Phase = "idle" | "switching" | "signing" | "pending" | "success";

function safeEther(v: string): bigint {
  try {
    const n = Number(v);
    return n > 0 && Number.isFinite(n) ? parseEther(v as `${number}`) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

const fmtBnb = (wei: bigint, dp = 6) => `${Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: dp })} BNB`;

/** Pull the new launch id out of the receipt logs (LaunchCreated(uint256 indexed id, address indexed token, address indexed creator, ...)). */
function launchIdFromLogs(logs: Log[]): bigint | null {
  for (const log of logs) {
    if (LAUNCHPAD_ADDRESS && log.address.toLowerCase() !== LAUNCHPAD_ADDRESS.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: launchpadAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]], strict: false });
      if (ev.eventName === "LaunchCreated") {
        const a = ev.args as unknown as Record<string, unknown> & unknown[];
        const id = (a?.id ?? a?.[0]) as bigint | undefined;
        if (typeof id === "bigint") return id;
      }
    } catch {
      /* not decodable with current ABI — fall through to the topic heuristic */
    }
  }
  // Fallback: first launchpad log with 3 indexed params (id, token, creator).
  const l = logs.find((x) => (!LAUNCHPAD_ADDRESS || x.address.toLowerCase() === LAUNCHPAD_ADDRESS.toLowerCase()) && x.topics.length === 4);
  return l?.topics[1] ? BigInt(l.topics[1]) : null;
}

function ImageDrop({
  preview,
  uploading,
  progress,
  error,
  uploaded,
  onFile,
  onClear,
}: {
  preview: string | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  uploaded: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <span className="mb-1.5 block text-xs text-white/50">
        Token image <span className="text-doom">*</span>
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`group relative flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition ${
          over ? "border-acid bg-acid/[0.06]" : error ? "border-doom/50 bg-doom/[0.04]" : "border-white/15 bg-white/[0.02] hover:border-white/30"
        }`}
      >
        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Token preview" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-acid" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{preview ? (uploading ? "Uploading…" : uploaded ? "Image uploaded" : "Image selected") : "Drop an image or click to upload"}</p>
          <p className="mt-0.5 text-[11px] text-white/40">PNG, JPG, GIF or WEBP · max 2MB · shown as a square</p>
          {uploading && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className="h-full rounded-full bg-acid" animate={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          )}
          {uploaded && !uploading && <p className="mt-1.5 text-[11px] text-acid">✓ Stored — will be saved as the token’s imageURI</p>}
          {error && <p className="mt-1.5 text-[11px] text-doom">{error}</p>}
          {preview && !uploading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mt-2 text-[11px] text-white/45 underline underline-offset-2 hover:text-white"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs text-white/50">
        <span>{label}</span>
        {hint && <span className="font-mono text-[10px] text-white/35">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function Launch() {
  const toast = useToast();
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });
  const ready = contractsReady(launchpadAbi, LAUNCHPAD_ADDRESS);

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    bond: String(DEFAULT_MIN_BOND),
    target: "1000000",
    days: 7,
    devBuy: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((s) => ({ ...s, [k]: v }));

  // ---- image upload ----
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgError, setImgError] = useState<string | null>(null);
  const uploadSeq = useRef(0);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onFile(f: File) {
    setImgError(null);
    if (!UPLOAD_TYPES.includes(f.type)) return setImgError("Unsupported file type — use PNG, JPG, GIF or WEBP.");
    if (f.size > UPLOAD_MAX_BYTES) return setImgError(`File is ${(f.size / 1024 / 1024).toFixed(1)}MB — max is 2MB.`);
    setPreview(URL.createObjectURL(f));
    setImageUrl(null);
    setUploading(true);
    setProgress(0);
    const seq = ++uploadSeq.current;
    try {
      const url = await uploadImage(f, setProgress);
      if (seq === uploadSeq.current) setImageUrl(url);
    } catch (err) {
      if (seq === uploadSeq.current) setImgError((err as Error).message);
    } finally {
      if (seq === uploadSeq.current) setUploading(false);
    }
  }

  function clearImage() {
    uploadSeq.current++;
    setPreview(null);
    setImageUrl(null);
    setUploading(false);
    setImgError(null);
  }

  // ---- chain reads ----
  const { data: minBondWei } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: "minBond",
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready },
  });
  const minBond = typeof minBondWei === "bigint" ? Number(formatEther(minBondWei)) : DEFAULT_MIN_BOND;

  const { data: curveConsts } = useReadContracts({
    allowFailure: true,
    contracts: (["VIRTUAL_BNB", "VIRTUAL_TOKENS", "TOTAL_SUPPLY"] as const).map((fn) => ({
      address: LAUNCHPAD_ADDRESS,
      abi: launchpadAbi,
      functionName: fn,
      chainId: TARGET_CHAIN.id,
    })),
    query: { enabled: ready },
  });

  // ---- amounts ----
  const bondWei = safeEther(form.bond);
  const devBuyWei = safeEther(form.devBuy);
  const launchFee = feeOf(bondWei);
  const devFee = feeOf(devBuyWei);
  const totalWei = bondWei + devBuyWei;
  const bond = Number(form.bond) || 0;
  const target = Number(form.target) || 0;
  const targetWei = safeEther((target / BNB_USD).toFixed(18));

  // Dev buy is the first trade on a fresh curve, so the quote is the constant-product output from the virtual reserves.
  const devBuyOut = useMemo(() => {
    const vb = curveConsts?.[0]?.result;
    const vt = curveConsts?.[1]?.result;
    if (typeof vb !== "bigint" || typeof vt !== "bigint" || devBuyWei === BigInt(0)) return null;
    const net = devBuyWei - devFee - creatorFeeOf(devBuyWei);
    return vt - (vb * vt) / (vb + net);
  }, [curveConsts, devBuyWei, devFee]);
  const totalSupply = curveConsts?.[2]?.result;
  const devBuyPct = devBuyOut && typeof totalSupply === "bigint" && totalSupply > BigInt(0) ? Number((devBuyOut * BigInt(1_000_000)) / totalSupply) / 10_000 : null;
  const devBuyMinOut = devBuyOut ? (devBuyOut * (BigInt(10_000) - DEV_BUY_SLIPPAGE_BPS)) / BigInt(10_000) : BigInt(0);

  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Name is required");
  if (!form.symbol.trim()) errors.push("Ticker is required");
  if (!preview) errors.push("Image is required");
  if (bond < minBond) errors.push(`Bond must be ≥ ${minBond} BNB`);
  if (target < 10_000) errors.push("Target must be ≥ $10K");
  if (form.devBuy && !(Number(form.devBuy) >= 0)) errors.push("Dev buy must be a positive number");

  // ---- submit ----
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const busy = phase !== "idle" && phase !== "success";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length) return toast("Check the form", errors.join(" · "), "error");
    if (uploading) return toast("Hold on", "Your image is still uploading.", "info");
    if (!ready || !LAUNCHPAD_ADDRESS) return toast("Contracts deploying soon", "The launchpad isn't live yet — your settings and image look good.", "info");
    if (!imageUrl) return toast("Image not uploaded", imgError ?? "Re-select your image to upload it.", "error");
    if (!address) return openConnectModal?.();
    try {
      if (chainId !== TARGET_CHAIN.id) {
        setPhase("switching");
        await switchChainAsync({ chainId: TARGET_CHAIN.id });
      }
      setPhase("signing");
      const params = {
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        imageURI: imageUrl,
        description: form.description.trim(),
        website: form.website.trim(),
        twitter: form.twitter.trim(),
        telegram: form.telegram.trim(),
        targetMcap: targetWei,
        duration: BigInt(form.days * 86_400),
      };
      const h = await writeContractAsync({
        address: LAUNCHPAD_ADDRESS,
        abi: launchpadAbi,
        functionName: "createLaunch",
        args: [params, devBuyWei, devBuyMinOut],
        value: totalWei,
        chainId: TARGET_CHAIN.id,
      });
      setHash(h);
      setPhase("pending");
      toast("Launch submitted", `tx ${short(h)}`, "info", { href: txUrl(h), label: "View on BscScan" });
      if (!publicClient) throw new Error("No RPC client for BSC");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: h });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      const id = launchIdFromLogs(receipt.logs as Log[]);
      setPhase("success");
      toast("Token launched 🚀", id !== null ? `Market #${id.toString()} is live` : "Your market is live", "success", { href: txUrl(h), label: "View on BscScan" });
      if (id !== null) {
        setNewId(id.toString());
        setTimeout(() => router.push(`/app/market/${id.toString()}`), 1800);
      }
    } catch (err) {
      setPhase("idle");
      const msg = (err as { shortMessage?: string }).shortMessage ?? (err as Error).message.split("\n")[0];
      toast("Launch failed", msg, "error", hash ? { href: txUrl(hash), label: "View on BscScan" } : undefined);
    }
  }

  const sym = (form.symbol || "TICKER").toUpperCase();
  const buttonLabel =
    phase === "switching"
      ? `Switching to ${TARGET_CHAIN.name}…`
      : phase === "signing"
        ? "Confirm in wallet…"
        : phase === "pending"
          ? "Launching on-chain…"
          : !address && ready
            ? "Connect wallet to launch"
            : `Launch & send ${Number(formatEther(totalWei)).toLocaleString("en-US", { maximumFractionDigits: 6 })} BNB`;

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

      <AnimatePresence>
        {phase === "success" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mb-6 border-acid/30 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
                )}
                <div>
                  <p className="h-display text-2xl">${sym} is live<span className="text-acid">.</span></p>
                  <p className="mt-1 text-xs text-white/50">{newId ? "Taking you to your market…" : "Confirmed on-chain. Find it in Explore shortly."}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {hash && (
                  <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="btn-ghost !py-2 !text-xs">
                    BscScan ↗
                  </a>
                )}
                {newId && (
                  <button onClick={() => router.push(`/app/market/${newId}`)} className="btn-acid !py-2 !text-xs">
                    Open market →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7">
          <ImageDrop preview={preview} uploading={uploading} progress={progress} error={imgError} uploaded={!!imageUrl} onFile={onFile} onClear={clearImage} />

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Token name" hint={`${form.name.length}/32`}>
              <input className="input" placeholder="Cope Coin" maxLength={32} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Ticker" hint={`${form.symbol.length}/10`}>
              <input
                className="input uppercase"
                placeholder="COPE"
                maxLength={10}
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
            </Field>
          </div>

          <Field label="Description" hint={`${form.description.length}/512`}>
            <textarea
              className="input min-h-[96px] resize-none"
              maxLength={512}
              placeholder="What is it? Why will it survive?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Website" hint="optional">
              <input className="input" placeholder="https://…" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="X / Twitter" hint="optional">
              <input className="input" placeholder="https://x.com/…" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
            </Field>
            <Field label="Telegram" hint="optional">
              <input className="input" placeholder="https://t.me/…" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Creator bond (BNB)" hint={`min ${minBond}`}>
              <input className="input" type="number" step="0.01" min={minBond} value={form.bond} onChange={(e) => set("bond", e.target.value)} />
            </Field>
            <Field label="Survival target (USD mcap)" hint={target > 0 ? `≈ ${(target / BNB_USD).toLocaleString("en-US", { maximumFractionDigits: 2 })} BNB` : undefined}>
              <input className="input" type="number" step="10000" min="10000" value={form.target} onChange={(e) => set("target", e.target.value)} />
            </Field>
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

          <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-4">
            <Field label="Dev buy (BNB)" hint="optional · first buy on the curve">
              <input className="input" type="number" step="0.01" min="0" placeholder="0" value={form.devBuy} onChange={(e) => set("devBuy", e.target.value)} />
            </Field>
            <div className="mt-2 flex gap-1.5">
              {["0.1", "0.5", "1"].map((v) => (
                <button key={v} type="button" onClick={() => set("devBuy", v)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/55 hover:border-white/25 hover:text-white">
                  {v}
                </button>
              ))}
              {form.devBuy && (
                <button type="button" onClick={() => set("devBuy", "")} className="rounded-lg px-2.5 py-1 text-[11px] text-white/40 hover:text-white">
                  clear
                </button>
              )}
            </div>
            {devBuyWei > BigInt(0) && (
              <p className="mt-2 text-[11px] text-white/50">
                {devBuyOut !== null ? (
                  <>
                    You receive ≈ <span className="font-mono text-white/80">{Number(formatEther(devBuyOut)).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span> ${sym}
                    {devBuyPct !== null && <> ({devBuyPct.toFixed(2)}% of supply)</>} · min out at 2% slippage
                  </>
                ) : ready ? (
                  "Fetching curve quote…"
                ) : (
                  "Live quote available once contracts are deployed."
                )}
              </p>
            )}
          </div>

          <button type="submit" disabled={busy || uploading} className="btn-acid w-full !py-3.5 disabled:opacity-60">
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />}
            {buttonLabel}
          </button>
          {phase === "pending" && hash && (
            <p className="text-center text-[11px] text-white/50">
              Waiting for confirmation ·{" "}
              <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-acid hover:underline">
                {short(hash)} ↗
              </a>
            </p>
          )}
        </form>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Preview</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  "💀"
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{form.name || "Your token"}</p>
                <p className="text-xs text-white/45">${sym}</p>
              </div>
            </div>
            {form.description && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/55">{form.description}</p>}
            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
              <p className="text-[11px] text-white/45">Prediction market</p>
              <p className="mt-1 text-lg font-medium leading-snug">
                Will ${sym} be above <span className="text-acid">{usd(target)}</span> market cap in <span className="text-acid">{form.days} days</span>?
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

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">Summary</p>
              <span className="rounded-full border border-acid/25 bg-acid/10 px-2.5 py-0.5 text-[11px] text-acid">{FEE_LABEL} flat fee</span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {[
                ["Creator bond", fmtBnb(bondWei)],
                [`Launch fee (${FEE_LABEL} of bond)`, fmtBnb(launchFee, 8)],
                ["Dev buy", fmtBnb(devBuyWei)],
                [`Dev-buy fee (${FEE_LABEL})`, fmtBnb(devFee, 8)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-white/50">{k}</span>
                  <span className="font-mono text-xs text-white/80">{v}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-white/[0.07] pt-3">
                <span className="font-medium">Total to send</span>
                <span className="font-mono text-sm text-acid">{fmtBnb(totalWei)}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              Fees are taken from the amounts above (not added on top) and sent to the company wallet{" "}
              <span className="font-mono text-white/60">{short(TREASURY_ADDRESS)}</span>. Same {FEE_LABEL} applies to every buy, sell and bet.
              <span className="mt-2 block text-acid/80">You earn a {CREATOR_FEE_LABEL} creator fee on every buy and sell of your token — withdraw it any time from Portfolio.</span>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
