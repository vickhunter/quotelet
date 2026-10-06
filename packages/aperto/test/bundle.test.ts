// The Vercel function must be self-contained: one ESM file with core + aperto + the mock recordings
// inlined (no fs reads relative to the source tree, no .ts imports). Proven under Node (Vercel runtime).
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { bundleVercelFunction } from "../scripts/bundle-vercel.ts";
import { EXAMPLES } from "../src/examples.ts";

const mover = EXAMPLES.find((e) => e.id === "mover-lugano")!;

describe("Vercel pre-bundle (api/aperto.mjs)", () => {
  test("one ESM file, no relative/.ts imports, no secrets; answers both actions with APERTUS_MOCK=1 under Node", async () => {
    const out = mkdtempSync(join(tmpdir(), "aperto-vercel-"));
    const file = await bundleVercelFunction(out);
    expect(file.endsWith(join("api", "aperto.mjs"))).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/from\s+["']\.{1,2}\//);
    expect(src).not.toMatch(/\.ts["']/);
    expect(src).not.toMatch(/sk-[A-Za-z0-9]{16,}|hf_[A-Za-z0-9]{20,}/);
    const script = `
      const mod = await import(${JSON.stringify(file)});
      const h = mod.default.fetch;
      const post = (b, o = {}) => h(new Request("https://p.example/api/aperto", { method: "POST", headers: { "content-type": "application/json", ...o }, body: typeof b === "string" ? b : JSON.stringify(b) }));
      const c = await (await post({ action: "config", text: ${JSON.stringify(mover.text)}, lang: "de" })).json();
      const quote = { lowCents: 86000, highCents: 106000, vat: { rate: 8.1, pricesInclude: true, lowGrossCents: 86000, highGrossCents: 106000 } };
      const m = await (await post({ action: "message", config: c.config, quote, lang: "it" })).json();
      const big = (await post("x".repeat(5000))).status;
      const foreign = (await post({ action: "config", text: "x", lang: "de" }, { origin: "https://evil.example" })).status;
      console.log(JSON.stringify({ ok: c.ok, fields: c.config?.fields?.length, mok: m.ok, text: m.text, big, foreign }));`;
    const r = spawnSync("node", ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 20000, env: { ...process.env, APERTUS_MOCK: "1", APERTUS_BASE_URL: "", APERTUS_MODEL: "" } });
    expect(r.stderr).toBe("");
    const j = JSON.parse(r.stdout.trim());
    expect(j).toMatchObject({ ok: true, fields: 4, mok: true, big: 413, foreign: 403 });
    expect(j.text).toContain("CHF 860.00");
    expect(j.text).toContain("CHF 1\u2019060.00"); // U+2019 under Node too (core formatMoney)
    expect(j.text).not.toContain("1'060");
  }, 30000);
});
