import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || (fs.existsSync("/data") ? "/data/uploads" : "./uploads"),
);

const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;
type Ext = keyof typeof TYPES;

/** Strict: 64 hex chars + known extension. Anything else (../, %2f, etc.) never touches the FS. */
const FILE_RE = /^[a-f0-9]{64}\.(png|jpg|gif|webp)$/;

/** Detect image type from magic bytes; mimetype/filename from the client are ignored. */
export function sniff(b: Buffer): Ext | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 6) {
    const h = b.subarray(0, 6).toString("ascii");
    if (h === "GIF87a" || h === "GIF89a") return "gif";
  }
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP")
    return "webp";
  return null;
}

/** First hop of x-forwarded-for (Railway's proxy sets it), else socket address. */
function clientIp(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}
// Prune idle entries so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) if (!arr.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

function publicBase(req: FastifyRequest): string {
  const env = (process.env.PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (env) return env;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  const proto = (String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || req.protocol || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function registerUploads(app: FastifyInstance) {
  fs.mkdirSync(uploadDir, { recursive: true });
  app.log.info(`uploads stored in ${uploadDir}`);

  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 6 },
  });

  app.post("/upload", async (req, reply) => {
    if (rateLimited(clientIp(req))) return reply.code(429).send({ error: "rate_limited" });
    if (!req.isMultipart()) return reply.code(415).send({ error: "multipart_required" });

    let buf: Buffer | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type !== "file") continue;
        if (part.fieldname !== "file" || buf) {
          part.file.resume();
          continue;
        }
        buf = await part.toBuffer(); // throws RequestFileTooLargeError past the limit
      }
    } catch (e: any) {
      if (e?.code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ error: "file_too_large", maxBytes: MAX_UPLOAD_BYTES });
      req.log.warn(e, "upload parse failed");
      return reply.code(400).send({ error: "bad_multipart" });
    }
    if (!buf || !buf.length) return reply.code(400).send({ error: "missing_file_field" });

    const ext = sniff(buf);
    if (!ext) return reply.code(415).send({ error: "unsupported_type", allowed: ["png", "jpeg", "gif", "webp"] });

    const name = `${crypto.createHash("sha256").update(buf).digest("hex")}.${ext}`;
    const dest = path.join(uploadDir, name);
    if (!fs.existsSync(dest)) {
      const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmp, buf);
      await fs.promises.rename(tmp, dest);
    }
    return { url: `${publicBase(req)}/uploads/${name}` };
  });

  app.get<{ Params: { file: string } }>("/uploads/:file", async (req, reply) => {
    const file = req.params.file;
    if (!FILE_RE.test(file)) return reply.code(404).send({ error: "not_found" });
    const full = path.join(uploadDir, file);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(full);
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
    const ext = file.split(".").pop() as Ext;
    return reply
      .header("Content-Type", TYPES[ext])
      .header("Content-Length", stat.size)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'; sandbox")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("ETag", `"${file.slice(0, 64)}"`)
      .send(fs.createReadStream(full));
  });
}
