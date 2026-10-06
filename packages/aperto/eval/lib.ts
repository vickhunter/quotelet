// Eval harness: 30 synthetic price lists -> generateConfig per model -> valid-config rate,
// quote-match rate (computeQuote of generated vs gold on 3 inputs), latency, tokens.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeQuote, type Answers, type Config, type Field, type Quote } from "../../core/src/index.ts";
import { createClient } from "../src/client.ts";
import { readApertusEnv, REPO_ROOT, type Env } from "../src/env.ts";
import { generateConfig } from "../src/generate.ts";
import type { ChatClient, ChatResult, Lang } from "../src/types.ts";
import type { EvalCase } from "./cases.ts";

const FIX = join(import.meta.dir, "fixtures");
export function loadCases(): EvalCase[] { return JSON.parse(readFileSync(join(FIX, "pricelists.json"), "utf8")); }

// ---------------- scoring ----------------
const tokens = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
function score(g: Field, n: Field): number {
  if (g.type !== n.type) return -Infinity;
  let s = 0;
  if (g.id === n.id) s += 10;
  const gt = tokens(g.label + " " + g.id), nt = tokens(n.label + " " + n.id);
  for (const t of gt) if (nt.has(t)) s += 3;
  if (g.type === "number" && n.type === "number") {
    if ((g.unit ?? "") === (n.unit ?? "") && g.unit) s += 2;
    if (g.min < n.max && n.min < g.max) s += 1;
  } else if (g.type === "choice" && n.type === "choice") {
    if (g.options.length === n.options.length) s += 3;
    if (g.options.every((o) => n.options.some((p) => p.value === o.value))) s += 3;
  } else if (g.type === "toggle" && n.type === "toggle") {
    if (g.on === n.on && g.off === n.off) s += 4;
  }
  return s;
}

/** Map answers keyed by gold field ids onto the generated config's fields (greedy best match by type, id, label, unit, values). */
export function mapAnswers(gold: Config, gen: Config, answers: Answers): Answers {
  const pairs: { g: Field; n: Field; s: number }[] = [];
  for (const g of gold.fields) for (const n of gen.fields) { const s = score(g, n); if (s > -Infinity) pairs.push({ g, n, s }); }
  pairs.sort((a, b) => b.s - a.s);
  const usedG = new Set<string>(), usedN = new Set<string>();
  const out: Answers = {};
  for (const { g, n } of pairs) {
    if (usedG.has(g.id) || usedN.has(n.id)) continue;
    usedG.add(g.id); usedN.add(n.id);
    const a = answers[g.id];
    if (a === undefined) continue;
    if (g.type === "choice" && n.type === "choice") {
      const val = g.options[a as number]?.value;
      const j = n.options.findIndex((o) => o.value === val);
      out[n.id] = j >= 0 ? j : (a as number);
    } else out[n.id] = a;
  }
  return out;
}

const close = (gold: number, got: number) => Math.abs(gold - got) <= Math.max(100, Math.abs(gold) * 0.01);
/** Same currency (when known) and low/high, net and gross, within 1% or 1 currency unit (100 cents). */
export function quotesMatch(gold: Quote, got: Quote): boolean {
  if (gold.currency && got.currency && gold.currency !== got.currency) return false;
  if (got.error) return false;
  return close(gold.lowCents, got.lowCents) && close(gold.highCents, got.highCents)
    && close(gold.vat.lowGrossCents, got.vat.lowGrossCents) && close(gold.vat.highGrossCents, got.vat.highGrossCents);
}

// ---------------- profiles ----------------
export type Profile = { label: string; model: string; client: (ec: EvalCase) => ChatClient };

export function profilesFromEnv(env: Env, fetchImpl?: any): Profile[] {
  const e = readApertusEnv(env);
  if (!e.baseUrl) return [];
  const mk = (label: string, model: string): Profile => {
    const c = createClient({ baseUrl: e.baseUrl, model, apiKey: e.apiKey, fetch: fetchImpl, timeoutMs: Math.max(e.timeoutMs, 60000) });
    return { label, model, client: () => c };
  };
  const list: Profile[] = [];
  if (e.modelSmall) list.push(mk("small", e.modelSmall));
  if (e.modelLarge) list.push(mk("large", e.modelLarge));
  if (!list.length && (env.APERTUS_MODEL ?? "").trim()) list.push(mk("model", env.APERTUS_MODEL!.trim()));
  return list;
}

type Rec = { responses: string[]; usage: { promptTokens: number; completionTokens: number }[]; latencyMs: number[] };
export function dryProfiles(): Profile[] {
  const dry = JSON.parse(readFileSync(join(FIX, "recorded-dry.json"), "utf8")).profiles as Record<string, Record<string, Rec>>;
  return Object.keys(dry).sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""))).map((label) => ({
    label, model: `${label} (synthetic recorded answers)`,
    client: (ec: EvalCase): ChatClient => {
      const rec = dry[label][ec.id];
      let i = 0;
      return {
        model: label,
        async chat(): Promise<ChatResult> {
          const k = Math.min(i++, rec.responses.length - 1);
          return { content: rec.responses[k], usage: rec.usage[k], latencyMs: rec.latencyMs[k], model: label };
        },
      };
    },
  }));
}

// ---------------- run ----------------
export type CaseResult = { id: string; lang: Lang; ambiguous: boolean; valid: boolean; attempts: number; inputsMatched: number; latencyMs: number; tokensIn: number; tokensOut: number; errors: string[]; warnings: number };
export type ModelSummary = {
  label: string; model: string; cases: number; valid: number; validRate: number; firstTry: number; repaired: number;
  matched: number; matchRate: number; inputMatchRate: number; clearMatchRate: number; ambiguousMatchRate: number;
  latencyMeanMs: number; latencyP50Ms: number; latencyP95Ms: number; tokensIn: number; tokensOut: number; tokensPerCalc: number;
  byLang: Record<string, { cases: number; valid: number; matched: number }>; results: CaseResult[];
};

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const quantile = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export async function evalProfile(p: Profile, cases: EvalCase[], log: (s: string) => void = () => {}): Promise<ModelSummary> {
  const results: CaseResult[] = [];
  for (const ec of cases) {
    const r = await generateConfig(ec.text, ec.lang, { client: p.client(ec) });
    let inputsMatched = 0;
    if (r.ok) for (const a of ec.inputs) if (quotesMatch(computeQuote(ec.gold, a), computeQuote(r.config, mapAnswers(ec.gold, r.config, a)))) inputsMatched++;
    const res: CaseResult = {
      id: ec.id, lang: ec.lang, ambiguous: Boolean(ec.ambiguous), valid: r.ok, attempts: r.attempts, inputsMatched,
      latencyMs: r.trace.reduce((s, t) => s + t.latencyMs, 0),
      tokensIn: r.trace.reduce((s, t) => s + t.usage.promptTokens, 0), tokensOut: r.trace.reduce((s, t) => s + t.usage.completionTokens, 0),
      errors: r.ok ? [] : r.errors.filter((e) => e.path !== "text").slice(0, 2).map((e) => `${e.path || "config"}: ${e.message}`),
      warnings: r.ok ? r.warnings.length : 0,
    };
    results.push(res);
    log(`  ${p.label} ${ec.id}: ${res.valid ? "valid" : "INVALID"} (${res.attempts} att.) quotes ${res.inputsMatched}/3 ${res.latencyMs} ms`);
  }
  const n = results.length;
  const valid = results.filter((r) => r.valid).length;
  const full = (r: CaseResult) => r.inputsMatched === 3;
  const clear = results.filter((r) => !r.ambiguous), amb = results.filter((r) => r.ambiguous);
  const lat = results.map((r) => r.latencyMs);
  const byLang: ModelSummary["byLang"] = {};
  for (const r of results) { const b = (byLang[r.lang] ??= { cases: 0, valid: 0, matched: 0 }); b.cases++; if (r.valid) b.valid++; if (full(r)) b.matched++; }
  const tokensIn = results.reduce((s, r) => s + r.tokensIn, 0), tokensOut = results.reduce((s, r) => s + r.tokensOut, 0);
  return {
    label: p.label, model: p.model, cases: n, valid, validRate: n ? valid / n : 0,
    firstTry: results.filter((r) => r.valid && r.attempts === 1).length, repaired: results.filter((r) => r.valid && r.attempts === 2).length,
    matched: results.filter(full).length, matchRate: n ? results.filter(full).length / n : 0,
    inputMatchRate: n ? results.reduce((s, r) => s + r.inputsMatched, 0) / (3 * n) : 0,
    clearMatchRate: clear.length ? clear.filter(full).length / clear.length : 0, ambiguousMatchRate: amb.length ? amb.filter(full).length / amb.length : 0,
    latencyMeanMs: n ? Math.round(lat.reduce((a, b) => a + b, 0) / n) : 0, latencyP50Ms: quantile(lat, 0.5), latencyP95Ms: quantile(lat, 0.95),
    tokensIn, tokensOut, tokensPerCalc: n ? Math.round((tokensIn + tokensOut) / n) : 0, byLang, results,
  };
}

export function summaryTable(models: ModelSummary[], env: Env = {}): string {
  const pin = Number(env.APERTUS_PRICE_IN_PER_MTOK), pout = Number(env.APERTUS_PRICE_OUT_PER_MTOK);
  const cost = (m: ModelSummary) => Number.isFinite(pin) && Number.isFinite(pout) && pin >= 0 && pout >= 0 ? ((m.tokensIn * pin + m.tokensOut * pout) / 1e6 / m.cases).toFixed(5) : "n/a";
  const rows = models.map((m) => `| ${m.model} | ${m.valid}/${m.cases} (${pct(m.validRate)}) | ${m.firstTry} / ${m.repaired} | ${m.matched}/${m.cases} (${pct(m.matchRate)}) | ${pct(m.inputMatchRate)} | ${pct(m.clearMatchRate)} / ${pct(m.ambiguousMatchRate)} | ${(m.latencyP50Ms / 1000).toFixed(1)} s / ${(m.latencyP95Ms / 1000).toFixed(1)} s | ${m.tokensPerCalc} | ${cost(m)} |`);
  return ["| Model | Valid config | 1st try / after repair | Quote match (all 3 inputs) | Inputs matched | Clear / ambiguous lists | Latency p50 / p95 | Tokens per calculator | Cost per calculator |", "|---|---|---|---|---|---|---|---|---|", ...rows].join("\n");
}

export function renderReport(models: ModelSummary[], o: { date: string; dry: boolean; endpoint: string; env?: Env }): string {
  const L: string[] = [];
  L.push(`# Quotelet Aperto eval, ${o.date}${o.dry ? " (DRY RUN)" : ""}`, "");
  if (o.dry) L.push("> **DRY RUN: these numbers are NOT Apertus results.** The answers are synthetic (`packages/aperto/eval/fixtures/recorded-dry.json`, made from the gold configs with deliberate typical mistakes by `build-fixtures.ts`). This run only proves that the harness, the validator loop and the scoring work offline. Real 8B vs 70B numbers come from `bun run eval:aperto` with `APERTUS_BASE_URL` + `APERTUS_MODEL_SMALL`/`APERTUS_MODEL_LARGE` set.", "");
  L.push(`Endpoint: ${o.endpoint}. Cases: ${models[0]?.cases ?? 0} synthetic price lists (IT 10, DE 8, FR 6, EN 6; CHF de-CH/fr-CH/it-CH/en-CH and EUR it-IT/en-IE; 4 deliberately ambiguous), 3 test inputs each.`, "");
  L.push("Pipeline per list: prompt → JSON → `validateConfig` + `compileFormula` → one repair retry with the validator errors → hard fail. **The model never computes a price.** Quote match = `computeQuote(generated)` vs `computeQuote(gold)` on the 3 inputs (low/high, net and gross, same currency, within 1% or 1 currency unit). Answers are mapped onto the generated fields by type, id, label, unit and values. A list counts as matched only if all 3 inputs match. Latency and tokens are per calculator, including the repair call.", "");
  L.push("## Summary", "", summaryTable(models, o.env), "");
  L.push("## By language", "", "| Model | " + ["it", "de", "fr", "en"].map((l) => `${l.toUpperCase()} valid / match`).join(" | ") + " |", "|---|---|---|---|---|");
  for (const m of models) L.push(`| ${m.label} | ` + ["it", "de", "fr", "en"].map((l) => { const b = m.byLang[l] ?? { cases: 0, valid: 0, matched: 0 }; return `${b.valid}/${b.cases} / ${b.matched}/${b.cases}`; }).join(" | ") + " |");
  L.push("");
  for (const m of models) {
    L.push(`## Per list: ${m.label}`, "", "| List | Lang | Ambiguous | Valid | Attempts | Quotes matched | Latency | Tokens in/out | Errors |", "|---|---|---|---|---|---|---|---|---|");
    for (const r of m.results) L.push(`| ${r.id} | ${r.lang} | ${r.ambiguous ? "yes" : ""} | ${r.valid ? "yes" : "**no**"} | ${r.attempts} | ${r.inputsMatched}/3 | ${(r.latencyMs / 1000).toFixed(1)} s | ${r.tokensIn}/${r.tokensOut} | ${r.errors.join("; ").replace(/\|/g, "\\|")} |`);
    L.push("");
  }
  L.push("Rerun: `bun run eval:aperto` (real endpoint from env or `.env.local`), `bun run eval:aperto --dry` (offline harness proof). Source: `packages/aperto/eval/`.", "");
  return L.join("\n");
}

export async function runEval(o: { dry: boolean; outDir?: string; date?: string; log?: (s: string) => void; env?: Env; limit?: number; fetch?: any }): Promise<{ file: string; models: ModelSummary[] }> {
  const env = o.env ?? process.env;
  const log = o.log ?? console.log;
  const date = o.date ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const outDir = o.outDir ?? join(REPO_ROOT, "proof");
  const cases = loadCases().slice(0, o.limit ?? undefined);
  const profiles = o.dry ? dryProfiles() : profilesFromEnv(env, o.fetch);
  if (!profiles.length) throw new Error("no profiles");
  const models: ModelSummary[] = [];
  for (const p of profiles) { log(`eval:aperto ${p.label}: ${p.model}`); models.push(await evalProfile(p, cases, log)); }
  let endpoint = "recorded fixtures (offline)";
  if (!o.dry) { try { endpoint = `${new URL(readApertusEnv(env).baseUrl).host} (OpenAI-compatible)`; } catch { endpoint = "configured endpoint"; } }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const base = join(outDir, `aperto-eval-${date}${o.dry ? "-dry" : ""}`);
  writeFileSync(`${base}.md`, renderReport(models, { date, dry: o.dry, endpoint, env }));
  writeFileSync(`${base}.json`, JSON.stringify({ date, dry: o.dry, endpoint, models: models.map(({ results, ...m }) => m) }, null, 1) + "\n");
  return { file: `${base}.md`, models };
}
