"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useState } from "react";
import { formatEther, type Address, type Hex } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { useAccount, useBalance, useDeployContract, usePublicClient, useSwitchChain } from "wagmi";
import artifact from "@/abi/DoomLaunchpad.bytecode.json";
import { TREASURY_ADDRESS, launchpadAbi } from "@/lib/contracts";

const CHAINS = [bsc, bscTestnet] as const;
const explorer = (id: number) => (id === bscTestnet.id ? "https://testnet.bscscan.com" : "https://bscscan.com");
const bytecode = (artifact as { bytecode: string }).bytecode as Hex;

type Result = { address: Address; block: bigint; hash: Hex; chainId: number };

export default function DeployContract() {
  const { address, chainId, isConnected } = useAccount();
  const [target, setTarget] = useState<number>(bsc.id);
  const { switchChainAsync } = useSwitchChain();
  const { deployContractAsync } = useDeployContract();
  const client = usePublicClient({ chainId: target });
  const bal = useBalance({ address, chainId: target, query: { enabled: !!address } });
  const [stage, setStage] = useState<"idle" | "signing" | "mining" | "done" | "error">("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const chain = CHAINS.find((c) => c.id === target)!;
  const validBytecode = typeof bytecode === "string" && bytecode.startsWith("0x") && bytecode.length > 1000;

  async function deploy() {
    setError(null);
    try {
      if (chainId !== target) await switchChainAsync({ chainId: target });
      setStage("signing");
      const h = await deployContractAsync({ abi: launchpadAbi, bytecode, args: [TREASURY_ADDRESS], chainId: target });
      setHash(h);
      setStage("mining");
      const r = await client!.waitForTransactionReceipt({ hash: h, timeout: 180_000 });
      if (r.status !== "success" || !r.contractAddress) throw new Error("Deployment transaction failed on-chain.");
      setResult({ address: r.contractAddress, block: r.blockNumber, hash: h, chainId: target });
      setStage("done");
    } catch (e) {
      setError((e as Error).message.split("\n")[0]);
      setStage("error");
    }
  }

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const summary = result
    ? `Doom Market deployed\nNetwork: ${result.chainId === bsc.id ? "BNB Smart Chain (56)" : "BSC Testnet (97)"}\nContract: ${result.address}\nBlock: ${result.block.toString()}\nTx: ${result.hash}`
    : "";

  return (
    <main className="min-h-screen bg-ink px-4 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-xs text-white/40 hover:text-white/70">← Doom Market</Link>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em]">
          Deploy the launchpad<span className="text-acid">.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Deploys <span className="font-mono text-white/80">DoomLaunchpad</span> from your own wallet. Your keys never leave your wallet —
          you just confirm one transaction and pay the gas.
        </p>

        <div className="card mt-8 space-y-5 p-6">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">1 · Wallet</p>
            <ConnectButton showBalance={false} chainStatus="none" />
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">2 · Network</p>
            <div className="grid grid-cols-2 gap-2">
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTarget(c.id)}
                  disabled={stage === "signing" || stage === "mining"}
                  className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                    target === c.id ? "border-acid/50 bg-acid/10 text-acid" : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                >
                  {c.id === bsc.id ? "BNB Chain mainnet" : "BSC testnet"}
                </button>
              ))}
            </div>
            {target === bsc.id && (
              <p className="mt-2 text-[11px] text-amber-200/80">
                Mainnet uses real BNB. These contracts have not been audited — consider a testnet run first.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs">
            <Row k="Contract" v="DoomLaunchpad" />
            <Row k="Company wallet (owner + fees)" v={TREASURY_ADDRESS} mono />
            <Row k="Fees" v="0.1% platform on launch/buy/sell/bet · 0.1% creator on buy/sell" />
            <Row k="Your balance" v={bal.data ? `${Number(formatEther(bal.data.value)).toFixed(4)} ${chain.nativeCurrency.symbol}` : "—"} mono />
          </div>

          <button
            onClick={deploy}
            disabled={!isConnected || !validBytecode || stage === "signing" || stage === "mining" || stage === "done"}
            className="btn-acid w-full !py-3.5 disabled:opacity-50"
          >
            {stage === "signing"
              ? "Confirm in your wallet…"
              : stage === "mining"
                ? "Deploying…"
                : stage === "done"
                  ? "Deployed ✓"
                  : !isConnected
                    ? "Connect a wallet first"
                    : `Deploy to ${target === bsc.id ? "mainnet" : "testnet"}`}
          </button>

          {hash && (
            <a href={`${explorer(target)}/tx/${hash}`} target="_blank" rel="noreferrer" className="block text-center text-xs text-acid/80 hover:text-acid">
              View transaction on BscScan ↗
            </a>
          )}
          {error && <p className="rounded-xl border border-doom/30 bg-doom/10 p-3 text-xs text-red-200">{error}</p>}
        </div>

        {result && (
          <div className="card mt-6 space-y-3 border-acid/30 p-6">
            <p className="font-medium text-acid">Launchpad deployed 🎉</p>
            <Row k="Contract address" v={result.address} mono />
            <Row k="Deploy block" v={result.block.toString()} mono />
            <a href={`${explorer(result.chainId)}/address/${result.address}`} target="_blank" rel="noreferrer" className="block text-xs text-acid/80 hover:text-acid">
              Open contract on BscScan ↗
            </a>
            <button onClick={() => copy("all", summary)} className="btn-ghost w-full">
              {copied === "all" ? "Copied!" : "Copy details to send to Claude"}
            </button>
            <p className="text-[11px] text-white/40">Paste these into the chat so the website and backend switch to the live contract.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-white/45">{k}</span>
      <span className={`break-all text-white/85 ${mono ? "font-mono text-[11px]" : ""}`}>{v}</span>
    </div>
  );
}
