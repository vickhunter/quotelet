import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeQuote, validateConfig } from "../../core/src/index.ts";
import { loadCases, mapAnswers, quotesMatch, runEval, profilesFromEnv } from "../eval/lib.ts";

const cases = loadCases();

describe("eval fixtures: 30 synthetic price lists with gold configs", () => {
  test("30 lists: IT 10, DE 8, FR 6, EN 6; 3 inputs each", () => {
    expect(cases.length).toBe(30);
    const by = (l: string) => cases.filter((c) => c.lang === l).length;
    expect([by("it"), by("de"), by("fr"), by("en")]).toEqual([10, 8, 6, 6]);
    for (const c of cases) expect(c.inputs.length).toBe(3);
    expect(new Set(cases.map((c) => c.id)).size).toBe(30);
  });
  test("every gold config is valid and gives a positive quote on every input", () => {
    for (const c of cases) {
      const v = validateConfig(c.gold);
      expect({ id: c.id, ok: v.ok, errors: v.ok ? [] : v.errors }).toEqual({ id: c.id, ok: true, errors: [] });
      for (const a of c.inputs) {
        const q = computeQuote(c.gold, a);
        expect(q.error).toBeNull();
        expect(q.lowCents).toBeGreaterThan(0);
      }
    }
  });
  test("mix of CHF (de-CH, fr-CH, it-CH) and EUR it-IT; demo text present; some ambiguous", () => {
    const locales = new Set(cases.map((c) => c.gold.locale));
    for (const l of ["de-CH", "fr-CH", "it-CH", "it-IT"]) expect(locales.has(l)).toBe(true);
    expect(cases.some((c) => c.text === "Umzug: 45 CHF pro m³, +20 CHF pro Stockwerk ohne Lift, mindestens 300 CHF, MwSt 8.1% inklusive")).toBe(true);
    expect(cases.filter((c) => c.ambiguous).length).toBeGreaterThanOrEqual(3);
  });
});

describe("eval scoring", () => {
  test("mapAnswers maps gold answers onto generated fields with other ids", () => {
    const c = cases.find((x) => x.text.startsWith("Umzug: 45 CHF"))!;
    const gen = JSON.parse(JSON.stringify(c.gold));
    const rename: Record<string, string> = {};
    gen.fields.forEach((f: any, i: number) => { rename[f.id] = `f${i}_x`; });
    for (const [a, b] of Object.entries(rename)) gen.formula = gen.formula.replace(new RegExp(`\\b${a}\\b`, "g"), b);
    gen.fields.forEach((f: any) => { f.id = rename[f.id]; });
    gen.fields.reverse();
    expect(validateConfig(gen).ok).toBe(true);
    for (const a of c.inputs) expect(quotesMatch(computeQuote(c.gold, a), computeQuote(gen, mapAnswers(c.gold, gen, a)))).toBe(true);
  });
  test("quotesMatch tolerance: 1% or 1 currency unit", () => {
    const q = (low: number, high: number) => ({ lowCents: low, highCents: high, vat: { lowGrossCents: low, highGrossCents: high } }) as any;
    expect(quotesMatch(q(100000, 120000), q(100500, 120000))).toBe(true);
    expect(quotesMatch(q(100000, 120000), q(103000, 120000))).toBe(false);
    expect(quotesMatch(q(5000, 6000), q(5100, 6000))).toBe(true);
  });
});

describe("eval harness", () => {
  test("no env -> skip (configured profiles empty)", () => {
    expect(profilesFromEnv({})).toEqual([]);
    expect(profilesFromEnv({ APERTUS_BASE_URL: "https://x/v1", APERTUS_MODEL_SMALL: "a8", APERTUS_MODEL_LARGE: "a70" }).map((p) => p.model)).toEqual(["a8", "a70"]);
    expect(profilesFromEnv({ APERTUS_BASE_URL: "https://x/v1", APERTUS_MODEL: "a" }).map((p) => p.model)).toEqual(["a"]);
  });
  test("--dry runs the recorded fixtures for both profiles and writes the report", async () => {
    const out = mkdtempSync(join(tmpdir(), "aperto-eval-"));
    const r = await runEval({ dry: true, outDir: out, date: "2026-10-06", log: () => {} });
    expect(r.models.length).toBe(2);
    for (const m of r.models) {
      expect(m.cases).toBe(30);
      expect(m.validRate).toBeGreaterThan(0.5);
      expect(m.matchRate).toBeGreaterThan(0);
      expect(m.tokensIn).toBeGreaterThan(0);
    }
    const md = readFileSync(r.file, "utf8");
    expect(r.file.endsWith("aperto-eval-2026-10-06-dry.md")).toBe(true);
    expect(md).toContain("DRY RUN");
    expect(md).toContain("| Model |");
  });
});
