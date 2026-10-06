// Local static server for the D-003 harness (BDD + sims). node:http so it runs under Bun and Node.
// Routes: /quotelet.js -> dist/quotelet.js, /harness/*, /fixtures/*, /templates/*, and /q -> the
// harness share page (the real /q page is D-004's apps/web), POST /api/aperto (H-01). Binds 127.0.0.1 only.
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { APERTO_PATH, nodeAperto } from "../packages/aperto/src/local.ts";

export const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml",
};
const MOUNTS: Record<string, string> = { "/harness/": "harness", "/fixtures/": "fixtures", "/templates/": "templates" };

function safeFile(dir: string, rel: string): string | null {
  const base = join(ROOT, dir);
  const file = normalize(join(base, rel));
  if (file !== base && !file.startsWith(base + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

export function resolvePath(pathname: string): string | null {
  if (pathname === "/quotelet.js") return safeFile("dist", "quotelet.js");
  if (pathname === "/q" || pathname === "/q/") return safeFile("harness", "share.html");
  if (pathname === "/" ) return safeFile("harness", "index.html");
  for (const [prefix, dir] of Object.entries(MOUNTS)) if (pathname.startsWith(prefix)) return safeFile(dir, decodeURIComponent(pathname.slice(prefix.length)));
  return null;
}

export function startServer(opts: { port?: number; host?: string } = {}): Promise<{ server: Server; url: string; close(): Promise<void> }> {
  const host = opts.host ?? "127.0.0.1";
  const aperto = nodeAperto();
  const server = createServer((req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://x");
      // H-01: POST /api/aperto (Apertus proxy; APERTUS_MOCK=1 = recorded answers, no key).
      if (u.pathname === APERTO_PATH) { aperto(req, res).catch(() => { if (!res.headersSent) res.writeHead(500).end(); }); return; }
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { allow: "GET, HEAD" }).end(); return; }
      const file = resolvePath(u.pathname);
      if (!file) { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : readFileSync(file));
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((ok, ko) => {
    server.once("error", ko);
    server.listen(opts.port ?? 0, host, () => {
      const a = server.address();
      const port = typeof a === "object" && a ? a.port : opts.port;
      ok({ server, url: `http://${host}:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

/** Try the design's port 4173 first; fall back to a free port if something (e.g. D-004's dev server) holds it. */
export async function startHarness(): Promise<{ url: string; close(): Promise<void> }> {
  try { return await startServer({ port: Number(process.env.QL_HARNESS_PORT ?? 4173) }); } catch { return await startServer({ port: 0 }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer({ port: Number(process.env.PORT ?? 4173) });
  console.log(`Quotelet harness on ${s.url}/harness/plain.html (widget at ${s.url}/quotelet.js)`);
}
