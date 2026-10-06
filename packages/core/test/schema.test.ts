import { describe, expect, test } from "bun:test";
import { validateConfig } from "../src/index.ts";
import { clone, fixture } from "./helpers.ts";

const base = () => clone(fixture("config-imbianchino.json"));
const errPaths = (r: any) => (r.ok ? [] : r.errors.map((e: any) => e.path));

describe("core/schema", () => {
  test("valid fixture passes and is returned unchanged", () => {
    const r = validateConfig(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(base());
  });
  test("xss-label fixture is a valid config (labels are plain text)", () => {
    expect(validateConfig(fixture("config-xss-label.json")).ok).toBe(true);
  });
  test("non-object input fails without throwing", () => {
    for (const bad of [null, undefined, 42, "x", [], true]) expect(validateConfig(bad).ok).toBe(false);
  });
  test("missing v fails", () => {
    const c = base(); delete c.v;
    expect(errPaths(validateConfig(c))).toContain("v");
  });
  test("wrong v fails", () => {
    const c = base(); c.v = 2;
    expect(errPaths(validateConfig(c))).toContain("v");
  });
  test("bad config id and field id regex fail", () => {
    const c = base(); c.id = "Bad-Id";
    expect(errPaths(validateConfig(c))).toContain("id");
    for (const id of ["9mq", "MQ", "m-q", "a".repeat(33), "", "__proto__"]) {
      const d = base(); d.fields[0].id = id;
      expect(validateConfig(d).ok).toBe(false);
    }
  });
  test("duplicate field ids fail", () => {
    const c = base(); c.fields[1].id = "mq";
    expect(errPaths(validateConfig(c))).toContain("fields[1].id");
  });
  test("0 fields and >12 fields fail", () => {
    const c = base(); c.fields = [];
    expect(errPaths(validateConfig(c))).toContain("fields");
    const d = base();
    d.fields = Array.from({ length: 13 }, (_, i) => ({ id: `f${i}`, type: "number", label: `F${i}`, min: 0, max: 10, default: 1 }));
    d.formula = "f0";
    expect(errPaths(validateConfig(d))).toContain("fields");
  });
  test("12 fields is fine", () => {
    const d = base();
    d.fields = Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, type: "number", label: `F${i}`, min: 0, max: 10, default: 1 }));
    d.formula = "f0 + f11";
    expect(validateConfig(d).ok).toBe(true);
  });
  test("choice default out of range fails", () => {
    const c = base(); c.fields[1].default = 2;
    expect(errPaths(validateConfig(c))).toContain("fields[1].default");
    const d = base(); d.fields[1].default = -1;
    expect(validateConfig(d).ok).toBe(false);
    const e = base(); e.fields[1].default = 0.5;
    expect(validateConfig(e).ok).toBe(false);
  });
  test("unknown field type fails", () => {
    const c = base(); c.fields[0].type = "text";
    expect(errPaths(validateConfig(c))).toContain("fields[0].type");
  });
  test("number default outside min..max fails", () => {
    const c = base(); c.fields[0].default = 5000;
    expect(errPaths(validateConfig(c))).toContain("fields[0].default");
  });
  test("whatsapp normalisation: '+39 333 123 4567' -> '393331234567'", () => {
    const c = base(); c.business.whatsapp = "+39 333 123 4567";
    const r = validateConfig(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.business.whatsapp).toBe("393331234567");
    const d = base(); d.business.whatsapp = "+39 (333) 123-4567";
    const r2 = validateConfig(d);
    expect(r2.ok && r2.config.business.whatsapp).toBe("393331234567");
  });
  test("whatsapp rejection: <8 digits, >15 digits, letters", () => {
    for (const bad of ["1234567", "1234567890123456", "39333abc4567", "+39 333 CALL ME"]) {
      const c = base(); c.business.whatsapp = bad;
      expect(errPaths(validateConfig(c))).toContain("business.whatsapp");
    }
  });
  test("whatsapp is optional (share mode)", () => {
    const c = base(); delete c.business.whatsapp;
    const r = validateConfig(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.business.whatsapp).toBeUndefined();
  });
  test("email optional, invalid email fails", () => {
    const c = base(); delete c.business.email;
    expect(validateConfig(c).ok).toBe(true);
    const d = base(); d.business.email = "not-an-email";
    expect(errPaths(validateConfig(d))).toContain("business.email");
  });
  test("label > 80 chars fails, 80 passes", () => {
    const c = base(); c.fields[0].label = "x".repeat(81);
    expect(errPaths(validateConfig(c))).toContain("fields[0].label");
    const d = base(); d.fields[0].label = "x".repeat(80);
    expect(validateConfig(d).ok).toBe(true);
    const e = base(); e.fields[1].options[0].label = "y".repeat(81);
    expect(errPaths(validateConfig(e))).toContain("fields[1].options[0].label");
  });
  test("formula error is reported at path 'formula'", () => {
    expect(errPaths(validateConfig(fixture("config-invalid-formula.json")))).toContain("formula");
    const c = base(); c.formula = "mq * prezzo_inesistente";
    const r = validateConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.find((e: any) => e.path === "formula")!.message).toContain("prezzo_inesistente");
  });
  test("encoded size > 8 KB rejected", () => {
    const c = base(); c.disclaimer = "d".repeat(400);
    c.fields = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`, type: "choice", label: "L".repeat(80),
      options: Array.from({ length: 10 }, (_, j) => ({ label: `${"o".repeat(70)}${j}`, value: j })), default: 0,
    }));
    c.formula = "f0";
    const r = validateConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e: any) => /8 ?KB|too large/i.test(e.message))).toBe(true);
  });
  test("range, rounding and vat are sanity-checked", () => {
    const c = base(); c.range = { low: 1.5, high: 1.2 };
    expect(errPaths(validateConfig(c))).toContain("range");
    const d = base(); d.vat.rate = -1;
    expect(errPaths(validateConfig(d))).toContain("vat.rate");
    const e = base(); e.rounding = 0;
    expect(errPaths(validateConfig(e))).toContain("rounding");
  });
  test("unknown keys and prototype-polluting keys are dropped, never applied", () => {
    const c = JSON.parse(JSON.stringify(base()).replace('"v":1', '"v":1,"__proto__":{"polluted":true},"extra":1'));
    const r = validateConfig(c);
    expect(r.ok).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    if (r.ok) expect((r.config as any).extra).toBeUndefined();
  });
});
