"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatEther, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { useToast } from "@/components/Toast";
import { CREATOR_FEE_LABEL, LAUNCHPAD_ADDRESS, TARGET_CHAIN, contractsReady, launchpadAbi, txUrl } from "@/lib/contracts";

/** Shows creator trading fees owed to the connected wallet and lets them withdraw. */
export default function CreatorEarnings() {
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const client = usePublicClient({ chainId: TARGET_CHAIN.id });
  const toast = useToast();
  const ready = contractsReady(launchpadAbi, LAUNCHPAD_ADDRESS);

  const owed = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: "creatorFeesOwed",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: ready && !!address, refetchInterval: 15_000 },
  });
  const amount = typeof owed.data === "bigint" ? owed.data : BigInt(0);

  async function withdraw() {
    if (!address) return openConnectModal?.();
    if (!ready) return toast("Contracts deploying soon", "Creator fees can be withdrawn once the launchpad is live.", "info");
    try {
      if (chainId !== TARGET_CHAIN.id) await switchChainAsync({ chainId: TARGET_CHAIN.id });
      const hash: Hex = await writeContractAsync({
        address: LAUNCHPAD_ADDRESS!,
        abi: launchpadAbi,
        functionName: "claimCreatorFees",
        chainId: TARGET_CHAIN.id,
      });
      toast("Withdrawal submitted", "Waiting for confirmation…", "info", { href: txUrl(hash), label: "View on BscScan" });
      await client?.waitForTransactionReceipt({ hash });
      toast("Creator fees withdrawn", `${Number(formatEther(amount)).toFixed(6)} BNB sent to your wallet`, "success", { href: txUrl(hash), label: "View on BscScan" });
      owed.refetch();
    } catch (err) {
      toast("Withdrawal failed", (err as Error).message.split("\n")[0], "error");
    }
  }

  return (
    <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Creator earnings</p>
        <p className="mt-1 font-display text-3xl tracking-tight">
          {ready && address ? Number(formatEther(amount)).toFixed(6) : "0.000000"} <span className="text-lg text-white/50">BNB</span>
        </p>
        <p className="mt-1 text-xs text-white/45">
          You earn {CREATOR_FEE_LABEL} of every buy and sell on tokens you launched. Withdraw any time.
        </p>
      </div>
      <button onClick={withdraw} disabled={isPending || (ready && !!address && amount === BigInt(0))} className="btn-acid self-start disabled:opacity-50 sm:self-auto">
        {!address ? "Connect wallet" : isPending ? "Confirm in wallet…" : "Withdraw fees"}
      </button>
    </div>
  );
}
