import type { Abi, Address } from "viem";
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
