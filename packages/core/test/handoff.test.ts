import { describe, expect, test } from "bun:test";
import { buildMailtoUrl, buildWhatsAppUrl, computeQuote, defaultAnswers, getTemplate, validateConfig } from "../src/index.ts";
import { clone, fixture, fixtureText } from "./helpers.ts";

const cfg = (mut?: (c: any) => void) => {
  const raw = clone(fixture("config-imbianchino.json"));
  mut?.(raw);
  const r = validateConfig(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.config;
};
const textOf = (url: string) => decodeURIComponent(url.slice(url.indexOf("?text=") + 6));

describe("core/handoff", () => {
  test("wa.me with the owner number; text equals the frozen fixture", () => {
    const c = cfg();
    const url = buildWhatsAppUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" });
    expect(url.startsWith("https://wa.me/393331234567?text=")).toBe(true);
    expect(textOf(url)).toBe(fixtureText("whatsapp-imbianchino.txt"));
  });
  test("message contains business name, every answer line, both range values, VAT note, name", () => {
    const c = cfg();
    const q = computeQuote(c, { ...defaultAnswers(c), mq: 75, colore: 1 });
    const t = textOf(buildWhatsAppUrl(c, q, { name: "Giulia" }));
    const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
    for (const s of [c.business.name, "Giulia", norm(q.display.low), norm(q.display.high), q.display.vatNote, ...q.answers.map((a: any) => `${a.label}: ${norm(a.display)}`)])
      expect(t).toContain(s);
  });
  test("share mode without number -> https://wa.me/?text=", () => {
    const c = cfg((r) => delete r.business.whatsapp);
    const url = buildWhatsAppUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(textOf(url)).toContain("Rossi Tinteggiature");
  });
  test("text is URL-encoded (spaces, €, newlines, emoji)", () => {
    const c = cfg((r) => { r.business.name = "Rossi 🎨 Tinte"; });
    const url = buildWhatsAppUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" });
    const query = url.slice(url.indexOf("?text=") + 6);
    expect(query).not.toMatch(/[ \n€🎨²]/u);
    expect(query).toContain("%20"); expect(query).toContain("%0A"); expect(query).toContain("%E2%82%AC"); expect(query).toContain("%F0%9F%8E%A8");
    expect(() => new URL(url)).not.toThrow();
  });
  test("mailto subject/body", () => {
    const c = cfg();
    const url = buildMailtoUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" })!;
    expect(url.startsWith("mailto:info@example.it?subject=")).toBe(true);
    const u = new URL(url);
    expect(u.searchParams.get("subject")).toContain("Quanto costa imbiancare?");
    expect(u.searchParams.get("body")).toBe(fixtureText("whatsapp-imbianchino.txt"));
    expect(url).not.toContain("+"); // spaces are %20 (mail clients treat + literally)
  });
  test("null mailto when no email", () => {
    const c = cfg((r) => delete r.business.email);
    expect(buildMailtoUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" })).toBeNull();
  });
  test("lead name trimmed, empty name rejected", () => {
    const c = cfg();
    const q = computeQuote(c, defaultAnswers(c));
    expect(textOf(buildWhatsAppUrl(c, q, { name: "   Giulia  " }))).toBe(fixtureText("whatsapp-imbianchino.txt"));
    for (const bad of ["", "   ", "\n\t"]) {
      expect(() => buildWhatsAppUrl(c, q, { name: bad })).toThrow();
      expect(() => buildMailtoUrl(c, q, { name: bad })).toThrow();
    }
  });
  test("control characters in the name are stripped and length capped", () => {
    const c = cfg();
    const q = computeQuote(c, defaultAnswers(c));
    const t = textOf(buildWhatsAppUrl(c, q, { name: "Giu\u0000lia\u202e" + "x".repeat(300) }));
    expect(t).not.toContain("\u0000"); expect(t).not.toContain("\u202e");
    expect(t.split("\n")[0].length).toBeLessThan(160);
  });
  test("URL length < 2,000 chars for the default template", () => {
    const c = cfg();
    expect(buildWhatsAppUrl(c, computeQuote(c, defaultAnswers(c)), { name: "Giulia" }).length).toBeLessThan(2000);
    const t = getTemplate("imbianchino-it");
    expect(buildWhatsAppUrl(t, computeQuote(t, defaultAnswers(t)), { name: "Giulia" }).length).toBeLessThan(2000);
  });
});
