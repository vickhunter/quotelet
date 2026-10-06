// Quotelet widget (design 10.3). Vanilla DOM + open Shadow DOM. Text is only ever set with
// textContent / attributes; nothing is parsed as HTML. No storage, no cookies; the only network
// request is the data-config-url GET. Every public entry point swallows errors so the host page
// never sees a throw.
import { decodeConfig } from "../../core/src/encode.ts";
import { buildMailtoUrl, buildWhatsAppUrl, cleanLeadName } from "../../core/src/handoff.ts";
import { strings, type Strings } from "../../core/src/i18n.ts";
import { computeQuote, defaultAnswers, normalizeAnswers } from "../../core/src/quote.ts";
import { validateConfig } from "../../core/src/schema.ts";
import type { Answers, Config, Quote, ValidationError } from "../../core/src/types.ts";
import { CSS } from "./styles.ts";

export type Handle = { update(answers: Partial<Answers>): void; destroy(): void };
const NOOP: Handle = { update() {}, destroy() {} };
const MAX_CONFIG_BYTES = 64 * 1024;
const live = new WeakMap<Element, Handle>();
/** Pending data-config-url loads; a manual mount()/destroy() in the meantime cancels them. */
const pending = new WeakMap<Element, object>();

type Attrs = Record<string, string | boolean | number | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, text?: string, kids: (Node | null)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  if (text !== undefined) el.textContent = text;
  for (const k of kids) if (k) el.appendChild(k);
  return el;
}

function emit(host: Element, type: string, detail: unknown): void {
  try { host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); } catch { /* never throw into the host */ }
}

function uiStrings(config?: Config): Strings {
  if (config) return strings(config.locale);
  try { return strings(document.documentElement.lang || navigator.language); } catch { return strings("en"); }
}

function resolve(input: unknown): { ok: true; config: Config } | { ok: false; errors: ValidationError[] } {
  if (typeof input === "string") return decodeConfig(input.trim());
  if (input && typeof input === "object") return validateConfig(input);
  return { ok: false, errors: [{ path: "", message: "No config given (expected a config object or a base64url string)" }] };
}

function shadowOf(el: Element): ShadowRoot {
  return el.shadowRoot ?? el.attachShadow({ mode: "open" });
}

function renderError(host: Element, root: ShadowRoot, errors: ValidationError[], config?: Config): void {
  const t = uiStrings(config);
  const list = h("ul", {}, undefined, errors.slice(0, 5).map((e) => h("li", {}, e.path ? `${e.path}: ${e.message}` : e.message)));
  root.replaceChildren(h("style", {}, CSS), h("div", { class: "err", role: "alert", "data-testid": "ql-error" }, undefined, [h("strong", {}, t.errorTitle), list]));
  emit(host, "quotelet:error", { errors: errors.map((e) => ({ path: e.path, message: e.message })) });
}

/** Quotelet.mount(el, configOrEncoded) -> { update(answers), destroy() }. Never throws. */
export function mount(el: Element, configOrEncoded: unknown): Handle {
  try {
    if (!el || typeof (el as Element).attachShadow !== "function") return NOOP;
    pending.delete(el);
    live.get(el)?.destroy();
    const root = shadowOf(el);
    const r = resolve(configOrEncoded);
    if (!r.ok) {
      renderError(el, root, r.errors);
      const handle = { update() {}, destroy() { try { root.replaceChildren(); live.delete(el); } catch { /* ignore */ } } };
      live.set(el, handle);
      return handle;
    }
    const handle = render(el, root, r.config);
    live.set(el, handle);
    return handle;
  } catch {
    try { renderError(el, shadowOf(el), [{ path: "", message: "The calculator could not start" }]); } catch { /* ignore */ }
    return NOOP;
  }
}

function render(host: Element, root: ShadowRoot, config: Config): Handle {
  const t = strings(config.locale);
  let answers: Answers = defaultAnswers(config);
  let quote: Quote;
  let destroyed = false;
  const controls: Record<string, HTMLInputElement | HTMLSelectElement> = {};

  const rows = config.fields.map((f) => {
    const id = `ql-f-${f.id}`;
    const tid = `ql-field-${f.id}`;
    if (f.type === "toggle") {
      const c = h("input", { type: "checkbox", id, "data-testid": tid });
      c.checked = answers[f.id] as boolean;
      controls[f.id] = c;
      return h("div", { class: "row tg" }, undefined, [c, h("label", { for: id }, f.label)]);
    }
    let c: HTMLInputElement | HTMLSelectElement;
    if (f.type === "number") {
      c = h("input", { type: "number", id, "data-testid": tid, inputmode: "decimal", min: f.min, max: f.max, step: f.step ?? "any" });
      c.value = String(answers[f.id]);
    } else {
      c = h("select", { id, "data-testid": tid }, undefined, f.options.map((o, i) => h("option", { value: i }, o.label)));
      c.value = String(answers[f.id]);
    }
    controls[f.id] = c;
    const unit = f.type === "number" && f.unit ? h("span", { class: "u" }, f.unit) : null;
    return h("div", { class: "row" }, undefined, [h("label", { for: id }, f.label), h("div", { class: "in" }, undefined, [c, unit])]);
  });

  const low = h("span", { class: "amt", "data-testid": "ql-result-low" });
  const high = h("span", { class: "amt", "data-testid": "ql-result-high" });
  const vat = h("p", { class: "sm", "data-testid": "ql-vat-note" });
  const calcErr = h("p", { class: "hint", role: "alert", hidden: true }, t.calcError);
  const disc = h("p", { class: "sm disc", "data-testid": "ql-disclaimer", hidden: !config.disclaimer }, config.disclaimer ?? "");
  const name = h("input", { type: "text", id: "ql-name", "data-testid": "ql-name", autocomplete: "given-name", maxlength: 80, placeholder: t.namePlaceholder });
  const hint = h("p", { class: "hint", role: "alert", hidden: true }, t.nameRequired);
  const wa = h("button", { type: "button", "data-testid": "ql-cta-whatsapp" }, config.business.whatsapp ? t.ctaWhatsApp : t.ctaShare);
  const mail = config.business.email ? h("button", { type: "button", class: "alt", "data-testid": "ql-cta-email" }, t.ctaEmail) : null;
  const badge = config.branding === false ? null : h("p", { class: "badge", "data-testid": "ql-badge" }, t.poweredBy);

  const card = h("div", { class: "ql", part: "card" }, undefined, [
    h("div", { class: "t" }, config.title),
    ...rows,
    h("div", { class: "res", "aria-live": "polite" }, undefined, [
      h("div", { class: "lb" }, t.estimateLabel), h("div", {}, undefined, [low, document.createTextNode(" – "), high]), vat, calcErr,
    ]),
    disc,
    h("div", { class: "row" }, undefined, [h("label", { for: "ql-name" }, t.nameLabel), name, hint]),
    wa, mail, badge,
  ]);
  root.replaceChildren(h("style", {}, CSS), card);

  const paint = () => {
    quote = computeQuote(config, answers);
    low.textContent = quote.display.low; low.dataset.cents = String(quote.lowCents);
    high.textContent = quote.display.high; high.dataset.cents = String(quote.highCents);
    const v = quote.vat;
    const grossLine = config.vat?.show && !v.pricesInclude ? ` · ${t.withVat}: ${quote.display.lowGross} – ${quote.display.highGross}` : "";
    vat.textContent = quote.display.vatNote + grossLine;
    vat.hidden = !quote.display.vatNote;
    vat.dataset.lowGrossCents = String(v.lowGrossCents);
    vat.dataset.highGrossCents = String(v.highGrossCents);
    // A runtime formula error (e.g. division by zero) yields 0 amounts: say so and never send a 0 € lead.
    calcErr.hidden = !quote.error;
    wa.disabled = !!quote.error;
    if (mail) mail.disabled = !!quote.error;
    emit(host, "quotelet:quote", { quote });
  };
  const sync = () => {
    for (const f of config.fields) {
      const c = controls[f.id];
      if (f.type === "toggle") (c as HTMLInputElement).checked = answers[f.id] as boolean;
      else c.value = String(answers[f.id]);
    }
  };
  const onField = (id: string, commit: boolean) => () => {
    if (destroyed) return;
    try {
      const f = config.fields.find((x) => x.id === id)!;
      const c = controls[id];
      let v: number | boolean;
      if (f.type === "toggle") v = (c as HTMLInputElement).checked;
      else {
        if (c.value.trim() === "") return;
        v = Number(c.value);
        if (!Number.isFinite(v)) return;
      }
      answers = normalizeAnswers(config, { ...answers, [id]: v });
      if (commit) sync();
      paint();
    } catch { /* never throw into the host */ }
  };
  for (const f of config.fields) {
    const c = controls[f.id];
    if (f.type === "number") { c.addEventListener("input", onField(f.id, false)); c.addEventListener("change", onField(f.id, true)); }
    else c.addEventListener("change", onField(f.id, true));
    if (f.type === "toggle") c.addEventListener("input", onField(f.id, false));
  }
  name.addEventListener("input", () => { if (name.value.trim()) { name.removeAttribute("aria-invalid"); hint.hidden = true; } });

  const lead = (channel: "whatsapp" | "email") => () => {
    if (destroyed || quote.error) return;
    try {
      try { cleanLeadName(name.value); } catch {
        name.setAttribute("aria-invalid", "true"); hint.hidden = false;
        try { name.focus(); } catch { /* ignore */ }
        return;
      }
      const url = channel === "whatsapp" ? buildWhatsAppUrl(config, quote, { name: name.value }) : buildMailtoUrl(config, quote, { name: name.value });
      if (!url) return;
      emit(host, "quotelet:lead", { channel, id: config.id });
      if (channel === "whatsapp") window.open(url, "_blank", "noopener");
      else window.location.assign(url);
    } catch { /* never throw into the host */ }
  };
  wa.addEventListener("click", lead("whatsapp"));
  mail?.addEventListener("click", lead("email"));

  paint();
  emit(host, "quotelet:ready", { id: config.id });

  return {
    update(next: Partial<Answers>) {
      if (destroyed) return;
      try {
        answers = normalizeAnswers(config, { ...answers, ...(next && typeof next === "object" ? next : {}) });
        sync();
        paint();
      } catch { /* never throw into the host */ }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { root.replaceChildren(); live.delete(host); } catch { /* ignore */ }
    },
  };
}

async function fetchConfig(url: string): Promise<unknown> {
  const res = await fetch(url, { method: "GET", credentials: "omit" });
  if (!res.ok) throw new Error(`Config request failed (HTTP ${res.status})`);
  if (Number(res.headers.get("content-length") || 0) > MAX_CONFIG_BYTES) throw new Error("Config file is too large");
  const text = await res.text();
  if (text.length > MAX_CONFIG_BYTES) throw new Error("Config file is too large");
  return JSON.parse(text);
}

/** Mount every [data-quotelet] element below `scope` that is not mounted yet. Never throws. */
export function autoMount(scope: ParentNode = document): void {
  try {
    scope.querySelectorAll("[data-quotelet]").forEach((el) => {
      if (live.has(el) || el.hasAttribute("data-quotelet-mounted")) return;
      el.setAttribute("data-quotelet-mounted", "");
      const encoded = el.getAttribute("data-config");
      const url = el.getAttribute("data-config-url");
      if (encoded) mount(el, encoded);
      else if (url) {
        const token = {};
        pending.set(el, token);
        const current = () => pending.get(el) === token;
        fetchConfig(url).then((c) => { if (current()) mount(el, c); }, (e) => {
          if (!current()) return;
          pending.delete(el);
          try { renderError(el, shadowOf(el), [{ path: "", message: e instanceof Error ? e.message : "Config could not be loaded" }]); } catch { /* ignore */ }
        });
      } else mount(el, undefined);
    });
  } catch { /* never throw into the host */ }
}
