// One money formatter for every runtime (Bun, Node, browsers, Vercel): Swiss grouping is always
// U+2019 (right single quotation mark), never U+0027 or a narrow space, whatever the ICU version prints.
import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { computeQuote, formatMoney, formatNumber, buildLeadMessage } from "../src/index.ts";

const NB = "\u00a0";
const Q = "\u2019";
// [cents, currency, locale, expected]: expected is identical on every runtime.
const CASES: [number, string, string, string][] = [
  [106000, "CHF", "de-CH", `CHF${NB}1${Q}060.00`],
  [106000, "CHF", "fr-CH", `1${Q}060.00${NB}CHF`],
  [123456750, "CHF", "it-CH", `CHF${NB}1${Q}234${Q}567.50`],
  [106000, "CHF", "en-CH", `CHF${NB}1${Q}060.00`],
  [106000, "EUR", "de-CH", `EUR${NB}1${Q}060.00`],
  [106000, "EUR", "it-IT", `1060,00${NB}\u20ac`],
  [123456750, "EUR", "it-IT", `1.234.567,50${NB}\u20ac`],
  [106000, "EUR", "de-DE", `1.060,00${NB}\u20ac`],
  [106000, "EUR", "en-IE", `\u20ac1,060.00`],
  [-500, "CHF", "de-CH", `CHF-5.00`],
];

describe("formatMoney / formatNumber (core, single source for amounts)", () => {
  test("Swiss grouping is U+2019 under Bun; other locales unchanged", () => {
    for (const [c, cur, loc, want] of CASES) expect(formatMoney(c, cur, loc)).toBe(want);
    expect(formatMoney(106000, "CHF", "de-CH")).not.toContain("'");
    expect(formatNumber(12345, "fr-CH")).toBe(`12${Q}345`);
    expect(formatNumber(8.1, "de-CH")).toBe("8.1");
  });

  test("computeQuote and buildLeadMessage use it (1\u2019060.00, never 1'060.00)", () => {
    const config: any = { v: 1, id: "umzug", locale: "de-CH", currency: "CHF", title: "Umzug", business: { name: "Umzug" },
      fields: [{ id: "v", type: "number", label: "m3", min: 1, max: 100, default: 20 }], formula: "v * 53", range: { low: 1, high: 1 }, rounding: 1,
      vat: { rate: 8.1, pricesInclude: true, show: true } };
    const q = computeQuote(config, { v: 20 });
    expect(q.display.low).toBe(`CHF${NB}1${Q}060.00`);
    expect(q.display.low).toBe(formatMoney(q.lowCents, "CHF", "de-CH"));
    const msg = buildLeadMessage(config, q, { name: "Giulia" });
    expect(msg).toContain(`CHF 1${Q}060.00`);
    expect(msg).not.toContain("1'060");
  });

  test("the same strings under Node (built core bundle, node --input-type=module)", async () => {
    const out = mkdtempSync(join(tmpdir(), "core-money-"));
    const r = await Bun.build({ entrypoints: [join(import.meta.dir, "..", "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "core.mjs" });
    expect(r.success).toBe(true);
    const script = `const m = await import(${JSON.stringify(join(out, "core.mjs"))}); const cases = ${JSON.stringify(CASES)};
      console.log(JSON.stringify(cases.map(([c, cur, loc]) => m.formatMoney(c, cur, loc)).concat([m.formatNumber(12345, "fr-CH")])));`;
    const p = spawnSync("node", ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 20000 });
    expect(p.stderr).toBe("");
    expect(JSON.parse(p.stdout)).toEqual(CASES.map((x) => x[3]).concat([`12${Q}345`]));
  }, 30000);
});
