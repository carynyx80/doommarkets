import type { Abi, Address } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import DoomLaunchpadAbi from "@/abi/DoomLaunchpad.json";

const isAddr = (v?: string): v is Address => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

const lp = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS;

// The launchpad and the sealed survival markets live in one contract (DoomLaunchpad).
export const LAUNCHPAD_ADDRESS: Address | undefined = isAddr(lp) ? lp : undefined;
export const MARKET_ADDRESS: Address | undefined = LAUNCHPAD_ADDRESS;

export const TREASURY_ADDRESS: Address = "0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0";

export const launchpadAbi = DoomLaunchpadAbi as unknown as Abi;
export const marketAbi = launchpadAbi;

/** BNB/USD used to convert the USD target in the launch form into the on-chain BNB-denominated target. */
export const BNB_USD = Number(process.env.NEXT_PUBLIC_BNB_USD) || 900;

/** True only when an address is configured AND the ABI has been filled in. */
export const contractsReady = (abi: Abi, addr?: Address): addr is Address =>
  !!addr && Array.isArray(abi) && abi.length > 0;

/** Chain the app transacts on (matches wagmi default). */
export const TARGET_CHAIN = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID === "97" ? bscTestnet : bsc;
const EXPLORER = TARGET_CHAIN.blockExplorers.default.url.replace(/\/$/, "");
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;
export const tokenUrl = (addr: string) => `${EXPLORER}/token/${addr}`;

/** Flat 0.1% fee on launches (of bond), buys, sells and every bet — sent to TREASURY_ADDRESS. */
export const FEE_BPS = 10;
export const FEE_LABEL = "0.1%";
export const feeOf = (wei: bigint) => (wei * BigInt(FEE_BPS)) / BigInt(10_000);
export const feeOfNum = (n: number) => (n * FEE_BPS) / 10_000;
