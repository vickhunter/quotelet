// Regression guard: yes/no answers in the WhatsApp/email lead text follow the config language.
import { describe, expect, test } from "bun:test";
import { buildLeadMessage, buildWhatsAppUrl, computeQuote, strings, validateConfig } from "../src/index.ts";

const cfg = (locale: string, label: string) => {
  const r = validateConfig({
    v: 1, id: "lead", locale, currency: "CHF", title: "Umzug", business: { name: "Muster", whatsapp: "41791234567" },
    fields: [{ id: "volumen", type: "number", label: "Volumen", min: 1, max: 100, default: 20 },
      { id: "lift", type: "toggle", label, on: 50, off: 0, default: true },
      { id: "keller", type: "toggle", label: label + " 2", on: 30, off: 0, default: false }],
    formula: "volumen * 45 + lift + keller", vat: { rate: 8.1, pricesInclude: true, show: true },
  });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.config;
};

describe("lead message booleans are localized (no English Yes/No)", () => {
  for (const [locale, label, yes, no] of [["de-CH", "Kein Lift", "Ja", "Nein"], ["fr-CH", "Sans ascenseur", "Oui", "Non"], ["it-CH", "Senza ascensore", "S\u00ec", "No"]] as const) {
    test(`${locale}: "${label}: ${yes}" / "${no}", never Yes/No`, () => {
      const c = cfg(locale, label);
      expect(strings(locale).yes).toBe(yes);
      const q = computeQuote(c, {});
      const text = buildLeadMessage(c, q, { name: "Anna" });
      expect(text).toContain(`- ${label}: ${yes}`);
      expect(text).toContain(`- ${label} 2: ${no}`);
      expect(text).not.toMatch(/\bYes\b/);
      if (locale !== "it-CH") expect(text).not.toMatch(/\bNo\b/);
      const wa = decodeURIComponent(buildWhatsAppUrl(c, q, { name: "Anna" }).split("?text=")[1]);
      expect(wa).toContain(`- ${label}: ${yes}`);
      expect(wa).not.toMatch(/\bYes\b/);
    });
  }
});
