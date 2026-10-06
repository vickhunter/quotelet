import { readFileSync } from "node:fs";
import {
  computeQuote, defaultAnswers, encodeConfig, listTemplates, validateConfig,
  type Answers, type Config, type ValidationError,
} from "../../core/src/index.ts";

export type CliResult = { code: number; stdout: string; stderr: string };
export const DEFAULT_BASE = "http://127.0.0.1:4173";

export const USAGE = `Usage: quotelet <command> [options]

Commands:
  templates [--json]                             List the bundled templates
  validate <file>                                Validate a config v1 JSON file (exit 0 ok, 1 invalid)
  quote <file> [--set id=value ...] [--json]     Compute a quote (choice: option index or label; toggle: true/false)
  link <file> [--base https://host]              Print a share link <base>/q#c=<base64url config>
                                                 (default base ${DEFAULT_BASE})
Options:
  -h, --help                                     Show this help`;

const ok = (stdout: string): CliResult => ({ code: 0, stdout, stderr: "" });
const fail = (stderr: string, code = 1): CliResult => ({ code, stdout: "", stderr });
const fmtErrors = (errors: ValidationError[]) => errors.map((e) => `${e.path || "config"}: ${e.message}`).join("\n");

function loadConfig(file: string | undefined): { ok: true; config: Config; warnings: ValidationError[] } | { ok: false; res: CliResult } {
  if (!file) return { ok: false, res: fail(`config: missing <file> argument\n\n${USAGE}`, 2) };
  let text: string;
  try { text = readFileSync(file, "utf8"); } catch { return { ok: false, res: fail(`config: cannot read file "${file}"`) }; }
  let data: unknown;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, res: fail(`config: invalid JSON (${e instanceof Error ? e.message : "parse error"})`) }; }
  const r = validateConfig(data);
  if (!r.ok) return { ok: false, res: fail(fmtErrors(r.errors)) };
  return { ok: true, config: r.config, warnings: r.warnings };
}

function parseSet(config: Config, spec: string, answers: Answers): string | null {
  const eq = spec.indexOf("=");
  if (eq < 1) return `--set: expected id=value, got "${spec}"`;
  const id = spec.slice(0, eq).trim();
  const raw = spec.slice(eq + 1).trim();
  const f = config.fields.find((x) => x.id === id);
  if (!f) return `--set ${id}: unknown field (fields: ${config.fields.map((x) => x.id).join(", ")})`;
  if (f.type === "toggle") {
    const v = raw.toLowerCase();
    if (["true", "on", "1", "yes", "si", "sì"].includes(v)) answers[id] = true;
    else if (["false", "off", "0", "no"].includes(v)) answers[id] = false;
    else return `--set ${id}: expected true or false`;
    return null;
  }
  if (f.type === "choice") {
    const byLabel = f.options.findIndex((o) => o.label.toLowerCase() === raw.toLowerCase());
    if (byLabel >= 0) { answers[id] = byLabel; return null; }
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0 || n >= f.options.length)
      return `--set ${id}: expected an option index 0-${f.options.length - 1} or one of: ${f.options.map((o) => o.label).join(" | ")}`;
    answers[id] = n;
    return null;
  }
  const n = Number(raw.replace(",", "."));
  if (raw === "" || !Number.isFinite(n)) return `--set ${id}: expected a number`;
  if (n < f.min || n > f.max) return `--set ${id}: must be between ${f.min} and ${f.max}`;
  answers[id] = n;
  return null;
}

function table(rows: string[][]): string {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => [...r[i]].length)));
  return rows.map((r) => r.map((c, i) => c + " ".repeat(w[i] - [...c].length)).join("  ").trimEnd()).join("\n");
}
const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

export async function main(argv: string[]): Promise<CliResult> {
  const args = [...argv];
  const flag = (name: string) => { const i = args.indexOf(name); if (i >= 0) { args.splice(i, 1); return true; } return false; };
  if (args.length === 0 || flag("--help") || flag("-h")) return args.length === 0 && argv.length === 0 ? { code: 2, stdout: "", stderr: USAGE } : ok(USAGE);
  const cmd = args.shift()!;
  const json = flag("--json");

  if (cmd === "templates") {
    const list = listTemplates();
    if (json) return ok(JSON.stringify(list, null, 2));
    return ok(table([["ID", "LOCALE", "TITLE"], ...list.map((t) => [t.id, t.locale, t.title])]));
  }

  if (cmd === "validate") {
    const r = loadConfig(args[0]);
    if (!r.ok) return r.res;
    const warn = r.warnings.length ? "\n" + r.warnings.map((w) => `warning ${w.path}: ${w.message}`).join("\n") : "";
    return ok(`OK ${r.config.id}: ${r.config.fields.length} fields, formula valid, ${encodeConfig(r.config).length} B encoded${warn}`);
  }

  if (cmd === "quote") {
    const sets: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--set") {
        if (args[i + 1] === undefined) return fail("--set: missing id=value", 2);
        sets.push(args[i + 1]); args.splice(i, 2); i--;
      } else if (args[i].startsWith("--set=")) { sets.push(args[i].slice(6)); args.splice(i, 1); i--; }
    }
    const r = loadConfig(args[0]);
    if (!r.ok) return r.res;
    const answers = defaultAnswers(r.config);
    for (const s of sets) { const e = parseSet(r.config, s, answers); if (e) return fail(e); }
    const q = computeQuote(r.config, answers);
    if (json) return ok(JSON.stringify(q, null, 2));
    const lines = [
      r.config.title,
      ...q.answers.map((a) => `  ${a.label}: ${nb(a.display)}`),
      "",
      `Range: ${nb(q.display.low)} – ${nb(q.display.high)}  (lowCents ${q.lowCents}, highCents ${q.highCents})`,
    ];
    if (q.display.vatNote) lines.push(q.display.vatNote);
    if (r.config.vat?.show && !q.vat.pricesInclude) lines.push(`Gross: ${nb(q.display.lowGross)} – ${nb(q.display.highGross)}  (${q.vat.lowGrossCents}-${q.vat.highGrossCents} cents)`);
    if (q.error) lines.push(`error: ${q.error}`);
    return ok(lines.join("\n"));
  }

  if (cmd === "link") {
    let base = DEFAULT_BASE;
    const bi = args.indexOf("--base");
    if (bi >= 0) {
      const b = args[bi + 1];
      if (!b) return fail("--base: missing URL", 2);
      args.splice(bi, 2);
      let u: URL;
      try { u = new URL(b); } catch { return fail(`--base: not a URL: ${b}`); }
      if (u.protocol !== "http:" && u.protocol !== "https:") return fail("--base: must be an http(s) URL");
      base = b.replace(/[#?].*$/, "").replace(/\/+$/, "");
    }
    const r = loadConfig(args[0]);
    if (!r.ok) return r.res;
    return ok(`${base}/q#c=${encodeConfig(r.config)}`);
  }

  return fail(`Unknown command "${cmd}"\n\n${USAGE}`, 2);
}
