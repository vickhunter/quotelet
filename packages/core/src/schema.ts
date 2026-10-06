// Config v1 validation (design 10.1). Returns a fresh, normalised object built only from known
// keys, so unknown or prototype-polluting keys in the input are never copied or applied.
import { compileFormula, FUNCTIONS } from "./formula.ts";
import { encodeConfig } from "./encode.ts";
import { answersToVars, defaultAnswers } from "./quote.ts";
import { LIMITS, type Config, type Field, type ValidationError } from "./types.ts";

export type ValidateResult = { ok: true; config: Config; warnings: ValidationError[] } | { ok: false; errors: ValidationError[] };

const RESERVED_IDS = new Set<string>([...FUNCTIONS, "constructor", "prototype"]);
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const CONTROL_MULTILINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const EMAIL = /^[^\s@<>()"',;:?&#%/\\]{1,64}@[^\s@<>()"',;:?&#%/\\]+\.[^\s@<>()"',;:?&#%/\\]{2,}$/;

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function validateConfig(input: unknown): ValidateResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const err = (path: string, message: string) => { errors.push({ path, message }); };
  try {
    if (!isObj(input)) return { ok: false, errors: [{ path: "", message: "Config must be a JSON object" }] };
    const text = (path: string, x: unknown, max: number, opts: { required?: boolean; multiline?: boolean; min?: number } = {}): string | undefined => {
      if (x === undefined || x === null) { if (opts.required) err(path, "is required"); return undefined; }
      if (typeof x !== "string") { err(path, "must be a string"); return undefined; }
      if (x.length < (opts.min ?? (opts.required ? 1 : 0))) { err(path, "must not be empty"); return undefined; }
      if (x.length > max) { err(path, `must be at most ${max} characters`); return undefined; }
      if ((opts.multiline ? CONTROL_MULTILINE : CONTROL).test(x)) { err(path, "must be plain text (no control characters)"); return undefined; }
      return x;
    };

    if (input.v !== 1) err("v", "must be 1 (config version)");
    const id = input.id;
    if (typeof id !== "string" || !LIMITS.configIdPattern.test(id)) err("id", "must match ^[a-z][a-z0-9_-]{0,31}$");
    const locale = text("locale", input.locale, 35, { required: true });
    if (locale !== undefined) { try { if (Intl.getCanonicalLocales(locale).length !== 1) err("locale", "must be a BCP 47 locale like it-IT"); } catch { err("locale", "must be a BCP 47 locale like it-IT"); } }
    const currency = input.currency;
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) err("currency", "must be an ISO 4217 code like EUR");
    else { try { new Intl.NumberFormat("en", { style: "currency", currency }); } catch { err("currency", "is not a supported currency"); } }
    const title = text("title", input.title, LIMITS.maxTitle, { required: true });

    // business
    const business: Config["business"] = { name: "" };
    if (!isObj(input.business)) err("business", "must be an object with at least a name");
    else {
      const b = input.business;
      business.name = text("business.name", b.name, LIMITS.maxLabel, { required: true }) ?? "";
      if (has(b, "whatsapp") && b.whatsapp !== null && b.whatsapp !== "") {
        // A JSON number is accepted: <=15 digits is below 2^53, so String() is exact. Strings are preferred.
        const raw = typeof b.whatsapp === "number" ? String(b.whatsapp) : b.whatsapp;
        if (typeof raw !== "string") err("business.whatsapp", "must be a phone number (digits only, 8-15 long)");
        else {
          const digits = raw.trim().replace(/^\+/, "").replace(/[\s().-]/g, "");
          if (!/^\d{8,15}$/.test(digits)) err("business.whatsapp", "must be digits only (international format, no +), 8-15 long");
          else business.whatsapp = digits;
        }
      }
      if (has(b, "email") && b.email !== null && b.email !== "") {
        if (typeof b.email !== "string" || b.email.length > 254 || !EMAIL.test(b.email)) err("business.email", "must be a valid email address");
        else business.email = b.email;
      }
    }

    // fields
    const fields: Field[] = [];
    const ids: string[] = [];
    if (!Array.isArray(input.fields)) err("fields", "must be an array of 1-12 fields");
    else if (input.fields.length < 1 || input.fields.length > LIMITS.maxFields) err("fields", "must contain 1-12 fields");
    else {
      input.fields.forEach((f: unknown, i: number) => {
        const p = `fields[${i}]`;
        if (!isObj(f)) { err(p, "must be an object"); return; }
        let fid: string | undefined;
        if (typeof f.id !== "string" || !LIMITS.idPattern.test(f.id)) err(`${p}.id`, "must match ^[a-z][a-z0-9_]{0,31}$");
        else if (RESERVED_IDS.has(f.id)) err(`${p}.id`, `"${f.id}" is a reserved word`);
        else if (ids.includes(f.id)) err(`${p}.id`, `duplicate field id "${f.id}"`);
        else fid = f.id;
        const label = text(`${p}.label`, f.label, LIMITS.maxLabel, { required: true });
        if (f.type === "number") {
          const min = f.min, max = f.max;
          let okRange = true;
          if (!num(min)) { err(`${p}.min`, "must be a number"); okRange = false; }
          if (!num(max)) { err(`${p}.max`, "must be a number"); okRange = false; }
          if (okRange && (min as number) >= (max as number)) { err(`${p}.max`, "must be greater than min"); okRange = false; }
          if (has(f, "step") && !(num(f.step) && f.step > 0)) err(`${p}.step`, "must be a positive number");
          const unit = text(`${p}.unit`, f.unit, 16);
          if (has(f, "default") && (!num(f.default) || (okRange && (f.default < (min as number) || f.default > (max as number))))) err(`${p}.default`, "must be a number between min and max");
          if (fid && label !== undefined && okRange) {
            const out: Field = { id: fid, type: "number", label, ...(unit !== undefined ? { unit } : {}), min: min as number, max: max as number };
            if (has(f, "step") && num(f.step)) out.step = f.step;
            if (has(f, "default") && num(f.default)) out.default = f.default;
            fields.push(out);
          }
        } else if (f.type === "choice") {
          const opts: { label: string; value: number }[] = [];
          if (!Array.isArray(f.options) || f.options.length < 1 || f.options.length > LIMITS.maxOptions) err(`${p}.options`, "must be an array of 1-20 options");
          else f.options.forEach((o: unknown, j: number) => {
            const op = `${p}.options[${j}]`;
            if (!isObj(o)) { err(op, "must be an object { label, value }"); return; }
            const ol = text(`${op}.label`, o.label, LIMITS.maxLabel, { required: true });
            if (!num(o.value)) err(`${op}.value`, "must be a number");
            if (ol !== undefined && num(o.value)) opts.push({ label: ol, value: o.value });
          });
          const n = Array.isArray(f.options) ? f.options.length : 0;
          if (has(f, "default") && !(Number.isInteger(f.default) && (f.default as number) >= 0 && (f.default as number) < n)) err(`${p}.default`, `must be an option index between 0 and ${Math.max(0, n - 1)}`);
          if (fid && label !== undefined && opts.length === n && n > 0) {
            const out: Field = { id: fid, type: "choice", label, options: opts };
            if (has(f, "default") && Number.isInteger(f.default)) out.default = f.default as number;
            fields.push(out);
          }
        } else if (f.type === "toggle") {
          if (!num(f.on)) err(`${p}.on`, "must be a number");
          if (!num(f.off)) err(`${p}.off`, "must be a number");
          if (has(f, "default") && typeof f.default !== "boolean") err(`${p}.default`, "must be true or false");
          if (fid && label !== undefined && num(f.on) && num(f.off)) {
            const out: Field = { id: fid, type: "toggle", label, on: f.on, off: f.off };
            if (typeof f.default === "boolean") out.default = f.default;
            fields.push(out);
          }
        } else err(`${p}.type`, 'must be "number", "choice" or "toggle"');
        if (fid) ids.push(fid);
      });
    }

    // formula
    let formula = "";
    if (typeof input.formula !== "string") err("formula", "must be a string");
    else {
      formula = input.formula;
      const c = compileFormula(formula, ids);
      if (!c.ok) err("formula", `${c.error.message} (at position ${c.error.pos})`);
      else c.warnings.forEach((w) => warnings.push({ path: "formula", message: w }));
    }

    const out: Config = { v: 1, id: id as string, locale: locale as string, currency: currency as string, title: title as string, business, fields, formula };

    if (has(input, "range")) {
      const r = input.range;
      if (!isObj(r) || !num(r.low) || !num(r.high) || r.low <= 0 || r.low > r.high || r.high > 10) err("range", "must be { low, high } with 0 < low <= high <= 10");
      else out.range = { low: r.low, high: r.high };
    }
    if (has(input, "rounding")) {
      const r = input.rounding;
      if (!num(r) || r < 0.01 || r > 100000 || Math.abs(Math.round(r * 100) - r * 100) > 1e-9) err("rounding", "must be a currency amount between 0.01 and 100000 (whole cents)");
      else out.rounding = r;
    }
    if (has(input, "vat")) {
      const v = input.vat;
      if (!isObj(v)) err("vat", "must be { rate, pricesInclude, show }");
      else {
        if (!num(v.rate) || v.rate < 0 || v.rate > 100) err("vat.rate", "must be a percentage between 0 and 100");
        if (typeof v.pricesInclude !== "boolean") err("vat.pricesInclude", "must be true or false");
        if (typeof v.show !== "boolean") err("vat.show", "must be true or false");
        if (num(v.rate) && typeof v.pricesInclude === "boolean" && typeof v.show === "boolean") out.vat = { rate: v.rate, pricesInclude: v.pricesInclude, show: v.show };
      }
    }
    if (has(input, "disclaimer")) { const d = text("disclaimer", input.disclaimer, LIMITS.maxDisclaimer, { multiline: true }); if (d !== undefined) out.disclaimer = d; }
    if (has(input, "branding")) { if (typeof input.branding !== "boolean") err("branding", "must be true or false"); else out.branding = input.branding; }

    if (errors.length) return { ok: false, errors };
    if (encodeConfig(out).length > LIMITS.maxEncoded) return { ok: false, errors: [{ path: "", message: "Encoded config is larger than 8 KB" }] };
    const c = compileFormula(out.formula, ids);
    if (c.ok && c.evaluateDetailed(answersToVars(out, defaultAnswers(out))).error === "division_by_zero")
      warnings.push({ path: "formula", message: "Division by zero with the default answers (the quote will show 0)" });
    return { ok: true, config: out, warnings };
  } catch {
    return { ok: false, errors: errors.length ? errors : [{ path: "", message: "Config could not be validated" }] };
  }
}
