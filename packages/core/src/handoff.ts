// Lead handoff with no storage: wa.me click-to-chat and mailto. Nothing leaves the browser except
// the URL the visitor opens themselves.
import { strings } from "./i18n.ts";
import type { Config, Quote } from "./types.ts";

const SPACES = /[\u00a0\u202f\u2007]/g;
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** Trim, strip control/bidi characters, collapse whitespace, cap at 80 chars. Empty -> throws. */
export function cleanLeadName(name: unknown): string {
  const n = String(name ?? "").replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 80).trim();
  if (!n) throw new Error("Lead name is required");
  return n;
}

export function buildLeadMessage(config: Config, quote: Quote, lead: { name: string }, mode: "owner" | "share" = "owner"): string {
  const name = cleanLeadName(lead?.name);
  const t = strings(config.locale);
  const d = quote.display;
  const lines = [
    mode === "owner" ? t.greetOwner(config.business.name, name) : t.greetShare(config.business.name, name),
    t.request(config.title),
    "",
    ...quote.answers.map((a) => `- ${a.label}: ${a.display}`),
    "",
    `${t.estimate}: ${d.low} – ${d.high}`,
  ];
  if (d.vatNote) lines.push(d.vatNote);
  if (config.vat?.show && !quote.vat.pricesInclude) lines.push(`${t.withVat}: ${d.lowGross} – ${d.highGross}`);
  return lines.join("\n").replace(SPACES, " ");
}

export function buildWhatsAppUrl(config: Config, quote: Quote, lead: { name: string }): string {
  const number = config.business.whatsapp ?? "";
  const text = buildLeadMessage(config, quote, lead, number ? "owner" : "share");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(config: Config, quote: Quote, lead: { name: string }): string | null {
  const email = config.business.email;
  if (!email) return null;
  const body = buildLeadMessage(config, quote, lead, "owner");
  const subject = strings(config.locale).mailSubject(config.title, cleanLeadName(lead.name)).replace(SPACES, " ");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
