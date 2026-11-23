import fs from "node:fs";
import path from "node:path";
import { parseAbi, type Abi } from "viem";

const fallback = parseAbi([
  "event LaunchCreated(uint256 indexed id, address indexed token, address indexed creator, string name, string symbol, uint256 bond, uint256 targetMcap, uint256 deadline)",
  "event Trade(uint256 indexed id, address indexed trader, bool isBuy, uint256 bnbAmount, uint256 tokenAmount, uint256 priceAfter)",
  "event Committed(uint256 indexed id, address indexed user, bytes32 commitment, uint256 amount)",
  "event Revealed(uint256 indexed id, address indexed user, uint8 side, uint256 amount)",
  "event Settled(uint256 indexed id, bool survived, uint256 twapMcap)",
  "event LaunchMetadata(uint256 indexed id, string imageURI, string description, string website, string twitter, string telegram)",
  "event FeePaid(uint256 indexed id, uint8 indexed kind, address indexed payer, uint256 amount)",
]);

/** Loads src/abi/DoomLaunchpad.json (raw ABI array or {abi:[...]} artifact) if present, else the fallback. */
export function loadAbi(): { abi: Abi; source: string } {
  const candidates = [
    path.join(__dirname, "abi", "DoomLaunchpad.json"), // dist/abi or src/abi (tsx)
    path.join(__dirname, "..", "src", "abi", "DoomLaunchpad.json"), // running from dist/
    path.join(process.cwd(), "src", "abi", "DoomLaunchpad.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      const abi = Array.isArray(json) ? json : json.abi;
      if (Array.isArray(abi) && abi.length) return { abi: abi as Abi, source: p };
    } catch (e) {
      console.warn(`[abi] failed to load ${p}: ${(e as Error).message}`);
    }
  }
  return { abi: fallback as Abi, source: "fallback(parseAbi)" };
}

export const EVENT_NAMES = ["LaunchCreated", "Trade", "Committed", "Revealed", "Settled", "LaunchMetadata", "FeePaid"] as const;

/** Events from the fallback list that the loaded ABI lacks (e.g. JSON not yet regenerated) are merged in. */
export function withFallbackEvents(abi: Abi): Abi {
  const have = new Set((abi as any[]).filter((x) => x.type === "event").map((x) => x.name));
  const extra = (fallback as readonly any[]).filter((x) => x.type === "event" && !have.has(x.name));
  return [...(abi as any[]), ...extra] as Abi;
}
