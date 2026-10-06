import { describe, expect, test } from "bun:test";
import { startServer } from "../../../harness/server.ts";
import vercelEntry from "../../../apps/web/api/aperto.ts";

describe("local wiring: harness server on 127.0.0.1 routes POST /api/aperto (no model call in these checks)", () => {
  test("/api/aperto answers with the contract envelope; static routes still work", async () => {
    const s = await startServer({ port: 0 });
    try {
      const bad = await fetch(`${s.url}/api/aperto`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "config", text: "", lang: "de" }) });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ ok: false, attempts: 0 });
      const big = await fetch(`${s.url}/api/aperto`, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(5000) });
      expect(big.status).toBe(413);
      const get = await fetch(`${s.url}/api/aperto`);
      expect(get.status).toBe(405);
      expect((await fetch(`${s.url}/harness/plain.html`)).status).toBe(200);
    } finally { await s.close(); }
  });
});

test("Vercel entry apps/web/api/aperto.ts exports the Web fetch handler", async () => {
  expect(typeof vercelEntry.fetch).toBe("function");
  const r = await vercelEntry.fetch(new Request("https://preview.example/api/aperto"));
  expect(r.status).toBe(405);
});
