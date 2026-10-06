// draftMessage: the model writes wording only, with {LOW} {HIGH} {VAT} ({BUSINESS} optional).
// Core-formatted amounts are filled in afterwards. Any digit, unknown placeholder or link in the
// wording is rejected (one repair), then a per-language template is used. The model never sees
// the amounts, so it cannot alter them.
import type { Config, Quote } from "../../core/src/index.ts";
import { clientFromEnv } from "./client.ts";
import { messageMessages, messageRepair } from "./prompt.ts";
import { LANGS, type ApiError, type AttemptTrace, type ChatClient, type ChatMessage, type DraftResult, type Lang } from "./types.ts";

export type DraftOptions = { client?: ChatClient | null };
export type Amounts = { low: string; high: string; lowGross: string; highGross: string; rate: string; pricesInclude: boolean; showVat: boolean };

const SPACES = /[\u00a0\u202f\u2007]/g;
const PLACEHOLDERS = new Set(["LOW", "HIGH", "VAT", "BUSINESS"]);
export const MAX_WORDING = 600;
/** Currency names/symbols: the wording never needs them (amounts come from placeholders), so they catch amounts written in words ("mille francs"). */
const CURRENCY_WORDS = /[€$£]|\b(?:chf|eur|euros?|usd|franken|franchi|franco|francs?|fr\.|rappen|centesimi|centimes?|cents?|dollars?)(?![\p{L}])/iu;

function fmt(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  try { return new Intl.NumberFormat(locale, opts); } catch { return new Intl.NumberFormat("en", opts); }
}
const centsOk = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1e13;
/** Same rounding as core computeQuote (design 10.1). */
const gross = (cents: number, rate: number, include: boolean) => (include ? cents : Math.round(Math.round((cents * (100 + rate)) / 100 * 1e6) / 1e6));

/** Validate the quote's cents and format every amount exactly like core computeQuote (NBSP -> space). */
export function quoteAmounts(config: Config, quote: unknown): { ok: true; amounts: Amounts } | { ok: false; errors: ApiError[] } {
  const q = quote as Partial<Quote> | null;
  const errors: ApiError[] = [];
  if (!q || typeof q !== "object") return { ok: false, errors: [{ path: "quote", message: "must be the Quote object from computeQuote" }] };
  if (!centsOk(q.lowCents)) errors.push({ path: "quote.lowCents", message: "must be a non-negative integer (cents)" });
  if (!centsOk(q.highCents)) errors.push({ path: "quote.highCents", message: "must be a non-negative integer (cents)" });
  if (!errors.length && (q.lowCents as number) > (q.highCents as number)) errors.push({ path: "quote.highCents", message: "must be >= lowCents" });
  if (errors.length) return { ok: false, errors };
  const vat = config.vat ?? { rate: 0, pricesInclude: true, show: false };
  const money = fmt(config.locale, { style: "currency", currency: config.currency });
  const plain = fmt(config.locale, { maximumFractionDigits: 2 });
  const m = (c: number) => money.format(c / 100).replace(SPACES, " ");
  const low = q.lowCents as number, high = q.highCents as number;
  return {
    ok: true,
    amounts: {
      low: m(low), high: m(high),
      lowGross: m(gross(low, vat.rate, vat.pricesInclude)), highGross: m(gross(high, vat.rate, vat.pricesInclude)),
      rate: plain.format(vat.rate).replace(SPACES, " "), pricesInclude: vat.pricesInclude, showVat: vat.show,
    },
  };
}

export function vatSentence(lang: Lang, a: Amounts): string {
  if (!a.showVat) return "";
  const r = a.rate, g = `${a.lowGross} – ${a.highGross}`;
  if (a.pricesInclude) return { it: `IVA ${r}% inclusa.`, de: `Inkl. ${r}% MWST.`, fr: `TVA ${r} % comprise.`, en: `VAT ${r}% included.` }[lang];
  return { it: `IVA ${r}% esclusa; con IVA: ${g}.`, de: `Zzgl. ${r}% MWST; inkl. MWST: ${g}.`, fr: `TVA ${r} % en sus ; TTC : ${g}.`, en: `Plus ${r}% VAT; incl. VAT: ${g}.` }[lang];
}

const TEMPLATES: Record<Lang, string> = {
  it: "Ciao {BUSINESS}! Ho calcolato una stima con il vostro calcolatore: {LOW} – {HIGH}. {VAT} Potete confermarmi prezzo e disponibilità? Grazie!",
  de: "Grüezi {BUSINESS}! Ihr Rechner zeigt mir eine Schätzung von {LOW} – {HIGH}. {VAT} Können Sie mir Preis und Termin bestätigen? Danke!",
  fr: "Bonjour {BUSINESS} ! Votre calculateur m'indique une estimation de {LOW} – {HIGH}. {VAT} Pouvez-vous me confirmer le prix et vos disponibilités ? Merci !",
  en: "Hi {BUSINESS}! Your calculator gave me an estimate of {LOW} – {HIGH}. {VAT} Could you confirm the price and your availability? Thanks!",
};
export function templateWording(lang: Lang): string { return TEMPLATES[lang] ?? TEMPLATES.en; }

function cleanWording(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  s = s.replace(/^```[a-z]*\s*\n?|\n?```$/gi, "").trim();
  if (/^(["“«']).*(["”»'])$/s.test(s)) s = s.slice(1, -1).trim();
  return s.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, " ");
}

/** Rules for model wording. Empty array = acceptable. */
export function checkWording(w: string, opts: { needVat: boolean }): ApiError[] {
  const e: ApiError[] = [];
  const err = (message: string) => e.push({ path: "text", message });
  if (!w.trim()) { err("message is empty"); return e; }
  if (w.length > MAX_WORDING) err(`message is longer than ${MAX_WORDING} characters`);
  const count = (p: string) => w.split(`{${p}}`).length - 1;
  if (count("LOW") < 1) err("placeholder {LOW} is missing");
  if (count("HIGH") < 1) err("placeholder {HIGH} is missing");
  if (opts.needVat && count("VAT") < 1) err("placeholder {VAT} is missing");
  for (const p of PLACEHOLDERS) if (count(p) > 2) err(`placeholder {${p}} is repeated too often`);
  for (const m of w.matchAll(/\{([^{}]*)\}/g)) if (!PLACEHOLDERS.has(m[1])) { err(`unknown placeholder {${m[1].slice(0, 20)}}`); break; }
  if (/[{}]/.test(w.replace(/\{(LOW|HIGH|VAT|BUSINESS)\}/g, ""))) err("stray braces");
  if (/\p{Nd}/u.test(w)) err("the message contains digits; amounts must only come from the placeholders");
  if (/[<>]/.test(w)) err("the message contains markup characters (< or >)");
  if (CURRENCY_WORDS.test(w)) err("the message names a currency or amount in words; amounts must only come from the placeholders");
  if (/https?:|www\.|\b[a-z0-9-]+\.(?:com|net|org|ch|it|de|fr|io|ly|me|app|xyz|info)\b|@/i.test(w)) err("the message contains a link or address");
  return e;
}

function fill(w: string, a: Amounts, lang: Lang, business: string): string {
  return w
    .replace(/\{LOW\}/g, () => a.low).replace(/\{HIGH\}/g, () => a.high)
    .replace(/\{VAT\}/g, () => vatSentence(lang, a)).replace(/\{BUSINESS\}/g, () => business)
    .replace(SPACES, " ").replace(/[ \t]{2,}/g, " ").replace(/ +([.,])(?=\s|$)/g, "$1")
    .replace(/ *\n */g, "\n").trim();
}

export async function draftMessage(config: Config, quote: Quote, lang: Lang, opts: DraftOptions = {}): Promise<DraftResult> {
  const L: Lang = LANGS.includes(lang) ? lang : "en";
  const qa = quoteAmounts(config, quote);
  if (!qa.ok) throw new TypeError(qa.errors.map((e) => `${e.path}: ${e.message}`).join("; "));
  const a = qa.amounts;
  const business = String(config.business?.name ?? "").replace(SPACES, " ").trim();
  const needVat = a.showVat;
  const trace: AttemptTrace[] = [];
  const errors: ApiError[] = [];
  const template = (): DraftResult => ({ ok: true, text: fill(templateWording(L), a, L, business), source: "template", attempts: trace.length, errors, trace });
  const client = opts.client === undefined ? clientFromEnv() : opts.client;
  if (!client) return template();

  const messages: ChatMessage[] = messageMessages({ lang: L, title: config.title, needVat });
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content: string;
    try {
      const r = await client.chat(messages, { temperature: 0.3, maxTokens: 300 });
      content = r.content;
      trace.push({ latencyMs: r.latencyMs, usage: r.usage, errors: [] });
    } catch (e: any) {
      errors.push({ path: "model", message: `Model unavailable: ${String(e?.message ?? e).slice(0, 160)}` });
      return template();
    }
    const w = cleanWording(content);
    const problems = checkWording(w, { needVat });
    if (!problems.length) return { ok: true, text: fill(w, a, L, business), source: "model", attempts: attempt, errors, trace };
    trace[trace.length - 1].errors = problems;
    errors.push(...problems);
    if (attempt < 2) messages.push({ role: "assistant", content: content.slice(0, 2000) }, messageRepair(problems));
  }
  return template();
}
