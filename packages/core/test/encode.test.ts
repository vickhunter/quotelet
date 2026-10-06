import { describe, expect, test } from "bun:test";
import { decodeConfig, encodeConfig, getTemplate, listTemplates, validateConfig } from "../src/index.ts";
import { fixture } from "./helpers.ts";

const TEMPLATE_IDS = ["imbianchino-it", "pulizie-it", "traslochi-it", "painting-en"];

describe("core/encode", () => {
  test("listTemplates has the 4 templates and each is valid", () => {
    expect(listTemplates().map((t) => t.id).sort()).toEqual([...TEMPLATE_IDS].sort());
    for (const t of listTemplates()) {
      expect(typeof t.title).toBe("string");
      expect(validateConfig(getTemplate(t.id)).ok).toBe(true);
    }
  });
  test("getTemplate returns a fresh copy", () => {
    const a = getTemplate("imbianchino-it"); (a as any).title = "changed";
    expect(getTemplate("imbianchino-it").title).not.toBe("changed");
  });
  test("round-trip equality for all 4 templates", () => {
    for (const id of TEMPLATE_IDS) {
      const t = getTemplate(id);
      const s = encodeConfig(t);
      expect(s).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
      const d = decodeConfig(s);
      expect(d.ok).toBe(true);
      if (d.ok) expect(d.config).toEqual(t);
    }
  });
  test("round-trip of the fixture (UTF-8: ², è, €)", () => {
    const c = fixture("config-imbianchino.json");
    const d = decodeConfig(encodeConfig(c));
    expect(d.ok && d.config).toEqual(c);
  });
  test("invalid base64url -> errors, never a throw", () => {
    for (const bad of ["", "!!!!", "abc$", "a", "====", "%%%", "eyJ2Ijox", "\u0000", "x".repeat(20000)]) {
      let r: any;
      expect(() => { r = decodeConfig(bad); }).not.toThrow();
      expect(r.ok).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });
  test("tampered JSON -> validation errors, never a throw", () => {
    const b64u = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const c = fixture("config-imbianchino.json");
    for (const json of ["{", "null", "[]", '"str"', JSON.stringify({ ...c, formula: "constructor.constructor('x')()" }), JSON.stringify({ ...c, v: 9 }), '{"__proto__":{"x":1}}']) {
      let r: any;
      expect(() => { r = decodeConfig(b64u(json)); }).not.toThrow();
      expect(r.ok).toBe(false);
    }
  });
  test("non-string input -> errors, never a throw", () => {
    for (const bad of [null, undefined, 12, {}]) expect(decodeConfig(bad as any).ok).toBe(false);
  });
});
