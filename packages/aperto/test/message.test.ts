import { describe, expect, test } from "bun:test";
import { computeQuote, type Config } from "../../core/src/index.ts";
import { draftMessage, checkWording, templateWording } from "../src/message.ts";
import { recorded, replayClient, rootFixture } from "./helpers.ts";
import type { Lang } from "../src/types.ts";

const SP = /[\u00a0\u202f\u2007]/g;
const norm = (s: string) => s.replace(SP, " ");
const moverCfg: Config = (() => {
  const raw: string = recorded("recorded-demo.json")[0].responses[0];
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
})();
const painter: Config = rootFixture("config-imbianchino.json"); // IVA esclusa -> gross range too
const moverQuote = computeQuote(moverCfg, { volumen: 20, etage_auszug: 3, ohne_lift: true });
const painterQuote = computeQuote(painter, {});

/** Every digit run in the text must be part of one of the allowed core-formatted strings. */
function numbersOutside(text: string, allowed: string[]): string[] {
  let rest = norm(text);
  for (const a of [...allowed].map(norm).sort((x, y) => y.length - x.length)) rest = rest.split(a).join(" ");
  return rest.match(/\d+/g) ?? [];
}

describe("draftMessage: model writes wording only; core fills {LOW} {HIGH} {VAT}", () => {
  test("model wording (IT) -> final text has exactly the core amounts and no other numbers", async () => {
    const client = replayClient(["Buongiorno! Per il trasloco la stima è tra {LOW} e {HIGH}. {VAT} Le scrivo volentieri per i dettagli."]);
    const r = await draftMessage(moverCfg, moverQuote, "it", { client });
    expect(r.source).toBe("model");
    expect(r.text).toContain(norm(moverQuote.display.low));
    expect(r.text).toContain(norm(moverQuote.display.high));
    expect(r.text).not.toMatch(/\{(LOW|HIGH|VAT)\}/);
    expect(numbersOutside(r.text, [moverQuote.display.low, moverQuote.display.high, "8,1", "8.1"])).toEqual([]);
  });

  test("prices excluding VAT: {VAT} carries the core gross range", async () => {
    const client = replayClient(["Hello, your estimate is {LOW} to {HIGH}. {VAT}"]);
    const r = await draftMessage(painter, painterQuote, "en", { client });
    expect(r.source).toBe("model");
    for (const s of [painterQuote.display.low, painterQuote.display.high, painterQuote.display.lowGross, painterQuote.display.highGross]) expect(r.text).toContain(norm(s));
    expect(numbersOutside(r.text, [painterQuote.display.low, painterQuote.display.high, painterQuote.display.lowGross, painterQuote.display.highGross, "22"])).toEqual([]);
  });

  test("model writes an amount itself -> rejected, one repair, then accepted", async () => {
    const client = replayClient(["Der Preis liegt bei 860 CHF bis {HIGH}. {VAT}", "Guten Tag! Ihr Umzug kostet voraussichtlich {LOW} bis {HIGH}. {VAT}"]);
    const r = await draftMessage(moverCfg, moverQuote, "de", { client });
    expect(r.source).toBe("model");
    expect(r.attempts).toBe(2);
    expect(client.calls[1].at(-1)!.content).toMatch(/digit|number|placeholder/i);
    expect(numbersOutside(r.text, [moverQuote.display.low, moverQuote.display.high, "8,1", "8.1"])).toEqual([]);
  });

  test("model keeps changing numbers / drops placeholders -> template fallback in the requested language", async () => {
    const client = replayClient(["Prix: 999 CHF.", "Prix : environ mille francs."]);
    const r = await draftMessage(moverCfg, moverQuote, "fr", { client });
    expect(r.source).toBe("template");
    expect(r.text).toContain(norm(moverQuote.display.low));
    expect(r.text).not.toContain("999");
    expect(r.errors.length).toBeGreaterThan(0);
  });

  test("model down -> template fallback for each of IT/DE/FR/EN", async () => {
    for (const lang of ["it", "de", "fr", "en"] as Lang[]) {
      const r = await draftMessage(moverCfg, moverQuote, lang, { client: replayClient([new Error("down")]) });
      expect(r.source).toBe("template");
      expect(r.text).toContain(norm(moverQuote.display.low));
      expect(r.text).toContain(norm(moverQuote.display.high));
      expect(numbersOutside(r.text, [moverQuote.display.low, moverQuote.display.high, "8,1", "8.1"])).toEqual([]);
    }
  });

  test("no client at all -> template", async () => {
    const r = await draftMessage(moverCfg, moverQuote, "en", { client: null });
    expect(r.source).toBe("template");
  });

  test("checkWording rules", () => {
    expect(checkWording("From {LOW} to {HIGH}. {VAT}", { needVat: true })).toEqual([]);
    expect(checkWording("From {LOW} to {HIGH}.", { needVat: true }).length).toBeGreaterThan(0);
    expect(checkWording("From {LOW} to {HIGH}.", { needVat: false })).toEqual([]);
    expect(checkWording("From {LOW}.", { needVat: false }).length).toBeGreaterThan(0);
    expect(checkWording("From {LOW} to {HIGH}, about 3 days", { needVat: false }).length).toBeGreaterThan(0); // any digit
    expect(checkWording("From {LOW} to {HIGH} {PRICE}", { needVat: false }).length).toBeGreaterThan(0); // unknown placeholder
    expect(checkWording("From {LOW} to {HIGH}, pay at https://evil.example", { needVat: false }).length).toBeGreaterThan(0); // links
    expect(checkWording("From {LOW} to {HIGH} " + "x".repeat(800), { needVat: false }).length).toBeGreaterThan(0); // too long
    expect(checkWording("Da {LOW} a {HIGH}, tre giorni", { needVat: false })).toEqual([]);
  });

  test("templates exist for every language and pass the same rules", () => {
    for (const lang of ["it", "de", "fr", "en"] as Lang[]) expect(checkWording(templateWording(lang), { needVat: true })).toEqual([]);
  });

  test("amounts come from cents, not from client display strings (tampered display is ignored)", async () => {
    const tampered = { ...moverQuote, display: { ...moverQuote.display, low: "CHF 1.00", high: "CHF 2.00" } };
    const r = await draftMessage(moverCfg, tampered, "en", { client: replayClient(["Estimate {LOW} - {HIGH}. {VAT}"]) });
    expect(r.text).toContain(norm(moverQuote.display.low));
    expect(r.text).not.toContain("1.00");
  });
});
