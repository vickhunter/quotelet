// Local wiring for /api/aperto on 127.0.0.1:4173 (scripts/serve.ts and harness/server.ts).
// Loads the git-ignored .env.local; APERTUS_MOCK=1 replays recorded answers (no key needed).
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnvLocal, readApertusEnv } from "./env.ts";
import { createApertoHandler } from "./proxy.ts";

export const APERTO_PATH = "/api/aperto";

/** Handler for local servers: reads .env.local once; generous rate limit in mock mode so BDD runs don't hit 429. */
export function localApertoHandler(): (req: Request) => Promise<Response> {
  const env = loadEnvLocal();
  const e = readApertusEnv(env);
  const rate = Number(env.APERTUS_RATE_PER_MINUTE) || (e.mock && !e.configured ? 600 : undefined);
  // Local servers are hit directly by the browser, so X-Forwarded-For is not trusted here.
  return createApertoHandler({ env, ratePerMinute: rate, trustProxyHeaders: false });
}

/** node:http adapter (harness/server.ts). Reads at most 4 KB + 1 byte before handing over. */
export function nodeAperto(handler = localApertoHandler()) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) { size += (c as Buffer).length; if (size > 4097) break; chunks.push(c as Buffer); }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const host = req.headers.host ?? "127.0.0.1";
    const method = req.method ?? "GET";
    if (size > 4096) {
      res.writeHead(413, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: false, errors: [{ path: "request", message: "body larger than 4096 bytes" }] }));
      return;
    }
    const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
    const r = await handler(new Request(`http://${host}${req.url ?? "/"}`, { method, headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
    res.end(Buffer.from(await r.arrayBuffer()));
  };
}
