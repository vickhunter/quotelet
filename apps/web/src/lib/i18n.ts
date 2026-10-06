// D-004c: UI dictionary for the builder flow (/build and /q). EN is the source of truth;
// IT must have the same keys (enforced by the type and by i18n.test.ts).
// Copy rules: short, plain, no em dashes. IT is what an Italian painter would say.

export type UiLang = 'en' | 'it'
export const UI_LANGS: readonly UiLang[] = ['en', 'it']
export const UI_LANG_KEY = 'quotelet:lang'

export const EN = {
  'nav.home': 'Home',
  'nav.main': 'Main',
  'logo.home': 'Quotelet home',
  'ui.legend': 'Language',
  'ui.en': 'English',
  'ui.it': 'Italian',
  'build.metaTitle': 'Quotelet: instant quotes on any website, leads straight to WhatsApp',
  'build.title': 'Build your calculator',
  'build.lede': 'Free. No account. Your draft stays in this browser.',
  'build.template': 'Template',
  'build.business': 'Your business',
  'build.businessName': 'Business name',
  'build.whatsapp': 'WhatsApp number',
  'build.whatsappHint': 'With country code. Leave empty for a share-only calculator.',
  'build.email': 'Email',
  'build.optional': 'optional',
  'build.prices': 'Questions and prices',
  'build.vat': 'VAT %',
  'build.vatIncluded': 'Prices include VAT',
  'build.formula': 'Formula',
  'build.formulaHint': 'Use + − × ÷, min(), max() and these names:',
  'build.preview': 'Live preview',
  'build.empty': 'Pick a template to see your calculator here.',
  'fe.labelFor': 'Label for {id}',
  'fe.idTitle': 'Name to use in the formula',
  'fe.startsAt': 'Starts at',
  'fe.default': '{label} default',
  'fe.option': 'Option {n} of {label}',
  'fe.price': '{label} price',
  'fe.on': 'When ticked',
  'fe.off': 'When not ticked',
  'fe.onAria': '{label} on',
  'fe.offAria': '{label} off',
  'wa.digits': 'Use digits only, with the country code.',
  'wa.short': 'Too short. Include the country code, e.g. +39.',
  'wa.long': 'Too long for a phone number.',
  'formula.position': 'position {n}',
  'block.template': 'Pick a template first.',
  'block.formula': 'Fix the formula to share.',
  'block.name': 'Add your business name.',
  'block.whatsapp': 'Fix the WhatsApp number.',
  'share.title': 'Share',
  'share.link': 'Share link',
  'share.copyLink': 'Copy link',
  'share.copied': 'Copied',
  'share.copyEmbed': 'Copy embed code',
  'share.download': 'Download JSON',
  'share.open': 'Open',
  'share.copiedSr': 'Copied to clipboard',
  'widget.loadError': 'The calculator could not load. Refresh the page to try again.',
  'q.metaTitle': 'Quote calculator',
  'q.emptyTitle': 'No calculator in this link',
  'q.emptyBody': 'The link looks cut off. Ask for it again, or build your own.',
  'q.emptyCta': 'Build a calculator',
  'q.msgLang': 'Message language',
  'q.msgFallback': 'Translation unavailable. WhatsApp uses the standard message.',
  'q.writing': 'Writing…',
  'lang.it': 'Italiano',
  'lang.de': 'Deutsch',
  'lang.fr': 'Français',
  'lang.en': 'English',
} as const

export type UiKey = keyof typeof EN
export type Dict = Record<UiKey, string>

export const IT: Dict = {
  'nav.home': 'Inizio',
  'nav.main': 'Principale',
  'logo.home': 'Quotelet, pagina iniziale',
  'ui.legend': 'Lingua',
  'ui.en': 'Inglese',
  'ui.it': 'Italiano',
  'build.metaTitle': 'Crea il tuo calcolatore di preventivi | Quotelet',
  'build.title': 'Crea il tuo calcolatore',
  'build.lede': 'Gratis, senza registrazione. La bozza resta salvata su questo dispositivo.',
  'build.template': 'Modello',
  'build.business': 'La tua attività',
  'build.businessName': "Nome dell'attività",
  'build.whatsapp': 'Numero WhatsApp',
  'build.whatsappHint': 'Con prefisso, es. +39. Se lo lasci vuoto, i clienti potranno solo condividere la stima.',
  'build.email': 'Email',
  'build.optional': 'facoltativa',
  'build.prices': 'Domande e prezzi',
  'build.vat': 'IVA %',
  'build.vatIncluded': 'Prezzi IVA inclusa',
  'build.formula': 'Formula',
  'build.formulaHint': 'Usa + − × ÷, min(), max() e questi nomi:',
  'build.preview': 'Anteprima',
  'build.empty': 'Scegli un modello per vedere qui il calcolatore.',
  'fe.labelFor': 'Testo della domanda {id}',
  'fe.idTitle': 'Nome da usare nella formula',
  'fe.startsAt': 'Valore iniziale',
  'fe.default': '{label}: valore iniziale',
  'fe.option': 'Opzione {n} di {label}',
  'fe.price': 'Prezzo {label}',
  'fe.on': 'Se selezionato',
  'fe.off': 'Se non selezionato',
  'fe.onAria': '{label}: se selezionato',
  'fe.offAria': '{label}: se non selezionato',
  'wa.digits': 'Solo cifre, con il prefisso internazionale.',
  'wa.short': 'Troppo corto. Aggiungi il prefisso, es. +39.',
  'wa.long': 'Troppo lungo per un numero di telefono.',
  'formula.position': 'posizione {n}',
  'block.template': 'Prima scegli un modello.',
  'block.formula': 'Correggi la formula per condividere.',
  'block.name': "Aggiungi il nome dell'attività.",
  'block.whatsapp': 'Correggi il numero WhatsApp.',
  'share.title': 'Condividi',
  'share.link': 'Link da condividere',
  'share.copyLink': 'Copia link',
  'share.copied': 'Copiato',
  'share.copyEmbed': 'Copia codice per il sito',
  'share.download': 'Scarica JSON',
  'share.open': 'Apri',
  'share.copiedSr': 'Copiato negli appunti',
  'widget.loadError': 'Il calcolatore non si è caricato. Ricarica la pagina.',
  'q.metaTitle': 'Calcolatore di preventivi',
  'q.emptyTitle': "In questo link non c'è nessun calcolatore",
  'q.emptyBody': 'Il link sembra incompleto. Chiedilo di nuovo o crea il tuo calcolatore.',
  'q.emptyCta': 'Crea un calcolatore',
  'q.msgLang': 'Lingua del messaggio',
  'q.msgFallback': 'Traduzione non disponibile: su WhatsApp va il messaggio predefinito.',
  'q.writing': 'Sto scrivendo…',
  'lang.it': 'Italiano',
  'lang.de': 'Tedesco',
  'lang.fr': 'Francese',
  'lang.en': 'Inglese',
}

/** Keys allowed to read the same in EN and IT (brand, format or loan words Italians use). */
export const SAME_IN_BOTH: readonly UiKey[] = ['build.email', 'build.formula', 'lang.it']

const DICTS: Record<UiLang, Dict> = { en: EN, it: IT }

export const isUiLang = (v: unknown): v is UiLang => v === 'en' || v === 'it'
export const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

export function t(lang: UiLang, key: UiKey, vars?: Record<string, string | number>) {
  const s = (DICTS[lang] ?? EN)[key] ?? EN[key]
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

export type T = (key: UiKey, vars?: Record<string, string | number>) => string
export const translator = (lang: UiLang): T => (key, vars) => t(lang, key, vars)

export const uiLangOfLocale = (locale: string | undefined): UiLang => (locale?.toLowerCase().startsWith('it') ? 'it' : 'en')

/** ?lang= wins, then an Italian template in the URL, then the saved choice, then EN. */
export function resolveUiLang(o: { param?: unknown; template?: string; stored?: unknown }): UiLang {
  if (isUiLang(o.param)) return o.param
  if (o.template?.endsWith('-it')) return 'it'
  if (isUiLang(o.stored)) return o.stored
  return 'en'
}

type Store = Pick<Storage, 'getItem' | 'setItem'>
export function loadUiLang(store: Store | undefined): UiLang | undefined {
  try {
    const v = store?.getItem(UI_LANG_KEY)
    return isUiLang(v) ? v : undefined
  } catch {
    return undefined
  }
}
export function saveUiLang(store: Store | undefined, lang: UiLang) {
  try { store?.setItem(UI_LANG_KEY, lang) } catch { /* private mode: keep it in the URL only */ }
}
