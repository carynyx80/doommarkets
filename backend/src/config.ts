import { isAddress, getAddress } from "viem";

const chainId = Number(process.env.CHAIN_ID || 56);
const defaultRpc =
  chainId === 97 ? "https://bsc-testnet-dataseed.bnbchain.org" : "https://bsc-dataseed.bnbchain.org";

const rawAddr = (process.env.LAUNCHPAD_ADDRESS || "").trim();
if (rawAddr && !isAddress(rawAddr)) {
  console.warn(`[config] LAUNCHPAD_ADDRESS "${rawAddr}" is not a valid address; falling back to demo mode`);
}

// bsc-dataseed nodes reject eth_getLogs ("limit exceeded"), so logs go to a getLogs-capable RPC.
const rpcUrl = process.env.RPC_URL || defaultRpc;
const defaultLogsRpc = rpcUrl.includes("dataseed")
  ? chainId === 97
    ? "https://bsc-testnet-rpc.publicnode.com"
    : "https://bsc-rpc.publicnode.com"
  : rpcUrl;

export const config = {
  port: Number(process.env.PORT || 8080),
  chainId,
  rpcUrl,
  logsRpcUrl: process.env.LOGS_RPC_URL || defaultLogsRpc,
  launchpad: rawAddr && isAddress(rawAddr) ? getAddress(rawAddr) : undefined,
  startBlock: process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined,
  chunkSize: BigInt(Math.min(Number(process.env.LOG_CHUNK_SIZE || 5000), 5000)),
  pollMs: Number(process.env.POLL_INTERVAL_MS || 3000),
  totalSupply: Number(process.env.TOKEN_TOTAL_SUPPLY || 1_000_000_000),
};

export const demoMode = !config.launchpad;
