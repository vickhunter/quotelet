import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeConfig, encodeConfig } from "../../core/src/index.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const FIX = "fixtures/config-imbianchino.json";
const run = (...args: string[]) => {
  const r = Bun.spawnSync(["bun", "packages/cli/index.ts", ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
};

describe("cli", () => {
  test("templates: table with the 4 ids, exit 0", () => {
    const r = run("templates");
    expect(r.code).toBe(0);
    for (const id of ["imbianchino-it", "pulizie-it", "traslochi-it", "painting-en"]) expect(r.out).toContain(id);
  });
  test("templates --json parses", () => {
    const r = run("templates", "--json");
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.length).toBe(4);
    expect(Object.keys(j[0]).sort()).toEqual(["id", "locale", "title"]);
  });
  test("validate ok -> exit 0", () => {
    const r = run("validate", FIX);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/ok/i);
  });
  test("validate invalid -> exit 1, errors as 'path: message'", () => {
    const r = run("validate", "fixtures/config-invalid-formula.json");
    expect(r.code).toBe(1);
    expect(r.out + r.err).toMatch(/^formula: .+/m);
  });
  test("validate missing file / bad JSON -> exit 1", () => {
    expect(run("validate", "fixtures/nope.json").code).toBe(1);
    expect(run("validate", "README.md").code).toBe(1);
  });
  test("quote --json parses and matches the default fixture", () => {
    const r = run("quote", FIX, "--json");
    expect(r.code).toBe(0);
    const q = JSON.parse(r.out);
    expect([q.lowCents, q.highCents, q.vat.lowGrossCents, q.vat.highGrossCents]).toEqual([106000, 143000, 129320, 174460]);
  });
  test("quote --set id=value (number, toggle, choice index)", () => {
    const r = run("quote", FIX, "--set", "mq=5", "--set", "arredato=false", "--json");
    expect(r.code).toBe(0);
    const q = JSON.parse(r.out);
    expect([q.lowCents, q.highCents]).toEqual([13000, 18000]);
    const c = JSON.parse(run("quote", FIX, "--set", "colore=1", "--json").out);
    expect(c.highCents).toBeGreaterThan(143000);
    const byLabel = JSON.parse(run("quote", FIX, "--set", "colore=Colorato", "--json").out);
    expect(byLabel.highCents).toBe(c.highCents);
  });
  test("quote human output shows the range and VAT note", () => {
    const r = run("quote", FIX);
    expect(r.code).toBe(0);
    expect(r.out).toContain("IVA");
    expect(r.out.replace(/[\u00a0\u202f]/g, " ")).toContain("1060,00 €");
  });
  test("quote with unknown field or bad value -> exit 1", () => {
    expect(run("quote", FIX, "--set", "nope=1").code).toBe(1);
    expect(run("quote", FIX, "--set", "mq=abc").code).toBe(1);
    expect(run("quote", "fixtures/config-invalid-formula.json").code).toBe(1);
  });
  test("link default base http://127.0.0.1:4173", () => {
    const r = run("link", FIX);
    expect(r.code).toBe(0);
    const file = JSON.parse(readFileSync(join(ROOT, FIX), "utf8"));
    expect(r.out.trim()).toBe(`http://127.0.0.1:4173/q#c=${encodeConfig(file)}`);
    const d = decodeConfig(r.out.trim().split("#c=")[1]);
    expect(d.ok && d.config).toEqual(file);
  });
  test("link --base", () => {
    const r = run("link", FIX, "--base", "https://quotelet.example/");
    expect(r.code).toBe(0);
    expect(r.out.trim().startsWith("https://quotelet.example/q#c=")).toBe(true);
    expect(run("link", FIX, "--base", "javascript:alert(1)").code).toBe(1);
  });
  test("link on invalid config -> exit 1", () => {
    expect(run("link", "fixtures/config-invalid-formula.json").code).toBe(1);
  });
  test("unknown command -> exit 2 with usage; --help -> exit 0", () => {
    const r = run("frobnicate");
    expect(r.code).toBe(2);
    expect(r.out + r.err).toMatch(/usage/i);
    expect(run("--help").code).toBe(0);
  });
});
