// Quote math (design 10.1 "Range math"). All money is integer cents.
import { compileFormula, type CompileResult } from "./formula.ts";
import { strings } from "./i18n.ts";
import type { Answers, Config, Field, Quote } from "./types.ts";

const own = (o: unknown, k: string) => o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
/** Snap values that are within float noise of an integer (e.g. 110.00000000000001 -> 110). */
const snap = (x: number) => { const r = Math.round(x); return Math.abs(x - r) < 1e-9 * Math.max(1, Math.abs(x)) ? r : x; };

export function defaultAnswers(config: Config): Answers {
  const a: Answers = {};
  for (const f of config.fields) a[f.id] = fieldDefault(f);
  return a;
}
function fieldDefault(f: Field): number | boolean {
  if (f.type === "number") return f.default ?? f.min;
  if (f.type === "choice") return f.default ?? 0;
  return f.default ?? false;
}

/** Coerce + clamp answers: numbers clamp to [min,max], choice index to a valid option, junk -> default. */
export function normalizeAnswers(config: Config, answers: unknown): Answers {
  const out: Answers = {};
  for (const f of config.fields) {
    const raw = own(answers, f.id) ? (answers as Record<string, unknown>)[f.id] : undefined;
    const def = fieldDefault(f);
    if (f.type === "toggle") {
      out[f.id] = typeof raw === "boolean" ? raw : raw === 1 || raw === "true" || raw === "on" ? true : raw === 0 || raw === "false" || raw === "off" ? false : def;
      continue;
    }
    let n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw.replace(",", ".")) : NaN;
    if (!Number.isFinite(n)) n = def as number;
    if (f.type === "number") out[f.id] = Math.min(f.max, Math.max(f.min, n));
    else out[f.id] = Math.min(f.options.length - 1, Math.max(0, Math.round(n)));
  }
  return out;
}

/** Map normalised answers to the numeric variables the formula sees. */
export function answersToVars(config: Config, answers: Answers): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const f of config.fields) {
    const a = answers[f.id];
    vars[f.id] = f.type === "number" ? (a as number) : f.type === "choice" ? f.options[a as number].value : a ? f.on : f.off;
  }
  return vars;
}

const compiled = new WeakMap<Config, CompileResult>();
function getCompiled(config: Config): CompileResult {
  let c = compiled.get(config);
  if (!c || (c as { src?: string }).src !== config.formula) {
    c = Object.assign(compileFormula(config.formula, config.fields.map((f) => f.id)), { src: config.formula });
    compiled.set(config, c);
  }
  return c;
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function fmt(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    try { f = new Intl.NumberFormat(locale, opts); } catch { f = new Intl.NumberFormat("en", opts); }
    fmtCache.set(key, f);
  }
  return f;
}

export function computeQuote(config: Config, answers: Answers): Quote {
  const ans = normalizeAnswers(config, answers);
  const c = getCompiled(config);
  let value = 0;
  let error: string | null = null;
  if (!c.ok) error = "invalid_formula";
  else ({ value, error } = c.evaluateDetailed(answersToVars(config, ans)));

  const pointCents = error ? 0 : Math.max(0, Math.round(snap(value * 100)));
  const range = config.range ?? { low: 1, high: 1 };
  const unit = Math.max(1, Math.round((config.rounding ?? 1) * 100)); // rounding step in cents
  const lowCents = Math.max(0, Math.floor(snap((pointCents * range.low) / unit)) * unit);
  const highCents = Math.max(0, Math.ceil(snap((pointCents * range.high) / unit)) * unit);
  const vat = config.vat ?? { rate: 0, pricesInclude: true, show: false };
  const gross = (cents: number) => (vat.pricesInclude ? cents : Math.round(Math.round((cents * (100 + vat.rate)) / 100 * 1e6) / 1e6));
  const lowGrossCents = gross(lowCents), highGrossCents = gross(highCents);

  const t = strings(config.locale);
  const money = fmt(config.locale, { style: "currency", currency: config.currency });
  const plain = fmt(config.locale, { maximumFractionDigits: 2 });
  const rate = plain.format(vat.rate);
  const vatNote = !vat.show ? "" : vat.pricesInclude ? t.vatIncluded(rate) : t.vatExcluded(rate);

  return {
    pointCents, lowCents, highCents, currency: config.currency,
    vat: { rate: vat.rate, pricesInclude: vat.pricesInclude, lowGrossCents, highGrossCents },
    display: {
      low: money.format(lowCents / 100), high: money.format(highCents / 100), vatNote,
      lowGross: money.format(lowGrossCents / 100), highGross: money.format(highGrossCents / 100),
    },
    answers: config.fields.map((f) => {
      const a = ans[f.id];
      const display = f.type === "number" ? plain.format(a as number) + (f.unit ? ` ${f.unit}` : "")
        : f.type === "choice" ? f.options[a as number].label : a ? t.yes : t.no;
      return { id: f.id, label: f.label, display };
    }),
    error,
  };
}
