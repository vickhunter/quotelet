import { describe, expect, test } from "bun:test";
import { strings, type Strings } from "../src/i18n.ts";

// Every key of the Strings table, as rendered with sample arguments (functions) or as is (plain strings).
const KEYS: (keyof Strings)[] = [
  "yes", "no", "vatIncluded", "vatExcluded", "greetOwner", "greetShare", "request", "estimate", "withVat", "mailSubject",
  "ctaWhatsApp", "ctaShare", "ctaEmail", "nameLabel", "namePlaceholder", "nameRequired", "calcError", "errorTitle", "poweredBy", "estimateLabel",
];
const ARGS: Partial<Record<keyof Strings, string[]>> = {
  vatIncluded: ["8.1"], vatExcluded: ["8.1"], greetOwner: ["BIZ", "NAME"], greetShare: ["BIZ", "NAME"], request: ["TITLE"], mailSubject: ["TITLE", "NAME"],
};
const render = (s: Strings, k: keyof Strings): string => {
  const v = s[k] as unknown;
  return typeof v === "function" ? (v as (...a: string[]) => string)(...(ARGS[k] ?? [])) : String(v);
};

describe("i18n strings: it / en / de / fr", () => {
  test("parity: every key present and non-empty in it, en, de, fr; the key list matches the table", () => {
    for (const lang of ["it", "en", "de", "fr"]) {
      const s = strings(lang);
      expect(Object.keys(s).sort()).toEqual([...KEYS].sort());
      for (const k of KEYS) expect({ lang, k, ok: render(s, k).trim().length > 0 }).toEqual({ lang, k, ok: true });
    }
  });

  test("interpolation: every language keeps the same arguments (rate, business, name, title)", () => {
    for (const lang of ["it", "en", "de", "fr"]) {
      const s = strings(lang);
      for (const [k, args] of Object.entries(ARGS) as [keyof Strings, string[]][])
        for (const a of args) expect({ lang, k, a, has: render(s, k).includes(a) }).toEqual({ lang, k, a, has: true });
    }
  });

  test("de and fr are real translations (only de 'Name' may equal English)", () => {
    const en = strings("en");
    for (const lang of ["de", "fr"]) {
      const s = strings(lang);
      for (const k of KEYS) if (k !== "no" && !(lang === "de" && k === "namePlaceholder")) expect({ lang, k, same: render(s, k) === render(en, k) }).toEqual({ lang, k, same: false });
    }
  });

  test("Swiss German orthography: ss, never \u00df; brand WhatsApp kept", () => {
    const de = strings("de");
    for (const k of KEYS) expect(render(de, k)).not.toContain("\u00df");
    for (const lang of ["de", "fr"]) {
      expect(strings(lang).ctaWhatsApp).toContain("WhatsApp");
      expect(strings(lang).ctaShare).toContain("WhatsApp");
    }
  });

  test("locale resolution: de/de-CH/de-DE/de-AT -> de; fr/fr-CH/fr-FR -> fr; it unchanged; unknown -> en", () => {
    const de = strings("de"), fr = strings("fr"), it = strings("it"), en = strings("en");
    expect(de.yes).toBe("Ja");
    expect(fr.yes).toBe("Oui");
    for (const l of ["de", "de-CH", "de-DE", "de-AT", "DE-ch"]) expect(strings(l)).toBe(de);
    for (const l of ["fr", "fr-CH", "fr-FR", "FR-ch"]) expect(strings(l)).toBe(fr);
    for (const l of ["it", "it-IT", "it-CH"]) expect(strings(l)).toBe(it);
    for (const l of ["en", "en-US", "es-ES", "pt", "", undefined, null]) expect(strings(l as any)).toBe(en);
    expect(it.yes).toBe("S\u00ec");
  });
});
