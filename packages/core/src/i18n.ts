// Tiny message table: Italian, English, German and French (Swiss-appropriate: Offerte/offre, MWST/TVA,
// ss, never the sharp s). de-* -> de, fr-* -> fr, it-* -> it; anything else falls back to English.
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
const de: Strings = {
  yes: "Ja", no: "Nein",
  vatIncluded: (r) => `Preise inkl. MWST (${r}%)`, vatExcluded: (r) => `Preise exkl. MWST (${r}%)`,
  greetOwner: (b, n) => `Hallo ${b}, hier ist ${n}.`, greetShare: (b, n) => `Hallo! Hier ist ${n}. Das ist die Schätzung, die ich bei ${b} berechnet habe.`,
  request: (t) => `Ich hätte gerne eine Offerte für: ${t}`, estimate: "Schätzung", withVat: "Inkl. MWST",
  mailSubject: (t, n) => `Offertanfrage: ${t} (${n})`,
  ctaWhatsApp: "Per WhatsApp senden", ctaShare: "Schätzung per WhatsApp teilen", ctaEmail: "Per E-Mail senden",
  nameLabel: "Ihr Name", namePlaceholder: "Name", nameRequired: "Bitte geben Sie Ihren Namen ein, um die Anfrage zu senden.",
  calcError: "Mit diesen Angaben lässt sich keine Schätzung berechnen. Bitte passen Sie die Werte an.",
  errorTitle: "Dieser Rechner ist nicht richtig eingerichtet.", poweredBy: "Erstellt mit Quotelet", estimateLabel: "Schätzung",
};
const fr: Strings = {
  yes: "Oui", no: "Non",
  vatIncluded: (r) => `Prix TVA comprise (${r}%)`, vatExcluded: (r) => `Prix hors TVA (${r}%)`,
  greetOwner: (b, n) => `Bonjour ${b}, je m'appelle ${n}.`, greetShare: (b, n) => `Bonjour! C'est ${n}, voici l'estimation que j'ai calculée avec ${b}.`,
  request: (t) => `J'aimerais recevoir une offre pour: ${t}`, estimate: "Estimation", withVat: "TVA comprise",
  mailSubject: (t, n) => `Demande d'offre: ${t} (${n})`,
  ctaWhatsApp: "Envoyer par WhatsApp", ctaShare: "Partager l'estimation sur WhatsApp", ctaEmail: "Envoyer par e-mail",
  nameLabel: "Votre nom", namePlaceholder: "Nom", nameRequired: "Veuillez indiquer votre nom pour envoyer la demande.",
  calcError: "Ces réponses ne permettent pas de calculer une estimation. Veuillez modifier les valeurs.",
  errorTitle: "Ce calculateur n'est pas configuré correctement.", poweredBy: "Créé avec Quotelet", estimateLabel: "Estimation",
};
const TABLES: Record<string, Strings> = { it, en, de, fr };
export type Lang = "it" | "en" | "de" | "fr";
/** Language from a BCP 47 tag ("de-CH" -> de, "fr_FR" -> fr); unknown languages get English. */
export function lang(locale: string | undefined | null): Lang {
  const l = String(locale || "").toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(TABLES, l) ? (l as Lang) : "en"; // no prototype keys ("constructor")
}
export function strings(locale: string | undefined | null): Strings {
  return TABLES[lang(locale)];
}
