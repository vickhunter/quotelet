import { describe, expect, test } from "bun:test";
import { computeQuote, validateConfig } from "../../core/src/index.ts";
import { createApertoHandler } from "../src/proxy.ts";
import { createMockFetch } from "../src/mock.ts";
import { EXAMPLES } from "../src/examples.ts";
import { noNetwork } from "./helpers.ts";

const ORIGIN = "http://127.0.0.1:4173";
const mover = EXAMPLES.find((e) => e.id === "mover-lugano")!;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/aperto`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const mockHandler = (extra: Record<string, string> = {}) => createApertoHandler({ env: { APERTUS_MOCK: "1", ...extra } });

describe("POST /api/aperto proxy (Web Request -> Response)", () => {
  test("config: Lugano mover text -> {ok:true, config, attempts, warnings} with APERTUS_MOCK=1", async () => {
    const res = await mockHandler()(post({ action: "config", text: mover.text, lang: "de" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const j: any = await res.json();
    expect(j.ok).toBe(true);
    expect(j.attempts).toBe(1);
    expect(Array.isArray(j.warnings)).toBe(true);
    expect(validateConfig(j.config).ok).toBe(true);
    expect(Object.keys(j).sort()).toEqual(["attempts", "config", "ok", "warnings"]);
  });

  test("config: broken text -> {ok:false, errors:[{path,message}], attempts:2}", async () => {
    const b = EXAMPLES.find((e) => e.id === "broken-sundays")!;
    const j: any = await (await mockHandler()(post({ action: "config", text: b.text, lang: "en" }))).json();
    expect(j.ok).toBe(false);
    expect(j.attempts).toBe(2);
    expect(j.errors.length).toBeGreaterThan(0);
    for (const e of j.errors) expect(Object.keys(e).sort()).toEqual(["message", "path"]);
  });

  test("message: {ok:true, text, source} with core amounts", async () => {
    const cfg: any = (await (await mockHandler()(post({ action: "config", text: mover.text, lang: "de" }))).json()).config;
    const quote = computeQuote(cfg, { volumen: 20, etage_auszug: 3, ohne_lift: true });
    const j: any = await (await mockHandler()(post({ action: "message", config: cfg, quote, lang: "it" }))).json();
    expect(j.ok).toBe(true);
    expect(["model", "template"]).toContain(j.source);
    expect(j.text).toContain(quote.display.low.replace(/[\u00a0\u202f]/g, " "));
    expect(Object.keys(j).sort()).toEqual(["ok", "source", "text"]);
  });

  test("message without any model env -> template, still ok:true", async () => {
    const h = createApertoHandler({ env: {}, fetch: noNetwork });
    const cfg: any = (await (await mockHandler()(post({ action: "config", text: mover.text, lang: "de" }))).json()).config;
    const j: any = await (await h(post({ action: "message", config: cfg, quote: computeQuote(cfg, {}), lang: "fr" }))).json();
    expect(j).toMatchObject({ ok: true, source: "template" });
  });

  test("message: invalid config -> 400 {ok:false, errors}", async () => {
    const res = await mockHandler()(post({ action: "message", config: { v: 1 }, quote: {}, lang: "it" }));
    expect(res.status).toBe(400);
    const j: any = await res.json();
    expect(j.ok).toBe(false);
    expect(j.errors.length).toBeGreaterThan(0);
  });

  test("config without env and without mock -> clear ok:false (503), never a crash", async () => {
    const res = await createApertoHandler({ env: {}, fetch: noNetwork })(post({ action: "config", text: mover.text, lang: "de" }));
    expect(res.status).toBe(503);
    const j: any = await res.json();
    expect(j).toMatchObject({ ok: false, attempts: 0 });
    expect(j.errors[0].path).toBe("model");
  });

  test("body > 4 KB -> 413 (by content-length and by actual size)", async () => {
    const big = JSON.stringify({ action: "config", text: "x".repeat(5000), lang: "de" });
    expect((await mockHandler()(post(big))).status).toBe(413);
    const lying = new Request(`${ORIGIN}/api/aperto`, { method: "POST", headers: { "content-type": "application/json", "content-length": "10" }, body: big });
    expect((await mockHandler()(lying)).status).toBe(413);
  });

  test("bad requests -> 400 with errors", async () => {
    const h = mockHandler();
    expect((await h(post("{not json"))).status).toBe(400);
    expect((await h(post({ action: "nope" }))).status).toBe(400);
    expect((await h(post({ action: "config", text: mover.text, lang: "es" }))).status).toBe(400);
    expect((await h(post({ action: "config", text: 42, lang: "de" }))).status).toBe(400);
    const j: any = await (await h(post({ action: "config", text: "", lang: "de" }))).json();
    expect(j).toMatchObject({ ok: false, attempts: 0 });
  });

  test("method and content-type: GET -> 405, text/plain -> 415, OPTIONS gets no CORS grant", async () => {
    const h = mockHandler();
    expect((await h(new Request(`${ORIGIN}/api/aperto`))).status).toBe(405);
    expect((await h(new Request(`${ORIGIN}/api/aperto`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }))).status).toBe(415);
    const opt = await h(new Request(`${ORIGIN}/api/aperto`, { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(opt.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("CORS same-origin: a cross-site Origin is refused (403); same origin is fine; no ACAO header ever", async () => {
    const h = mockHandler();
    const bad = await h(post({ action: "config", text: mover.text, lang: "de" }, { origin: "https://evil.example" }));
    expect(bad.status).toBe(403);
    const good = await h(post({ action: "config", text: mover.text, lang: "de" }, { origin: ORIGIN }));
    expect(good.status).toBe(200);
    expect(good.headers.get("access-control-allow-origin")).toBeNull();
    expect(good.headers.get("cache-control")).toBe("no-store");
    expect((await h(post({ action: "config", text: mover.text, lang: "de" }, { origin: "null" }))).status).toBe(403);
  });

  test("per-IP token bucket: 10/min, 11th -> 429 with Retry-After; other IPs unaffected; refills", async () => {
    let now = 1_000_000;
    const h = createApertoHandler({ env: { APERTUS_MOCK: "1" }, now: () => now });
    const body = { action: "config", text: mover.text, lang: "de" };
    for (let i = 0; i < 10; i++) expect((await h(post(body))).status).toBe(200);
    const limited = await h(post(body));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await h(post(body, { "x-forwarded-for": "198.51.100.1" }))).status).toBe(200);
    now += 6_000; // one token per 6 s
    expect((await h(post(body))).status).toBe(200);
  });

  test("the API key never appears in any response, even on upstream errors", async () => {
    const key = "sk-very-secret-key-123";
    const h = createApertoHandler({ env: { APERTUS_BASE_URL: "https://up.example/v1", APERTUS_MODEL: "m", APERTUS_API_KEY: key }, fetch: async () => new Response(`invalid key ${key}`, { status: 401 }) });
    const res = await h(post({ action: "config", text: mover.text, lang: "de" }));
    const txt = await res.text();
    expect(txt).not.toContain(key);
    expect(JSON.parse(txt).ok).toBe(false);
  });

  test("real endpoint path is used when env is set (transport injected; no network)", async () => {
    const mock = createMockFetch();
    let url = "";
    const h = createApertoHandler({ env: { APERTUS_BASE_URL: "https://up.example/v1", APERTUS_MODEL: "apertus-70b" }, fetch: async (u, init) => { url = u; return mock(u, init); } });
    const j: any = await (await h(post({ action: "config", text: mover.text, lang: "de" }))).json();
    expect(url).toBe("https://up.example/v1/chat/completions");
    expect(j.ok).toBe(true);
  });
});
