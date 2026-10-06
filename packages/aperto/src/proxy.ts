// POST /api/aperto: standard Web Request -> Response handler (Vercel Functions, Bun.serve, node via
// adapters). Body <= 4 KB, per-IP token bucket, same-origin only, key stays server-side.
// Contract: hack-apertus-quotelet.md section 9; shapes in ./types.ts; docs in ../README.md.
import { validateConfig } from "../../core/src/index.ts";
import { clientFromEnv } from "./client.ts";
import { readApertusEnv, type Env } from "./env.ts";
import { generateConfig } from "./generate.ts";
import { draftMessage, quoteAmounts } from "./message.ts";
import { LANGS, PROXY_LIMITS, type ApiError, type ConfigResponse, type FetchLike, type Lang, type MessageResponse, type ProxyError } from "./types.ts";

export type HandlerOptions = {
  /** Env to read APERTUS_* from (default process.env). */
  env?: Env;
  /** Injectable upstream transport (tests). */
  fetch?: FetchLike;
  /** Clock for the rate limiter (tests). */
  now?: () => number;
  ratePerMinute?: number;
  /** Trust X-Forwarded-For / X-Real-IP (true on Vercel and behind our local server). */
  trustProxyHeaders?: boolean;
};

const BASE_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const json = (body: ConfigResponse | MessageResponse | ProxyError, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
const fail = (status: number, errors: ApiError[], action?: unknown, extra: Record<string, string> = {}) =>
  json(action === "config" ? { ok: false, errors, attempts: 0 } : { ok: false, errors }, status, extra);

/** Best-effort in-memory token bucket per key (per server instance; serverless instances do not share it). */
export function createRateLimiter(perMinute: number, now: () => number = Date.now) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const refillPerMs = perMinute / 60000;
  return {
    take(key: string): { ok: true } | { ok: false; retryAfterS: number } {
      const t = now();
      if (buckets.size > 10000) for (const [k, b] of buckets) if (t - b.at > 120000) buckets.delete(k);
      const b = buckets.get(key) ?? { tokens: perMinute, at: t };
      b.tokens = Math.min(perMinute, b.tokens + (t - b.at) * refillPerMs);
      b.at = t;
      buckets.set(key, b);
      if (b.tokens >= 1) { b.tokens -= 1; return { ok: true }; }
      return { ok: false, retryAfterS: Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000)) };
    },
  };
}

function clientIp(req: Request, trust: boolean): string {
  if (trust) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim().slice(0, 64) || "unknown";
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "local";
}

/** Same-origin check: if the browser sent Origin, it must equal this request's own origin. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin GET/navigation or server-to-server; no CORS grant is ever sent
  let self: string;
  try { self = new URL(req.url).origin; } catch { return false; }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto");
  const candidates = new Set([self]);
  if (host) { candidates.add(`${proto ?? new URL(req.url).protocol.replace(":", "")}://${host}`); candidates.add(`https://${host}`); }
  return candidates.has(origin);
}

async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export function createApertoHandler(opts: HandlerOptions = {}): (req: Request) => Promise<Response> {
  const envRate = Number((opts.env ?? process.env).APERTUS_RATE_PER_MINUTE);
  const rate = opts.ratePerMinute ?? (Number.isFinite(envRate) && envRate >= 1 ? envRate : PROXY_LIMITS.ratePerMinute);
  const limiter = createRateLimiter(rate, opts.now);
  const trust = opts.trustProxyHeaders ?? true;
  return async function apertoHandler(req: Request): Promise<Response> {
    try {
      if (req.method !== "POST") return fail(405, [{ path: "request", message: "use POST" }], undefined, { allow: "POST" });
      if (!sameOrigin(req)) return fail(403, [{ path: "request", message: "cross-origin requests are not allowed" }]);
      if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return fail(415, [{ path: "request", message: "Content-Type must be application/json" }]);
      const rl = limiter.take(clientIp(req, trust));
      if (!rl.ok) return fail(429, [{ path: "request", message: "too many requests, try again shortly" }], undefined, { "retry-after": String(rl.retryAfterS) });
      const raw = await readCapped(req, PROXY_LIMITS.maxBodyBytes);
      if (raw === null) return fail(413, [{ path: "request", message: `body larger than ${PROXY_LIMITS.maxBodyBytes} bytes` }]);
      let body: any;
      try { body = JSON.parse(raw); } catch { return fail(400, [{ path: "request", message: "body must be JSON" }]); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, [{ path: "request", message: "body must be a JSON object" }]);
      const action = body.action;
      if (action !== "config" && action !== "message") return fail(400, [{ path: "action", message: 'must be "config" or "message"' }]);
      const lang = body.lang as Lang;
      if (!LANGS.includes(lang)) return fail(400, [{ path: "lang", message: "must be one of it, de, fr, en" }], action);

      const env = opts.env ?? process.env;
      const client = clientFromEnv(env, opts.fetch);

      if (action === "config") {
        const text = body.text;
        if (typeof text !== "string" || !text.trim()) return fail(400, [{ path: "text", message: "is required" }], action);
        if (text.length > PROXY_LIMITS.maxTextChars) return fail(400, [{ path: "text", message: `must be at most ${PROXY_LIMITS.maxTextChars} characters` }], action);
        if (!client) return fail(503, [{ path: "model", message: "No model configured on the server (APERTUS_BASE_URL + APERTUS_MODEL, or APERTUS_MOCK=1)" }], action);
        const r = await generateConfig(text, lang, { client });
        const out: ConfigResponse = r.ok ? { ok: true, config: r.config, attempts: r.attempts, warnings: r.warnings } : { ok: false, errors: r.errors, attempts: r.attempts };
        return json(scrub(out, env));
      }

      const v = validateConfig(body.config);
      if (!v.ok) return fail(400, v.errors.map((e) => ({ path: e.path ? `config.${e.path}` : "config", message: e.message })));
      const qa = quoteAmounts(v.config, body.quote);
      if (!qa.ok) return fail(400, qa.errors);
      const d = await draftMessage(v.config, body.quote, lang, { client });
      return json(scrub({ ok: true, text: d.text, source: d.source }, env));
    } catch {
      return fail(500, [{ path: "", message: "internal error" }]);
    }
  };
}

/** Defence in depth: never let the key leave the server, whatever an upstream error echoed. */
function scrub<T extends ConfigResponse | MessageResponse>(body: T, env: Env): T {
  const key = readApertusEnv(env).apiKey;
  if (!key || key.length < 6) return body;
  return JSON.parse(JSON.stringify(body).split(key).join("[redacted]"));
}

/** Default handler (reads process.env, module-level rate limiter). */
export const handler = createApertoHandler();
export const POST = handler;
export default { fetch: handler };
