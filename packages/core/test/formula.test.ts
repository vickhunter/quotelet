import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compileFormula } from "../src/index.ts";
import { ROOT } from "./helpers.ts";

const ev = (src: string, vars: Record<string, number> = {}) => {
  const c = compileFormula(src, Object.keys(vars));
  if (!c.ok) throw new Error(`compile failed: ${src}: ${c.error.message}`);
  return c.evaluate(vars);
};
const fails = (src: string, ids: string[] = ["mq"]) => {
  const c = compileFormula(src, ids);
  expect(c.ok).toBe(false);
  return c.ok ? null : c.error;
};

describe("core/formula", () => {
  test("precedence 2+3*4 = 14", () => expect(ev("2+3*4")).toBe(14));
  test("parentheses (2+3)*4 = 20", () => expect(ev("(2+3)*4")).toBe(20));
  test("left associativity", () => { expect(ev("10-4-3")).toBe(3); expect(ev("16/4/2")).toBe(2); });
  test("unary minus", () => { expect(ev("-3+5")).toBe(2); expect(ev("-(2*3)")).toBe(-6); expect(ev("2*-mq", { mq: 4 })).toBe(-8); expect(ev("--2")).toBe(2); });
  test("decimals", () => expect(ev("1.5*2")).toBe(3));
  test("variables", () => expect(ev("mq * 3 * colore", { mq: 60, colore: 6 })).toBe(1080));
  test("min/max with n args", () => {
    expect(ev("min(3, 1, 2)")).toBe(1);
    expect(ev("max(3, 1, 2, 9, 4)")).toBe(9);
    expect(ev("max(150, 90)")).toBe(150);
    expect(ev("min(7)")).toBe(7);
  });
  test("round/ceil/floor", () => {
    expect(ev("round(2.5)")).toBe(3);
    expect(ev("round(2.4)")).toBe(2);
    expect(ev("ceil(2.1)")).toBe(3);
    expect(ev("floor(2.9)")).toBe(2);
  });
  test("if with each comparator", () => {
    expect(ev("if(mq > 10, 1, 2)", { mq: 11 })).toBe(1);
    expect(ev("if(mq > 10, 1, 2)", { mq: 10 })).toBe(2);
    expect(ev("if(mq < 10, 1, 2)", { mq: 9 })).toBe(1);
    expect(ev("if(mq >= 10, 1, 2)", { mq: 10 })).toBe(1);
    expect(ev("if(mq <= 10, 1, 2)", { mq: 11 })).toBe(2);
    expect(ev("if(mq == 10, 1, 2)", { mq: 10 })).toBe(1);
    expect(ev("if(mq == 10, 1, 2)", { mq: 3 })).toBe(2);
  });
  test("the design 10.1 formula", () => {
    expect(ev("max(150, (mq * 3 * colore * altezza + antimuffa * 3) * arredato)", { mq: 60, colore: 6, altezza: 1, antimuffa: 0, arredato: 1.1 })).toBeCloseTo(1188, 9);
  });
  test("unknown identifier error with position", () => {
    const e = fails("mq * prezzo_inesistente");
    expect(e!.pos).toBe(5);
    expect(e!.message).toContain("prezzo_inesistente");
  });
  test("rejects '.', '[', quotes, constructor, __proto__, globalThis, assignment, semicolons", () => {
    const cases: [string, number?][] = [
      ["mq.toString", 2], ["mq[0]", 2], ['"abc"', 0], ["'abc'", 0], ["`x`", 0],
      ["constructor", 0], ['constructor.constructor("return fetch")()', 0], ["__proto__", 0], ["globalThis", 0],
      ["mq = 3", 3], ["mq; 3", 2], ["this", 0], ["window", 0], ["mq()", 2], ["a=>1"],
    ];
    for (const [src, pos] of cases) {
      const e = fails(src);
      if (pos !== undefined) expect({ src, pos: e!.pos }).toEqual({ src, pos });
    }
  });
  test("a field id cannot reach prototype members even if it looks like one", () => {
    const c = compileFormula("valueof + 1", ["valueof"]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.evaluate({ valueof: 2 })).toBe(3);
    expect(c.evaluateDetailed({} as any).error).not.toBeNull(); // missing var never falls back to Object.prototype
    expect(c.evaluate({} as any)).toBe(0);
  });
  test("syntax errors: dangling operator, unbalanced parens, wrong arity", () => {
    fails("mq +"); fails("(mq"); fails("mq)"); fails("round(1, 2)"); fails("if(mq > 1, 2)"); fails("max()"); fails(""); fails("1 2");
  });
  test("comparison outside if() is rejected", () => fails("mq > 3"));
  test("length > 500 rejected, 500 accepted", () => {
    const ok = "1" + "+1".repeat(249); // 499 chars
    expect(compileFormula(ok + "0", []).ok).toBe(true);
    const e = fails("1" + "+1".repeat(250), []);
    expect(e!.message).toMatch(/500/);
  });
  test("division by zero: validation warning + runtime 0 with error flag", () => {
    const c = compileFormula("10 / (mq - 5)", ["mq"]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.evaluate({ mq: 10 })).toBe(2);
    expect(c.evaluate({ mq: 5 })).toBe(0);
    expect(c.evaluateDetailed({ mq: 5 })).toEqual({ value: 0, error: "division_by_zero" });
    const k = compileFormula("mq / 0", ["mq"]);
    expect(k.ok && k.warnings.length).toBeGreaterThan(0);
  });
  test("evaluation never uses eval/Function (source + built bundle grep)", () => {
    const srcDir = join(ROOT, "packages", "core", "src");
    for (const f of readdirSync(srcDir)) {
      const s = readFileSync(join(srcDir, f), "utf8");
      expect({ f, hit: /\beval\s*\(|new\s+Function|\bFunction\s*\(/.test(s) }).toEqual({ f, hit: false });
    }
    const bundle = join(ROOT, "dist", "quotelet.js");
    if (existsSync(bundle)) {
      const b = readFileSync(bundle, "utf8");
      expect(/\beval\s*\(|new Function|\bFunction\(/.test(b)).toBe(false);
    }
  });
});
