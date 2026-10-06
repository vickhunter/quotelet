// Tiny message table for the two MVP languages. Anything that is not Italian falls back to English.
export type Strings = {
  yes: string; no: string;
  vatIncluded(rate: string): string; vatExcluded(rate: string): string;
  greetOwner(business: string, name: string): string; greetShare(business: string, name: string): string;
  request(title: string): string; estimate: string; withVat: string; mailSubject(title: string, name: string): string;
  ctaWhatsApp: string; ctaShare: string; ctaEmail: string; nameLabel: string; namePlaceholder: string;
  nameRequired: string; calcError: string; errorTitle: string; poweredBy: string; estimateLabel: string;
};
const it: Strings = {
  yes: "Sì", no: "No",
  vatIncluded: (r) => `Prezzi IVA inclusa (${r}%)`, vatExcluded: (r) => `Prezzi IVA esclusa (${r}%)`,
  greetOwner: (b, n) => `Ciao ${b}, sono ${n}.`, greetShare: (b, n) => `Ciao! Sono ${n}, ecco la stima calcolata con ${b}.`,
  request: (t) => `Vorrei un preventivo per: ${t}`, estimate: "Stima", withVat: "IVA inclusa",
  mailSubject: (t, n) => `Richiesta preventivo: ${t} (${n})`,
  ctaWhatsApp: "Invia su WhatsApp", ctaShare: "Condividi la stima su WhatsApp", ctaEmail: "Invia per email",
  nameLabel: "Il tuo nome", namePlaceholder: "Nome", nameRequired: "Scrivi il tuo nome per inviare la richiesta.",
  calcError: "Con queste risposte non è possibile calcolare una stima. Modifica i valori.",
  errorTitle: "Questo calcolatore non è configurato correttamente.", poweredBy: "Creato con Quotelet", estimateLabel: "Stima",
};
const en: Strings = {
  yes: "Yes", no: "No",
  vatIncluded: (r) => `Prices include VAT (${r}%)`, vatExcluded: (r) => `Prices exclude VAT (${r}%)`,
  greetOwner: (b, n) => `Hi ${b}, I'm ${n}.`, greetShare: (b, n) => `Hi! I'm ${n}, here is the estimate I got from ${b}.`,
  request: (t) => `I'd like a quote for: ${t}`, estimate: "Estimate", withVat: "Incl. VAT",
  mailSubject: (t, n) => `Quote request: ${t} (${n})`,
  ctaWhatsApp: "Send on WhatsApp", ctaShare: "Share the estimate on WhatsApp", ctaEmail: "Send by email",
  nameLabel: "Your name", namePlaceholder: "Name", nameRequired: "Please enter your name to send the request.",
  calcError: "These answers cannot produce an estimate. Please change the values.",
  errorTitle: "This calculator is not configured correctly.", poweredBy: "Made with Quotelet", estimateLabel: "Estimate",
};
export function strings(locale: string | undefined | null): Strings {
  return String(locale || "").toLowerCase().startsWith("it") ? it : en;
}
