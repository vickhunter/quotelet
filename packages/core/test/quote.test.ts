import { describe, expect, test } from "bun:test";
import { computeQuote, defaultAnswers, validateConfig } from "../src/index.ts";
import { clone, fixture } from "./helpers.ts";

const cfg = () => {
  const r = validateConfig(fixture("config-imbianchino.json"));
  if (!r.ok) throw new Error("fixture invalid");
  return r.config;
};
const cents = (q: any) => ({ pointCents: q.pointCents, lowCents: q.lowCents, highCents: q.highCents, currency: q.currency, vat: q.vat });
const simple = (over: any = {}) => {
  const r = validateConfig({
    v: 1, id: "simple", locale: "it-IT", currency: "EUR", title: "T",
    business: { name: "B" },
    fields: [{ id: "x", type: "number", label: "X", min: 0, max: 100000, step: 0.01, default: 100 }],
    formula: "x", range: { low: 1, high: 1 }, rounding: 1, vat: { rate: 22, pricesInclude: false, show: true },
    disclaimer: "", branding: false, ...over,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.config;
};

describe("core/quote", () => {
  test("defaultAnswers follows field defaults (choice = option index)", () => {
    expect(defaultAnswers(cfg())).toEqual({ mq: 60, altezza: 0, colore: 0, arredato: true, antimuffa: 0 });
  });
  test("fixture default -> exact cents", () => {
    const f = fixture("quote-imbianchino-default.json");
    const q = computeQuote(cfg(), defaultAnswers(cfg()));
    expect(cents(q)).toEqual(cents(f));
    expect(q.lowCents).toBe(106000); expect(q.highCents).toBe(143000);
    expect(q.vat.lowGrossCents).toBe(129320); expect(q.vat.highGrossCents).toBe(174460);
    expect(q.error).toBeNull();
  });
  test("fixture input -> exact cents (default + min)", () => {
    for (const name of ["quote-imbianchino-default.json", "quote-imbianchino-min.json"]) {
      const f = fixture(name);
      expect(cents(computeQuote(cfg(), f.input))).toEqual(cents(f));
    }
  });
  test("minimum case -> 13000 / 18000", () => {
    const q = computeQuote(cfg(), { ...defaultAnswers(cfg()), mq: 5, arredato: false });
    expect(q.pointCents).toBe(15000);
    expect([q.lowCents, q.highCents]).toEqual([13000, 18000]);
  });
  test("answers list carries labels and display values", () => {
    const f = fixture("quote-imbianchino-default.json");
    const q = computeQuote(cfg(), defaultAnswers(cfg()));
    expect(q.answers).toEqual(f.answers);
  });
  test("range rounding: low floors, high ceils to the rounding unit", () => {
    const c = simple({ range: { low: 0.9, high: 1.1 }, rounding: 50 });
    const q = computeQuote(c, { x: 1234 });
    expect(q.lowCents).toBe(110000); // 1110.6 -> 1100
    expect(q.highCents).toBe(140000); // 1357.4 -> 1400
  });
  test("exact multiples are not pushed up/down by float noise", () => {
    const c = simple({ range: { low: 1, high: 1.1 }, rounding: 10 });
    const q = computeQuote(c, { x: 1000 }); // 1000*1.1 = 1100.0000000000002 in floats
    expect(q.highCents).toBe(110000);
    expect(q.lowCents).toBe(100000);
  });
  test("VAT excluded vs included", () => {
    const ex = computeQuote(simple(), { x: 100 });
    expect(ex.vat).toEqual({ rate: 22, pricesInclude: false, lowGrossCents: 12200, highGrossCents: 12200 });
    const inc = computeQuote(simple({ vat: { rate: 22, pricesInclude: true, show: true } }), { x: 100 });
    expect(inc.vat).toEqual({ rate: 22, pricesInclude: true, lowGrossCents: 10000, highGrossCents: 10000 });
    expect(inc.display.vatNote).toMatch(/inclusa/i);
    expect(ex.display.vatNote).toMatch(/esclusa/i);
    expect(ex.display.vatNote).toContain("22%");
  });
  test("0% VAT", () => {
    const q = computeQuote(simple({ vat: { rate: 0, pricesInclude: false, show: true } }), { x: 100 });
    expect(q.vat.lowGrossCents).toBe(10000);
    expect(q.vat.highGrossCents).toBe(10000);
  });
  test("float safety: 0.1 + 0.2 style inputs are cents-exact", () => {
    const c = simple({ fields: [{ id: "a", type: "number", label: "A", min: 0, max: 10, step: 0.1, default: 0.1 }, { id: "b", type: "number", label: "B", min: 0, max: 10, step: 0.1, default: 0.2 }], formula: "a + b", rounding: 0.01 });
    const q = computeQuote(c, { a: 0.1, b: 0.2 });
    expect([q.pointCents, q.lowCents, q.highCents]).toEqual([30, 30, 30]);
    expect(q.vat.lowGrossCents).toBe(37); // 30 * 1.22 = 36.6 -> 37
    const c2 = simple({ rounding: 0.01 });
    const q2 = computeQuote(c2, { x: 1.005 });
    expect(Number.isInteger(q2.pointCents) && Number.isInteger(q2.lowCents) && Number.isInteger(q2.vat.highGrossCents)).toBe(true);
  });
  test("out-of-range answers clamp to min/max, bad types fall back to defaults", () => {
    const c = cfg();
    const hi = computeQuote(c, { ...defaultAnswers(c), mq: 99999 });
    const max = computeQuote(c, { ...defaultAnswers(c), mq: 1000 });
    expect(hi.lowCents).toBe(max.lowCents);
    const lo = computeQuote(c, { ...defaultAnswers(c), mq: -50 });
    const min = computeQuote(c, { ...defaultAnswers(c), mq: 5 });
    expect(lo.lowCents).toBe(min.lowCents);
    const idx = computeQuote(c, { ...defaultAnswers(c), colore: 7 });
    const last = computeQuote(c, { ...defaultAnswers(c), colore: 1 });
    expect(idx.lowCents).toBe(last.lowCents);
    const junk = computeQuote(c, { mq: "abc" as any, altezza: NaN as any });
    expect(junk.lowCents).toBe(106000);
  });
  test("display strings come from Intl for it-IT and en-IE", () => {
    const it = computeQuote(cfg(), defaultAnswers(cfg()));
    const fIt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
    expect(it.display.low).toBe(fIt.format(1060));
    expect(it.display.high).toBe(fIt.format(1430));
    expect(it.display.lowGross).toBe(fIt.format(1293.2));
    expect(it.display.highGross).toBe(fIt.format(1744.6));
    const en = computeQuote(simple({ locale: "en-IE", vat: { rate: 23, pricesInclude: false, show: true } }), { x: 1000 });
    const fEn = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
    expect(en.display.low).toBe(fEn.format(1000));
    expect(en.display.highGross).toBe(fEn.format(1230));
    expect(en.display.vatNote).toMatch(/exclude VAT/i);
    expect(en.display.vatNote).toContain("23%");
  });
  test("vat.show=false gives an empty VAT note", () => {
    expect(computeQuote(simple({ vat: { rate: 22, pricesInclude: false, show: false } }), { x: 1 }).display.vatNote).toBe("");
  });
  test("division by zero at runtime -> zero amounts + error flag, no throw", () => {
    const c = simple({ formula: "100 / (x - 5)" });
    const q = computeQuote(c, { x: 5 });
    expect(q.error).toBe("division_by_zero");
    expect([q.pointCents, q.lowCents, q.highCents]).toEqual([0, 0, 0]);
  });
  test("result is never negative", () => {
    const q = computeQuote(simple({ formula: "x - 1000" }), { x: 10 });
    expect(q.lowCents).toBeGreaterThanOrEqual(0);
  });
});
