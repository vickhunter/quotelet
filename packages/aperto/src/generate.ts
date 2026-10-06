// generateConfig: owner text -> Apertus -> JSON -> validateConfig + compileFormula, ONE repair retry
// fed with the validator errors, hard fail with the error list. The model never computes prices.
import { compileFormula, defaultAnswers, validateConfig, type Config } from "../../core/src/index.ts";
import { answersToVars } from "../../core/src/quote.ts";
import { clientFromEnv } from "./client.ts";
import { extractJson } from "./json.ts";
import { configMessages, repairMessage, sanitizeOwnerText } from "./prompt.ts";
import { LANGS, PROXY_LIMITS, type ApiError, type AttemptTrace, type ChatClient, type ChatMessage, type GenerateResult, type Lang } from "./types.ts";

export { configMessages as buildConfigMessages } from "./prompt.ts";

export type GenerateOptions = { client?: ChatClient | null; maxAttempts?: 1 | 2 };

const HINT: Record<Lang, string> = {
  it: "Aggiungi un numero preciso per ogni prezzo o supplemento (per esempio \"+20% la domenica\").",
  de: "Geben Sie für jeden Preis und jeden Zuschlag eine konkrete Zahl an (zum Beispiel \"+20% am Sonntag\").",
  fr: "Indiquez un nombre précis pour chaque prix ou supplément (par exemple « +20% le dimanche »).",
  en: "Add a concrete number for every price or surcharge (for example \"+20% on Sundays\").",
};

const isObj = (x: unknown): x is Record<string, any> => x !== null && typeof x === "object" && !Array.isArray(x);

/** Digit runs in the text that look like phone numbers (separators allowed), digits only. */
function phoneCandidates(text: string): string[] {
  return (text.match(/\+?\d[\d\s().\-/]{6,}\d/g) ?? []).map((s) => s.replace(/\D/g, "")).filter((s) => s.length >= 8);
}

/** Drop contact details the owner did not write (prompt injection / hallucination would route leads elsewhere). */
function groundContacts(value: Record<string, any>, text: string, warnings: ApiError[]) {
  const b = value.business;
  if (!isObj(b)) return;
  if (b.whatsapp !== undefined && b.whatsapp !== null && b.whatsapp !== "") {
    const wa = String(b.whatsapp).replace(/\D/g, "");
    const ok = wa.length >= 8 && phoneCandidates(text).some((c) => c === wa || wa.endsWith(c.replace(/^0+/, "")) || c.endsWith(wa));
    if (!ok) { delete b.whatsapp; warnings.push({ path: "business.whatsapp", message: "removed: this number is not in your text" }); }
  }
  if (b.email !== undefined && b.email !== null && b.email !== "") {
    if (typeof b.email !== "string" || !text.toLowerCase().includes(b.email.toLowerCase())) { delete b.email; warnings.push({ path: "business.email", message: "removed: this address is not in your text" }); }
  }
}

/** All numbers the owner wrote, in the usual Swiss/Italian/German/French/English notations. */
export function numbersInText(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/\d+(?:[.,'’\u00a0\u202f]\d+)*/g)) {
    const s = m[0];
    out.add(Number(s.replace(/[^\d]/g, "")));
    const dec = s.replace(/['’\u00a0\u202f]/g, "");
    const lastSep = Math.max(dec.lastIndexOf("."), dec.lastIndexOf(","));
    if (lastSep > 0) out.add(Number(dec.slice(0, lastSep).replace(/[.,]/g, "") + "." + dec.slice(lastSep + 1)));
    for (const part of s.split(/[.,'’\u00a0\u202f]/)) out.add(Number(part));
  }
  return out;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a));
function grounded(n: number, nums: Set<number>): boolean {
  if (n === 0 || n === 1 || n === 100) return true;
  for (const t of nums) if (near(n, t) || near((n - 1) * 100, t) || near((1 - n) * 100, t) || near(n * 100, t)) return true;
  return false;
}
function groundingWarnings(config: Config, text: string): ApiError[] {
  const nums = numbersInText(text);
  const fromFormula = (config.formula.match(/(?<![A-Za-z0-9_.])\d+(?:\.\d+)?/g) ?? []).map(Number);
  const missing = [...new Set(fromFormula.filter((n) => !grounded(n, nums)))];
  const w: ApiError[] = [];
  if (missing.length) w.push({ path: "formula", message: `numbers not found in your text: ${missing.join(", ")} (please check them)` });
  config.fields.forEach((f, i) => {
    const vals = f.type === "toggle" ? [f.on, f.off] : f.type === "choice" ? f.options.map((o) => o.value) : [];
    const miss = [...new Set(vals.filter((n) => !grounded(n, nums)))];
    if (miss.length) w.push({ path: `fields[${i}]`, message: `values not found in your text: ${miss.join(", ")} (please check them)` });
  });
  return w;
}

type Check = { ok: true; config: Config; warnings: ApiError[] } | { ok: false; errors: ApiError[] };

function check(raw: string, text: string): Check {
  const j = extractJson(raw);
  if (!j.ok) return { ok: false, errors: [{ path: "", message: `${j.error}` }] };
  const value = j.value;
  const pre: ApiError[] = [];
  if (value.v === undefined) value.v = 1;
  groundContacts(value, text, pre);
  const v = validateConfig(value);
  if (!v.ok) return { ok: false, errors: v.errors };
  const c = compileFormula(v.config.formula, v.config.fields.map((f) => f.id));
  if (!c.ok) return { ok: false, errors: [{ path: "formula", message: `${c.error.message} (at position ${c.error.pos})` }] };
  const warnings = [...pre, ...v.warnings, ...c.warnings.filter((w) => !v.warnings.some((x) => x.message === w)).map((message) => ({ path: "formula", message }))];
  const d = c.evaluateDetailed(answersToVars(v.config, defaultAnswers(v.config)));
  if (!d.error && !(d.value > 0)) warnings.push({ path: "formula", message: "the default answers give a price of 0" });
  warnings.push(...groundingWarnings(v.config, text));
  return { ok: true, config: v.config, warnings };
}

export async function generateConfig(text: string, lang: Lang, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const trace: AttemptTrace[] = [];
  if (!LANGS.includes(lang)) return { ok: false, errors: [{ path: "lang", message: "must be one of it, de, fr, en" }], attempts: 0, trace };
  if (typeof text !== "string" || !sanitizeOwnerText(text)) return { ok: false, errors: [{ path: "text", message: "is required" }], attempts: 0, trace };
  if (text.length > PROXY_LIMITS.maxTextChars) return { ok: false, errors: [{ path: "text", message: `must be at most ${PROXY_LIMITS.maxTextChars} characters` }], attempts: 0, trace };
  const client = opts.client === undefined ? clientFromEnv() : opts.client;
  if (!client) return { ok: false, errors: [{ path: "model", message: "No model configured: set APERTUS_BASE_URL and APERTUS_MODEL (or APERTUS_MOCK=1)" }], attempts: 0, trace };

  const messages: ChatMessage[] = configMessages(text, lang);
  const max = opts.maxAttempts ?? 2;
  let lastErrors: ApiError[] = [];
  for (let attempt = 1; attempt <= max; attempt++) {
    let content: string;
    try {
      const r = await client.chat(messages, { temperature: 0, maxTokens: 1500 });
      content = r.content;
      trace.push({ latencyMs: r.latencyMs, usage: r.usage, errors: [] });
    } catch (e: any) {
      const mockMiss = e?.status === 404 && /mock/.test(client.model);
      const message = mockMiss ? "APERTUS_MOCK=1 only has recorded answers for the example price lists; configure APERTUS_BASE_URL to try your own text" : `Model unavailable: ${String(e?.message ?? e).slice(0, 160)}`;
      return { ok: false, errors: [{ path: "model", message }], attempts: attempt, trace };
    }
    const c = check(content, text);
    if (c.ok) return { ok: true, config: c.config, attempts: attempt, warnings: c.warnings, source: client.recorded ? "recording" : "model", trace };
    lastErrors = c.errors;
    trace[trace.length - 1].errors = c.errors;
    if (attempt < max) messages.push({ role: "assistant", content: content.slice(0, 6000) }, repairMessage(c.errors));
  }
  return { ok: false, errors: [...lastErrors.slice(0, 30), { path: "text", message: HINT[lang] }], attempts: max, trace };
}
