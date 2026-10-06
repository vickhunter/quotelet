import { describe, expect, test } from "bun:test";
import { decodeConfig, validateConfig, compileFormula } from "../src/index.ts";
import { ERRORS, errorCode, localizeError, localizePath } from "../src/errors.ts";
import { ENGLISH_WORDS } from "../../../apps/web/src/lib/englishWords.ts"; // repo EN word list (read-only)

const LANGS = ["en", "it", "de", "fr"] as const;
// German/French words that are also on the EN list.
const ALSO_DE_FR = new Set(["name", "total", "message", "option", "options", "start", "code", "default", "type", "position"]);
const englishIn = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w && ENGLISH_WORDS.has(w) && !ALSO_DE_FR.has(w));
const params = (tpl: string) => (tpl.match(/%\d/g) ?? []).sort();
const fill = (tpl: string) => tpl.replace(/%(\d)/g, (_, i) => ["7", "12"][Number(i)]);

// Invalid inputs that between them hit every message the validator, decoder and formula parser can produce.
const base = () => ({ v: 1, id: "umzug", locale: "de-CH", currency: "CHF", title: "Umzug", business: { name: "Muster" }, fields: [{ id: "volumen", type: "number", label: "Volumen", min: 1, max: 100 }], formula: "volumen * 45" });
const FORMULAS = ["volumen +", "volumen = 2", "volumen $ 2", "if(volumen > 2, 1", "max(", "round(1, 2)", "min()", "if(volumen, 1)", "volumen > 2", "volumen 2", "abc", "((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))", "", "x".repeat(2000), "round", "1 / 0", ")", "volumen # 2", "max(1, 2", "max(1 2)", "round(volumen"];
function corpus(): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const add = (r: any) => { if (!r.ok) out.push(...r.errors); else out.push(...r.warnings); };
  add(validateConfig(null));
  add(validateConfig({
    v: 2, id: "Bad Id", locale: "??", currency: "eur", title: "", business: { name: "x".repeat(200), whatsapp: "12", email: "nope" },
    fields: [
      { id: "1x", type: "number", label: "\u0001", min: "a", max: 3, step: -1, unit: 5, default: "z" },
      { id: "max", type: "choice", label: "A", options: [5, { label: "", value: "x" }], default: 9 },
      { id: "dup", type: "toggle", label: "B", on: "x", off: null, default: "yes" },
      { id: "dup", type: "radio", label: "C" },
      7,
      { id: "n", type: "number", label: "D", min: 5, max: 1, default: 3 },
    ],
    formula: 5, range: { low: 2, high: 1 }, rounding: 0.001, vat: { rate: 200, pricesInclude: 1, show: "y" }, disclaimer: 7, branding: "no",
  }));
  add(validateConfig({ ...base(), currency: "XXQ", business: { name: "M", whatsapp: {} }, fields: "x" }));
  add(validateConfig({ ...base(), business: "x", fields: [], vat: 5, title: 7 }));
  add(validateConfig({ ...base(), fields: [{ id: "a", type: "choice", label: "A", options: "x" }, { id: "b", type: "choice", label: "B", options: [{ label: "x", value: 1 }], default: 3 }] }));
  add(validateConfig({ ...base(), disclaimer: "x".repeat(70000) }));
  add(validateConfig({ ...base(), formula: "volumen / (volumen - volumen)" }));
  for (const f of FORMULAS) add(validateConfig({ ...base(), formula: f }));
  for (const s of [5 as any, "", "x".repeat(9000), "a$b", "_____", "gA", btoa("{bad json").replace(/=+$/, "")]) add(decodeConfig(s));
  add(validateConfig({ ...base(), title: undefined }));
  for (const f of [5, null]) { const r: any = compileFormula(f as any, []); if (!r.ok) out.push({ path: "formula", message: r.error.message }); }
  const c = compileFormula("1 / 0", []); if (c.ok) c.warnings.forEach((w) => out.push({ path: "formula", message: w }));
  return out;
}
const WIDGET_MESSAGES = ["No config given (expected a config object or a base64url string)", "The calculator could not start", "Config request failed (HTTP 404)", "Config file is too large", "Config could not be loaded"];

describe("config error messages: stable codes + it/en/de/fr display text", () => {
  test("parity: every code has non-empty it/en/de/fr text with the same placeholders", () => {
    const codes = Object.keys(ERRORS);
    expect(codes.length).toBeGreaterThan(50);
    for (const code of codes) {
      const t = ERRORS[code];
      for (const l of LANGS) expect({ code, l, ok: typeof t[l] === "string" && t[l].trim().length > 0 }).toEqual({ code, l, ok: true });
      for (const l of LANGS) expect({ code, l, p: params(t[l]) }).toEqual({ code, l, p: params(t.en) });
    }
  });

  test("every message the validator, decoder, formula parser and widget produce maps to a code", () => {
    const all = [...corpus().map((e) => e.message), ...WIDGET_MESSAGES];
    expect(all.length).toBeGreaterThan(60);
    const unmapped = [...new Set(all.filter((m) => errorCode(m) === null))];
    expect(unmapped).toEqual([]);
    // and the corpus exercises (almost) every code
    // nested formula errors count too: 'Unknown identifier "x" (at position 0)' uses formulaAt + unknownId
    const used = new Set(all.flatMap((m) => [errorCode(m), errorCode(m.replace(/ \(at position \d+\)$/, ""))]));
    const unused = Object.keys(ERRORS).filter((c) => !used.has(c));
    // defensive catch-alls that valid inputs cannot reach on current runtimes
    expect(unused.filter((c) => !["currencyUnsupported", "notValidated", "encRead", "formulaParse"].includes(c))).toEqual([]);
  });

  test("the machine-readable shape is unchanged: {path, message} with the English message", () => {
    const r: any = validateConfig({ ...base(), fields: [{ id: "volumen", type: "number", label: "Volumen", min: "a", max: 100 }], formula: "volumne * 2" });
    expect(r.ok).toBe(false);
    for (const e of r.errors) expect(Object.keys(e).sort()).toEqual(["message", "path"]);
    expect(JSON.parse(JSON.stringify(r.errors))).toEqual([
      { path: "fields[0].min", message: "must be a number" },
      { path: "formula", message: 'Unknown identifier "volumne" (at position 0)' },
    ]);
  });

  test("English display is exactly 'path: message' (unchanged); de/fr/it are translated, nested formula errors included", () => {
    const e = { path: "formula", message: 'Unknown identifier "volumne" (at position 0)' };
    expect(localizeError(e, "en-US")).toBe('formula: Unknown identifier "volumne" (at position 0)');
    for (const l of ["de-CH", "fr-CH", "it-IT"]) {
      const s = localizeError(e, l);
      expect(s).toContain('"volumne"');
      expect(s).toContain("0");
      expect(s).not.toContain("Unknown");
    }
    expect(localizeError({ path: "fields[2].options[0].label", message: "is required" }, "de-CH")).toBe("Feld 3 \u203a Option 1 \u203a Bezeichnung: ist erforderlich");
    expect(localizePath("fields[0].min", "fr-CH")).toBe("champ 1 \u203a minimum");
    expect(localizePath("fields[0].min", "en")).toBe("fields[0].min");
    // unknown message in de/fr: generic localized text, never English
    expect(englishIn(localizeError({ path: "", message: "JSON Parse error: Unexpected EOF" }, "de-CH"))).toEqual([]);
  });

  for (const lang of ["de-CH", "fr-CH", "de", "fr", "de-DE", "fr-FR", "it-CH", "it-IT"]) {
    test(`${lang}: every error text and every path in the corpus has zero English words`, () => {
      const lines = [...corpus(), ...WIDGET_MESSAGES.map((message) => ({ path: "", message }))].map((e) => localizeError(e, lang));
      const bad = lines.map((l) => ({ l, en: englishIn(l) })).filter((x) => x.en.length);
      expect(bad).toEqual([]);
      for (const code of Object.keys(ERRORS)) expect(englishIn(fill(ERRORS[code][lang.slice(0, 2) as "de" | "fr" | "it"]))).toEqual([]);
    });
  }

  test("Swiss German: ss, never the sharp s", () => {
    for (const code of Object.keys(ERRORS)) expect(ERRORS[code].de).not.toContain("\u00df");
    expect(localizePath("fields[0].options[1].value", "de")).not.toContain("\u00df");
  });
});
