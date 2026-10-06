import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const BUNDLE = join(ROOT, "dist", "quotelet.js");
const fx = (n: string) => JSON.parse(readFileSync(join(ROOT, "fixtures", n), "utf8"));
const b64u = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let mount: any, autoMount: any;
let storageHits = 0;
let opened: string[] = [];

beforeAll(async () => {
  // Build the real bundle first so the size/grep tests check what ships.
  const r = Bun.spawnSync(["bun", join(ROOT, "packages", "widget", "build.ts")], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error("widget build failed: " + r.stderr.toString());
  GlobalRegistrator.register({ url: "http://127.0.0.1:4173/harness/plain.html" });
  // Spies: any read or write of storage / cookies counts.
  const spy = { get() { storageHits++; return { getItem() { storageHits++; return null; }, setItem() { storageHits++; }, length: 0 }; }, configurable: true };
  Object.defineProperty(window, "localStorage", spy);
  Object.defineProperty(window, "sessionStorage", spy);
  Object.defineProperty(globalThis, "localStorage", spy);
  Object.defineProperty(document, "cookie", { get() { storageHits++; return ""; }, set() { storageHits++; }, configurable: true });
  (window as any).open = (u: string) => { opened.push(u); return null; };
  const w = await import("../src/widget.ts");
  mount = w.mount; autoMount = w.autoMount;
});
afterAll(() => GlobalRegistrator.unregister());
afterEach(() => { document.body.innerHTML = ""; opened = []; });

const host = (attrs: Record<string, string> = {}) => {
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
};
const $ = (el: Element, id: string) => el.shadowRoot!.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const record = (el: Element) => {
  const ev: { type: string; detail: any }[] = [];
  for (const t of ["quotelet:ready", "quotelet:quote", "quotelet:lead", "quotelet:error"]) el.addEventListener(t, (e: any) => ev.push({ type: t, detail: e.detail }));
  return ev;
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("widget", () => {
  test("mounts from data-config (base64url) with an open shadow root and the contract test ids", async () => {
    const el = host({ "data-quotelet": "", "data-config": b64u(JSON.stringify(fx("config-imbianchino.json"))) });
    const ev = record(el);
    autoMount(document);
    await tick();
    expect(el.shadowRoot).not.toBeNull();
    for (const id of ["ql-field-mq", "ql-field-altezza", "ql-field-colore", "ql-field-arredato", "ql-field-antimuffa", "ql-result-low", "ql-result-high", "ql-vat-note", "ql-disclaimer", "ql-name", "ql-cta-whatsapp", "ql-cta-email", "ql-badge"])
      expect({ id, found: !!$(el, id) }).toEqual({ id, found: true });
    expect($(el, "ql-result-low")!.dataset.cents).toBe("106000");
    expect($(el, "ql-result-high")!.dataset.cents).toBe("143000");
    expect(ev.map((e) => e.type)).toContain("quotelet:ready");
    expect(ev.find((e) => e.type === "quotelet:ready")!.detail).toEqual({ id: "imbianchino-it" });
  });

  test("mounts from data-config-url (single GET, credentials omitted)", async () => {
    const calls: any[] = [];
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify(fx("config-imbianchino.json")), { headers: { "content-type": "application/json" } }); };
    try {
      const el = host({ "data-quotelet": "", "data-config-url": "/calc.json" });
      const ready = new Promise((r) => el.addEventListener("quotelet:ready", r));
      autoMount(document);
      await ready;
      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe("/calc.json");
      expect(calls[0].init?.credentials).toBe("omit");
      expect((calls[0].init?.method ?? "GET").toUpperCase()).toBe("GET");
      expect($(el, "ql-result-low")!.dataset.cents).toBe("106000");
    } finally { globalThis.fetch = orig; }
  });

  test("bad config shows ql-error, dispatches quotelet:error, never throws; window.onerror untouched", async () => {
    const before = window.onerror;
    const el = host();
    const ev = record(el);
    let api: any;
    expect(() => { api = mount(el, fx("config-invalid-formula.json")); }).not.toThrow();
    await tick();
    expect($(el, "ql-error")).not.toBeNull();
    expect($(el, "ql-error")!.hidden).toBe(false);
    expect($(el, "ql-result-low")).toBeNull();
    expect(ev.some((e) => e.type === "quotelet:error" && e.detail.errors.some((x: any) => x.path === "formula"))).toBe(true);
    expect(window.onerror).toBe(before);
    expect(() => api.update({ mq: 3 })).not.toThrow();
    expect(() => api.destroy()).not.toThrow();
    for (const junk of ["!!!", "", null, 42, undefined, { v: 1 }]) {
      const e2 = host();
      expect(() => mount(e2, junk as any)).not.toThrow();
      await tick();
      expect($(e2, "ql-error")).not.toBeNull();
    }
    expect(() => mount(null as any, fx("config-imbianchino.json"))).not.toThrow();
  });

  test("live update on input; update(answers) API; events carry no PII", async () => {
    const el = host();
    const ev = record(el);
    const api = mount(el, fx("config-imbianchino.json"));
    const mq = $(el, "ql-field-mq") as HTMLInputElement;
    mq.value = "100"; mq.dispatchEvent(new Event("input", { bubbles: true }));
    expect(Number($(el, "ql-result-high")!.dataset.cents)).toBeGreaterThan(143000);
    api.update({ mq: 5, arredato: false });
    expect($(el, "ql-result-low")!.dataset.cents).toBe("13000");
    expect($(el, "ql-result-high")!.dataset.cents).toBe("18000");
    expect((($(el, "ql-field-arredato") as HTMLInputElement).checked)).toBe(false);
    const name = $(el, "ql-name") as HTMLInputElement;
    name.value = "Giulia Bianchi"; name.dispatchEvent(new Event("input", { bubbles: true }));
    ($(el, "ql-cta-whatsapp") as HTMLElement).click();
    expect(opened.length).toBe(1);
    expect(opened[0].startsWith("https://wa.me/393331234567?text=")).toBe(true);
    const lead = ev.find((e) => e.type === "quotelet:lead")!;
    expect(lead.detail).toEqual({ channel: "whatsapp", id: "imbianchino-it" });
    expect(ev.filter((e) => e.type === "quotelet:quote").length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(ev.map((e) => e.detail))).not.toContain("Giulia");
  });

  test("CTA with empty name does not open anything and flags the name field", async () => {
    const el = host();
    const ev = record(el);
    mount(el, fx("config-imbianchino.json"));
    ($(el, "ql-cta-whatsapp") as HTMLElement).click();
    expect(opened.length).toBe(0);
    expect(($(el, "ql-name") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect(ev.some((e) => e.type === "quotelet:lead")).toBe(false);
  });

  test("textContent only: XSS label renders literally, no element is injected", async () => {
    const el = host();
    mount(el, fx("config-xss-label.json"));
    const sr = el.shadowRoot!;
    expect(sr.querySelector("img")).toBeNull();
    expect(sr.querySelector("script")).toBeNull();
    expect(sr.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(sr.textContent).toContain("<script>window.__qlXss=1</script>");
    expect((window as any).__qlXss).toBeUndefined();
  });

  test("two widgets on one page are independent", async () => {
    const a = host(), b = host();
    mount(a, fx("config-imbianchino.json"));
    mount(b, b64u(JSON.stringify(fx("config-imbianchino.json"))));
    const mq = $(a, "ql-field-mq") as HTMLInputElement;
    mq.value = "200"; mq.dispatchEvent(new Event("input", { bubbles: true }));
    expect($(a, "ql-result-low")!.dataset.cents).not.toBe("106000");
    expect($(b, "ql-result-low")!.dataset.cents).toBe("106000");
  });

  test("destroy() empties the shadow root; remount works", async () => {
    const el = host();
    const api = mount(el, fx("config-imbianchino.json"));
    api.destroy();
    expect(el.shadowRoot!.querySelector('[data-testid="ql-result-low"]')).toBeNull();
    mount(el, fx("config-imbianchino.json"));
    expect($(el, "ql-result-low")!.dataset.cents).toBe("106000");
  });

  test("data-config-url failure (HTTP 404) shows ql-error and dispatches quotelet:error", async () => {
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => new Response("nope", { status: 404 });
    try {
      const el = host({ "data-quotelet": "", "data-config-url": "/missing.json" });
      const err = new Promise<any>((r) => el.addEventListener("quotelet:error", (e: any) => r(e.detail)));
      autoMount(document);
      const detail = await err;
      expect(detail.errors[0].message).toContain("404");
      expect($(el, "ql-error")).not.toBeNull();
    } finally { globalThis.fetch = orig; }
  });

  test("a manual mount() while data-config-url is loading wins (no late overwrite)", async () => {
    const orig = globalThis.fetch;
    let release!: () => void;
    (globalThis as any).fetch = () => new Promise((r) => { release = () => r(new Response(JSON.stringify(fx("config-xss-label.json")))); });
    try {
      const el = host({ "data-quotelet": "", "data-config-url": "/slow.json" });
      autoMount(document);
      mount(el, fx("config-imbianchino.json"));
      release();
      await new Promise((r) => setTimeout(r, 10));
      expect(el.shadowRoot!.textContent).not.toContain("<img src=x");
      expect($(el, "ql-result-low")!.dataset.cents).toBe("106000");
    } finally { globalThis.fetch = orig; }
  });

  test("runtime formula error (division by zero): message shown, CTAs disabled, no lead", async () => {
    const cfg = fx("config-imbianchino.json");
    cfg.formula = "1000 / (mq - 5)";
    const el = host();
    const ev = record(el);
    const api = mount(el, cfg);
    api.update({ mq: 5 });
    expect($(el, "ql-result-low")!.dataset.cents).toBe("0");
    expect(($(el, "ql-cta-whatsapp") as HTMLButtonElement).disabled).toBe(true);
    const name = $(el, "ql-name") as HTMLInputElement;
    name.value = "Giulia"; name.dispatchEvent(new Event("input", { bubbles: true }));
    ($(el, "ql-cta-whatsapp") as HTMLElement).click();
    expect(opened.length).toBe(0);
    expect(ev.some((e) => e.type === "quotelet:lead")).toBe(false);
    const q = ev.filter((e) => e.type === "quotelet:quote").pop()!.detail.quote;
    expect(q.error).toBe("division_by_zero");
    api.update({ mq: 10 });
    expect(($(el, "ql-cta-whatsapp") as HTMLButtonElement).disabled).toBe(false);
  });

  test("email CTA: mailto handoff + quotelet:lead {channel: 'email'}", async () => {
    const assigned: string[] = [];
    const loc = window.location as any;
    const origAssign = loc.assign;
    Object.defineProperty(loc, "assign", { value: (u: string) => assigned.push(u), configurable: true, writable: true });
    try {
      const el = host();
      const ev = record(el);
      mount(el, fx("config-imbianchino.json"));
      const name = $(el, "ql-name") as HTMLInputElement;
      name.value = "Giulia"; name.dispatchEvent(new Event("input", { bubbles: true }));
      ($(el, "ql-cta-email") as HTMLElement).click();
      expect(assigned.length).toBe(1);
      expect(assigned[0].startsWith("mailto:info@example.it?subject=")).toBe(true);
      expect(ev.find((e) => e.type === "quotelet:lead")!.detail).toEqual({ channel: "email", id: "imbianchino-it" });
    } finally { Object.defineProperty(loc, "assign", { value: origAssign, configurable: true, writable: true }); }
  });

  test("no localStorage / sessionStorage / document.cookie access (spy)", () => {
    expect(storageHits).toBe(0);
  });

  test("dist/quotelet.js exists, gzip size <= 15 KB", () => {
    expect(existsSync(BUNDLE)).toBe(true);
    const gz = Bun.gzipSync(readFileSync(BUNDLE)).length;
    expect(gz).toBeLessThanOrEqual(15 * 1024);
  });

  test("bundle has no eval / Function / storage / cookie / XHR / sendBeacon / innerHTML", () => {
    const b = readFileSync(BUNDLE, "utf8");
    for (const bad of [/\beval\s*\(/, /new Function/, /\bFunction\(/, /localStorage/, /sessionStorage/, /document\.cookie/, /XMLHttpRequest/, /sendBeacon/, /innerHTML/, /insertAdjacentHTML/, /indexedDB/])
      expect({ bad: String(bad), hit: bad.test(b) }).toEqual({ bad: String(bad), hit: false });
    expect((b.match(/\bfetch\(/g) || []).length).toBeLessThanOrEqual(1); // only the data-config-url GET
  });

  test("bundle exposes window.Quotelet.mount when evaluated", async () => {
    await import(BUNDLE); // the IIFE assigns window.Quotelet
    expect(typeof (window as any).Quotelet?.mount).toBe("function");
  });
});

// ---- fix 8: de-CH / fr-CH configs render a German / French widget (no English UI words) ----------
import { ENGLISH_WORDS } from "../../../apps/web/src/lib/englishWords.ts"; // the repo's EN word list (D-004c scanner), read-only
import { strings as i18n } from "../../core/src/i18n.ts";

// Words on the EN list that are also correct German or French UI words.
const ALSO_DE_FR = new Set(["name", "total", "message", "option", "options", "start", "code", "default"]);
const swissCfg = (lang: "de" | "fr") => ({
  v: 1, id: `swiss-${lang}`, locale: `${lang}-CH`, currency: "CHF",
  title: lang === "de" ? "Umzug in Lugano" : "Nettoyage de fin de bail",
  business: { name: lang === "de" ? "Muster Umzüge" : "Nettoyage Dupont", whatsapp: "41791234567", email: "info@example.ch" },
  fields: lang === "de"
    ? [{ id: "volumen", type: "number", label: "Volumen", unit: "m³", min: 1, max: 200, step: 1, default: 20 },
       { id: "etage", type: "choice", label: "Stockwerk", options: [{ label: "Erdgeschoss", value: 0 }, { label: "3. Stock", value: 3 }], default: 1 },
       { id: "lift", type: "toggle", label: "Ohne Lift", on: 20, off: 0, default: true }]
    : [{ id: "pieces", type: "number", label: "Nombre de pièces", min: 1, max: 12, step: 1, default: 3 },
       { id: "etat", type: "choice", label: "État du logement", options: [{ label: "Bon", value: 1 }, { label: "Très sale", value: 1.5 }], default: 0 },
       { id: "vitres", type: "toggle", label: "Vitres incluses", on: 80, off: 0, default: true }],
  formula: lang === "de" ? "max(300, volumen * 45 + etage * 20 + lift)" : "pieces * 180 * etat + vitres",
  range: { low: 0.9, high: 1.1 }, rounding: 10,
  vat: { rate: 8.1, pricesInclude: false, show: true },
});
const uiText = (el: Element): string[] => {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 1) {
      const e = n as Element;
      if (e.tagName === "STYLE") return;
      for (const a of ["placeholder", "aria-label", "title", "alt"]) { const v = e.getAttribute(a); if (v) out.push(v); }
    }
    if (n.nodeType === 3 && n.textContent!.trim()) out.push(n.textContent!.trim());
    n.childNodes.forEach(walk);
  };
  walk(el.shadowRoot!);
  return out;
};

describe("widget in German and French (de-CH / fr-CH)", () => {
  for (const lang of ["de", "fr"] as const) {
    test(`${lang}-CH config: widget text has no English UI words and uses the ${lang} table`, async () => {
      const el = host({ "data-quotelet": "", "data-config": b64u(JSON.stringify(swissCfg(lang))) });
      autoMount(document);
      await tick();
      expect($(el, "ql-error")).toBeNull();
      const text = uiText(el);
      const words = text.join(" ").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
      const english = words.filter((w) => ENGLISH_WORDS.has(w) && !ALSO_DE_FR.has(w));
      expect({ lang, english }).toEqual({ lang, english: [] });
      const en = i18n("en"), t = i18n(lang);
      for (const v of [en.ctaWhatsApp, en.ctaEmail, en.nameLabel, en.poweredBy, en.estimateLabel, en.withVat, en.vatExcluded("8.1")])
        expect({ lang, v, hit: text.join("\n").includes(v) }).toEqual({ lang, v, hit: false });
      for (const v of [t.ctaWhatsApp, t.ctaEmail, t.nameLabel, t.poweredBy, t.estimateLabel])
        expect({ lang, v, shown: text.includes(v) }).toEqual({ lang, v, shown: true });
      expect($(el, "ql-name")!.getAttribute("placeholder")).toBe(t.namePlaceholder);
      expect($(el, "ql-vat-note")!.textContent).toContain(t.vatExcluded("8.1"));
    });
  }

  test("widget bundle with de + fr tables stays under the 15,360 B gzip budget", () => {
    const b = readFileSync(BUNDLE, "utf8");
    expect(b).toContain(i18n("de").ctaShare);
    expect(b).toContain(i18n("fr").ctaShare);
    expect(Bun.gzipSync(readFileSync(BUNDLE)).length).toBeLessThanOrEqual(15360);
  });
});
