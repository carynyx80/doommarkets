import { createPublicClient, http, type AbiEvent, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { config } from "./config";
import { loadAbi, withFallbackEvents, EVENT_NAMES } from "./abi";
import { store, toNum, sanitizeMeta, FEE_KINDS, type Launch } from "./store";

const SURVIVE_SIDE = Number(process.env.SURVIVE_SIDE ?? 1);

// Arg name aliases so a slightly different real ABI still indexes.
const pick = (args: Record<string, any>, ...names: string[]) => {
  for (const n of names) if (args[n] !== undefined) return args[n];
  return undefined;
};

/** Block -> timestamp via linear interpolation between fetched anchor blocks (avoids 1 RPC per log). */
const anchors: { b: number; t: number }[] = [];
function addAnchor(b: number, t: number) {
  if (anchors.some((a) => a.b === b)) return;
  anchors.push({ b, t });
  anchors.sort((x, y) => x.b - y.b);
}
function estimateTs(b: number): number {
  if (!anchors.length) return Math.floor(Date.now() / 1000);
  if (anchors.length === 1) return Math.round(anchors[0].t + (b - anchors[0].b) * 0.75);
  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (anchors[i].b <= b && anchors[i + 1].b >= b) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
  }
  if (b > hi.b && anchors.length >= 2) lo = anchors[anchors.length - 2];
  if (hi.b === lo.b) return lo.t;
  return Math.round(lo.t + ((b - lo.b) * (hi.t - lo.t)) / (hi.b - lo.b));
}

function apply(log: any) {
  const args = (log.args || {}) as Record<string, any>;
  const id = String(pick(args, "id", "launchId", "marketId") ?? "");
  const block = Number(log.blockNumber);
  const ts = estimateTs(block);
  const tx = log.transactionHash as string;
  const l = store.launches.get(id);

  switch (log.eventName) {
    case "LaunchCreated": {
      const launch: Launch = {
        id,
        token: pick(args, "token"),
        creator: pick(args, "creator"),
        name: pick(args, "name") ?? "",
        symbol: pick(args, "symbol") ?? "",
        bond: toNum(pick(args, "bond")),
        targetMcap: toNum(pick(args, "targetMcap", "target")),
        deadline: Number(pick(args, "deadline") ?? 0),
        createdAt: ts,
        createdBlock: block,
        createdTx: tx,
        trades: [],
        volume: 0,
        price: 0,
        committedTotal: 0,
        commitCount: 0,
        bettors: new Set(),
        revealedCount: 0,
        revealedSurvive: 0,
        revealedDoom: 0,
        settled: false,
        ...(store.pendingMeta.get(id) ?? sanitizeMeta({})),
      };
      store.pendingMeta.delete(id);
      store.launches.set(id, launch);
      break;
    }
    case "Trade": {
      if (!l) return;
      const price = toNum(pick(args, "priceAfter", "price"));
      const bnb = toNum(pick(args, "bnbAmount", "bnb"));
      l.trades.push({
        trader: pick(args, "trader"),
        isBuy: Boolean(pick(args, "isBuy")),
        bnb,
        tokens: toNum(pick(args, "tokenAmount", "tokens")),
        price,
        ts,
        block,
        tx,
      });
      if (l.trades.length > 5000) l.trades.splice(0, l.trades.length - 5000);
      l.price = price;
      l.volume += bnb;
      break;
    }
    case "Committed": {
      if (!l) return;
      // Commitment hash is intentionally NOT stored or exposed; only aggregates.
      l.committedTotal += toNum(pick(args, "amount"));
      l.commitCount += 1;
      l.bettors.add(String(pick(args, "user")).toLowerCase());
      break;
    }
    case "Revealed": {
      if (!l) return;
      const amt = toNum(pick(args, "amount"));
      l.revealedCount += 1;
      if (Number(pick(args, "side")) === SURVIVE_SIDE) l.revealedSurvive += amt;
      else l.revealedDoom += amt;
      break;
    }
    case "LaunchMetadata": {
      const m = sanitizeMeta({
        image: pick(args, "imageURI", "image"),
        description: pick(args, "description"),
        website: pick(args, "website"),
        twitter: pick(args, "twitter"),
        telegram: pick(args, "telegram"),
      });
      if (l) Object.assign(l, m);
      else store.pendingMeta.set(id, m);
      break;
    }
    case "FeePaid": {
      const kind = FEE_KINDS[Number(pick(args, "kind"))];
      const amt = toNum(pick(args, "amount"));
      if (kind) store.fees[kind] += amt;
      store.feesTotal += amt;
      break;
    }
    case "Settled": {
      if (!l) return;
      l.settled = true;
      l.survived = Boolean(pick(args, "survived"));
      l.twapMcap = toNum(pick(args, "twapMcap"));
      break;
    }
  }
}

export async function startIndexer() {
  const { abi, source } = loadAbi();
  const events = (withFallbackEvents(abi) as any[]).filter(
    (x) => x.type === "event" && (EVENT_NAMES as readonly string[]).includes(x.name),
  ) as AbiEvent[];
  console.log(`[indexer] ABI from ${source}; indexing events: ${events.map((e) => e.name).join(", ")}`);

  const chain = config.chainId === 97 ? bscTestnet : bsc;
  const client = createPublicClient({ chain, transport: http(config.rpcUrl, { retryCount: 3, timeout: 20_000 }) }) as PublicClient;
  const logsClient =
    config.logsRpcUrl === config.rpcUrl
      ? client
      : (createPublicClient({ chain, transport: http(config.logsRpcUrl, { retryCount: 1, timeout: 20_000 }) }) as PublicClient);
  const address = config.launchpad!;

  const anchorBlock = async (n: bigint) => {
    const b = await client.getBlock({ blockNumber: n });
    addAnchor(Number(b.number), Number(b.timestamp));
  };

  const head = await client.getBlockNumber();
  store.headBlock = Number(head);
  let from = config.startBlock ?? (head > 50_000n ? head - 50_000n : 0n);
  await Promise.all([anchorBlock(from), anchorBlock(head)]);
  console.log(`[indexer] backfilling ${address} from ${from} to ${head} (chain ${chain.id}, logs via ${config.logsRpcUrl})`);

  let chunk = config.chunkSize;
  const syncTo = async (to: bigint) => {
    while (from <= to) {
      const end = from + chunk - 1n > to ? to : from + chunk - 1n;
      try {
        const logs = await logsClient.getLogs({ address, events, fromBlock: from, toBlock: end });
        logs.sort((a: any, b: any) =>
          a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber),
        );
        for (const log of logs) apply(log);
        store.lastBlock = Number(end);
        from = end + 1n;
        if (chunk < config.chunkSize) chunk = chunk * 2n > config.chunkSize ? config.chunkSize : chunk * 2n;
      } catch (e) {
        store.lastError = (e as Error).message.slice(0, 300);
        if (chunk > 50n) {
          chunk = chunk / 2n;
          console.warn(`[indexer] getLogs failed, shrinking chunk to ${chunk}`);
        } else {
          console.warn(`[indexer] getLogs failing at min chunk, retrying in 5s: ${store.lastError}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  };

  await syncTo(head);
  store.synced = true;
  console.log(`[indexer] backfill done: ${store.launches.size} launches, at block ${store.lastBlock}`);

  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const h = await client.getBlockNumber();
      store.headBlock = Number(h);
      if (h >= from) {
        await anchorBlock(h);
        await syncTo(h);
      }
      store.lastError = null;
    } catch (e) {
      store.lastError = (e as Error).message.slice(0, 300);
      console.warn(`[indexer] poll error: ${store.lastError}`);
    } finally {
      busy = false;
    }
  }, config.pollMs);
}
