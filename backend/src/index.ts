import Fastify from "fastify";
import cors from "@fastify/cors";
import { isAddress } from "viem";
import { config, demoMode } from "./config";
import { store } from "./store";
import { startIndexer } from "./indexer";
import { seedDemo } from "./demo";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
const started = Date.now();
const meta = () => ({ demo: demoMode, chainId: config.chainId });

app.register(cors, { origin: "*" });

app.get("/", async () => ({ name: "doom-market-api", ...meta(), endpoints: ["/health", "/stats", "/tokens", "/tokens/:id", "/creators", "/creators/:address"] }));

app.get("/health", async () => ({
  ok: true,
  ...meta(),
  synced: store.synced,
  launchpad: config.launchpad ?? null,
  lastBlock: store.lastBlock,
  headBlock: store.headBlock,
  lastError: store.lastError,
  uptime: Math.floor((Date.now() - started) / 1000),
}));

app.get("/stats", async () => ({ ...meta(), ...store.stats() }));

app.get<{ Querystring: { phase?: string; sort?: string } }>("/tokens", async (req) => {
  let tokens = store.list().map((l) => store.summary(l));
  const { phase, sort } = req.query;
  if (phase) tokens = tokens.filter((t) => t.phase === phase);
  if (sort === "mcap") tokens.sort((a, b) => b.mcap - a.mcap);
  else if (sort === "volume") tokens.sort((a, b) => b.volume - a.volume);
  else if (sort === "deadline") tokens.sort((a, b) => a.deadline - b.deadline);
  else if (sort === "committed") tokens.sort((a, b) => b.committedTotal - a.committedTotal);
  return { ...meta(), count: tokens.length, tokens };
});

app.get<{ Params: { id: string } }>("/tokens/:id", async (req, reply) => {
  const key = req.params.id;
  const l =
    store.launches.get(key) ??
    store.list().find((x) => x.token.toLowerCase() === key.toLowerCase());
  if (!l) return reply.code(404).send({ ...meta(), error: "not_found" });
  return { ...meta(), token: store.detail(l) };
});

app.get("/creators", async () => {
  const creators = store.creators();
  return { ...meta(), count: creators.length, creators };
});

app.get<{ Params: { address: string } }>("/creators/:address", async (req, reply) => {
  const a = req.params.address;
  if (!isAddress(a) && !/^creator-[0-9a-f]{4}$/i.test(a))
    return reply.code(400).send({ ...meta(), error: "invalid_address_or_handle" });
  const c = store.creator(a);
  if (!c) return reply.code(404).send({ ...meta(), error: "not_found" });
  return { ...meta(), creator: c };
});

async function main() {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  if (demoMode) {
    app.log.info("LAUNCHPAD_ADDRESS not set: serving DEMO data");
    seedDemo();
  } else {
    // Run indexer in background so /health responds during backfill.
    startIndexer().catch((e) => {
      store.lastError = (e as Error).message.slice(0, 300);
      app.log.error(e, "indexer crashed");
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => app.close().then(() => process.exit(0)));
}
