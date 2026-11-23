import { encodeAbiParameters, keccak256, toHex, type Address, type Hex } from "viem";

export type Side = 0 | 1; // 0 = NO (doom), 1 = YES (survive)

export interface StoredCommit {
  marketId: string;
  side: Side;
  salt: Hex;
  user: Address;
  commitment: Hex;
  amountBnb: string;
  createdAt: number;
  revealed?: boolean;
}

const PREFIX = "doommarket:commit:";

export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** commitment = keccak256(abi.encode(uint8 side, bytes32 salt, address user)) */
export function computeCommitment(side: Side, salt: Hex, user: Address): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "uint8" }, { type: "bytes32" }, { type: "address" }], [side, salt, user]),
  );
}

export function saveCommit(c: StoredCommit) {
  try {
    localStorage.setItem(PREFIX + c.marketId, JSON.stringify(c));
  } catch {}
}

export function loadCommit(marketId: string): StoredCommit | null {
  try {
    const v = localStorage.getItem(PREFIX + marketId);
    return v ? (JSON.parse(v) as StoredCommit) : null;
  } catch {
    return null;
  }
}

export function loadAllCommits(): StoredCommit[] {
  const out: StoredCommit[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) {
        const v = localStorage.getItem(k);
        if (v) out.push(JSON.parse(v));
      }
    }
  } catch {}
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
