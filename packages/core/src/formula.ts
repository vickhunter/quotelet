// Safe formula language (design 10.1). Tokenizer + recursive-descent parser + tree-walking
// evaluator. There is no code generation of any kind: the formula is data, never code.
import { LIMITS } from "./types.ts";

export type FormulaError = { pos: number; message: string };
export type EvalResult = { value: number; error: string | null };
export type CompiledFormula = {
  ok: true;
  evaluate(vars: Record<string, number>): number;
  evaluateDetailed(vars: Record<string, number>): EvalResult;
  warnings: string[];
};
export type CompileResult = CompiledFormula | { ok: false; error: FormulaError };

type Cmp = ">" | "<" | ">=" | "<=" | "==";
type Node =
  | { t: "n"; v: number }
  | { t: "v"; name: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node; pos: number }
  | { t: "fn"; name: "min" | "max" | "round" | "ceil" | "floor"; args: Node[] }
  | { t: "if"; op: Cmp | null; l: Node; r: Node | null; a: Node; b: Node };

type Tok =
  | { k: "num"; v: number; pos: number }
  | { k: "id"; v: string; pos: number }
  | { k: "fn"; v: string; pos: number }
  | { k: "op"; v: string; pos: number }
  | { k: "end"; pos: number };

export const FUNCTIONS = ["min", "max", "round", "ceil", "floor", "if"] as const;
const FN_SET = new Set<string>(FUNCTIONS);
const MAX_DEPTH = 64;

class FormulaSyntaxError extends Error {
  constructor(public pos: number, message: string) { super(message); }
}
const fail = (pos: number, message: string): never => { throw new FormulaSyntaxError(pos, message); };

function tokenize(src: string, ids: Set<string>): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c >= "0" && c <= "9") {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(i))!;
      out.push({ k: "num", v: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))!;
      const w = m[0];
      if (FN_SET.has(w)) out.push({ k: "fn", v: w, pos: i });
      else if (ids.has(w) && LIMITS.idPattern.test(w)) out.push({ k: "id", v: w, pos: i });
      else fail(i, `Unknown identifier "${w}"`);
      i += w.length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === ">=" || two === "<=" || two === "==") { out.push({ k: "op", v: two, pos: i }); i += 2; continue; }
    if ("+-*/(),<>".includes(c)) { out.push({ k: "op", v: c, pos: i }); i++; continue; }
    if (c === "=") fail(i, "Assignment is not allowed (use == inside if())");
    fail(i, `Unexpected character "${c}"`);
  }
  out.push({ k: "end", pos: src.length });
  return out;
}

function parse(toks: Tok[]): Node {
  let p = 0;
  let depth = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return t.k === "op" && t.v === v; };
  const expect = (v: string) => {
    const t = toks[p];
    if (t.k === "op" && t.v === v) { p++; return; }
    fail(t.pos, t.k === "end" ? `Expected "${v}" but the formula ended` : `Expected "${v}"`);
  };
  const enter = (pos: number) => { if (++depth > MAX_DEPTH) fail(pos, "Formula is nested too deeply"); };

  function expr(): Node {
    let a = term();
    while (isOp("+") || isOp("-")) {
      const t = toks[p++] as { v: "+" | "-"; pos: number };
      a = { t: "bin", op: t.v, a, b: term(), pos: t.pos };
    }
    return a;
  }
  function term(): Node {
    let a = unary();
    while (isOp("*") || isOp("/")) {
      const t = toks[p++] as { v: "*" | "/"; pos: number };
      a = { t: "bin", op: t.v, a, b: unary(), pos: t.pos };
    }
    return a;
  }
  function unary(): Node {
    if (isOp("-")) {
      const t = toks[p++];
      enter(t.pos);
      const a = unary();
      depth--;
      return { t: "neg", a };
    }
    return primary();
  }
  function args(): Node[] {
    const list: Node[] = [];
    if (isOp(")")) return list;
    list.push(expr());
    while (isOp(",")) { p++; list.push(expr()); }
    return list;
  }
  function primary(): Node {
    const t = peek();
    if (t.k === "num") { p++; return { t: "n", v: t.v }; }
    if (t.k === "id") { p++; return { t: "v", name: t.v }; }
    if (t.k === "fn") {
      p++;
      if (!isOp("(")) fail(peek().pos, `"${t.v}" must be followed by "("`);
      p++;
      enter(t.pos);
      let node: Node;
      if (t.v === "if") {
        const l = expr();
        let op: Cmp | null = null;
        let r: Node | null = null;
        const c = peek();
        if (c.k === "op" && [">", "<", ">=", "<=", "=="].includes(c.v)) { p++; op = c.v as Cmp; r = expr(); }
        if (!isOp(",")) fail(peek().pos, 'if() needs 3 arguments: if(condition, then, else)');
        p++;
        const a = expr();
        if (!isOp(",")) fail(peek().pos, 'if() needs 3 arguments: if(condition, then, else)');
        p++;
        const b = expr();
        node = { t: "if", op, l, r, a, b };
      } else {
        const list = args();
        const name = t.v as "min" | "max" | "round" | "ceil" | "floor";
        if ((name === "min" || name === "max") && list.length < 1) fail(t.pos, `${name}() needs at least 1 argument`);
        if ((name === "round" || name === "ceil" || name === "floor") && list.length !== 1) fail(t.pos, `${name}() takes exactly 1 argument`);
        node = { t: "fn", name, args: list };
      }
      expect(")");
      depth--;
      return node;
    }
    if (t.k === "op" && t.v === "(") {
      p++;
      enter(t.pos);
      const e = expr();
      expect(")");
      depth--;
      return e;
    }
    if (t.k === "end") return fail(t.pos, "Unexpected end of formula");
    return fail(t.pos, `Unexpected "${(t as { v: string }).v}"`);
  }

  const root = expr();
  const t = peek();
  if (t.k !== "end") {
    if (t.k === "op" && [">", "<", ">=", "<=", "=="].includes(t.v)) fail(t.pos, "Comparisons are only allowed as the first argument of if()");
    fail(t.pos, t.k === "op" ? `Unexpected "${t.v}"` : "Missing operator between values");
  }
  return root;
}

function constValue(n: Node): number | null {
  switch (n.t) {
    case "n": return n.v;
    case "v": return null;
    case "neg": { const a = constValue(n.a); return a === null ? null : -a; }
    case "bin": {
      const a = constValue(n.a), b = constValue(n.b);
      if (a === null || b === null) return null;
      return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : b === 0 ? null : a / b;
    }
    default: return null;
  }
}
function collectWarnings(n: Node, out: string[]): void {
  switch (n.t) {
    case "neg": collectWarnings(n.a, out); break;
    case "bin":
      if (n.op === "/" && constValue(n.b) === 0) out.push(`Division by zero at position ${n.pos}`);
      collectWarnings(n.a, out); collectWarnings(n.b, out); break;
    case "fn": n.args.forEach((a) => collectWarnings(a, out)); break;
    case "if": [n.l, n.r, n.a, n.b].forEach((a) => a && collectWarnings(a, out)); break;
  }
}

function run(n: Node, vars: Record<string, number>, st: { err: string | null }): number {
  switch (n.t) {
    case "n": return n.v;
    case "v": {
      const v = Object.prototype.hasOwnProperty.call(vars, n.name) ? vars[n.name] : undefined;
      if (typeof v !== "number" || !Number.isFinite(v)) { st.err ??= "missing_variable"; return 0; }
      return v;
    }
    case "neg": return -run(n.a, vars, st);
    case "bin": {
      const a = run(n.a, vars, st), b = run(n.b, vars, st);
      if (n.op === "+") return a + b;
      if (n.op === "-") return a - b;
      if (n.op === "*") return a * b;
      if (b === 0) { st.err ??= "division_by_zero"; return 0; }
      return a / b;
    }
    case "fn": {
      const xs = n.args.map((a) => run(a, vars, st));
      if (n.name === "min") return Math.min(...xs);
      if (n.name === "max") return Math.max(...xs);
      if (n.name === "round") return Math.round(xs[0]);
      if (n.name === "ceil") return Math.ceil(xs[0]);
      return Math.floor(xs[0]);
    }
    case "if": {
      const l = run(n.l, vars, st);
      let cond: boolean;
      if (n.op === null) cond = l !== 0;
      else {
        const r = run(n.r!, vars, st);
        cond = n.op === ">" ? l > r : n.op === "<" ? l < r : n.op === ">=" ? l >= r : n.op === "<=" ? l <= r : l === r;
      }
      return cond ? run(n.a, vars, st) : run(n.b, vars, st);
    }
  }
}

export function compileFormula(src: string, fieldIds: string[]): CompileResult {
  if (typeof src !== "string") return { ok: false, error: { pos: 0, message: "Formula must be a string" } };
  if (src.length > LIMITS.maxFormula) return { ok: false, error: { pos: LIMITS.maxFormula, message: `Formula is longer than ${LIMITS.maxFormula} characters` } };
  if (src.trim() === "") return { ok: false, error: { pos: 0, message: "Formula is empty" } };
  const ids = new Set((Array.isArray(fieldIds) ? fieldIds : []).filter((x) => typeof x === "string"));
  let ast: Node;
  try {
    ast = parse(tokenize(src, ids));
  } catch (e) {
    if (e instanceof FormulaSyntaxError) return { ok: false, error: { pos: e.pos, message: e.message } };
    return { ok: false, error: { pos: 0, message: "Formula could not be parsed" } };
  }
  const warnings: string[] = [];
  collectWarnings(ast, warnings);
  const evaluateDetailed = (vars: Record<string, number>): EvalResult => {
    const st = { err: null as string | null };
    let value = run(ast, vars && typeof vars === "object" ? vars : {}, st);
    if (!st.err && !Number.isFinite(value)) st.err = "non_finite";
    if (st.err) value = 0;
    return { value, error: st.err };
  };
  return { ok: true, evaluate: (vars) => evaluateDetailed(vars).value, evaluateDetailed, warnings };
}
