// D-004c + H-01 /q DE/FR: UI dictionary for /build (EN/IT) and /q chrome (EN/IT/DE/FR).
// EN is the source of truth; IT/DE/FR must have the same keys (enforced by the type and by i18n.test.ts).
// Copy rules: short, plain, no em dashes. Swiss DE: ss never ß; Offerte/MWST. Swiss FR: offre/TVA.
// Builder UI stays EN|IT only (UI_LANGS / resolveUiLang); /q follows config.locale via uiLangOfLocale.

export type BuilderLang = 'en' | 'it'
export type UiLang = BuilderLang | 'de' | 'fr'
export const UI_LANGS: readonly BuilderLang[] = ['en', 'it']
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
  'wa.prefix': 'Country code missing. Type +39 before the number.',
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
  'demo.recorded': 'Demo: recorded answers',
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
  'wa.prefix': 'Manca il prefisso internazionale. Scrivi +39 prima del numero.',
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
  'demo.recorded': 'Demo: risposte registrate',
  'lang.it': 'Italiano',
  'lang.de': 'Tedesco',
  'lang.fr': 'Francese',
  'lang.en': 'Inglese',
}

/** Swiss German (de-CH): ss never ß; Offerte; MWST. Short copy for /q chrome + full key parity. */
export const DE: Dict = {
  'nav.home': 'Start',
  'nav.main': 'Haupt',
  'logo.home': 'Quotelet Startseite',
  'ui.legend': 'Sprache',
  'ui.en': 'Englisch',
  'ui.it': 'Italienisch',
  'build.metaTitle': 'Quotelet: Sofort-Offerten auf jeder Website, Anfragen an WhatsApp',
  'build.title': 'Rechner erstellen',
  'build.lede': 'Gratis. Ohne Konto. Der Entwurf bleibt in diesem Browser.',
  'build.template': 'Vorlage',
  'build.business': 'Ihr Betrieb',
  'build.businessName': 'Betriebsname',
  'build.whatsapp': 'WhatsApp-Nummer',
  'build.whatsappHint': 'Mit Vorwahl. Leer lassen für nur Teilen.',
  'build.email': 'Email',
  'build.optional': 'fakultativ',
  'build.prices': 'Fragen und Preise',
  'build.vat': 'MWST %',
  'build.vatIncluded': 'Preise inkl. MWST',
  'build.formula': 'Formel',
  'build.formulaHint': 'Mit + − × ÷, min(), max() und diesen Namen:',
  'build.preview': 'Vorschau',
  'build.empty': 'Vorlage wählen, um den Rechner hier zu sehen.',
  'fe.labelFor': 'Bezeichnung für {id}',
  'fe.idTitle': 'Name in der Formel',
  'fe.startsAt': 'Startwert',
  'fe.default': '{label}: Startwert',
  'fe.option': 'Option {n} von {label}',
  'fe.price': 'Preis {label}',
  'fe.on': 'Wenn aktiv',
  'fe.off': 'Wenn nicht aktiv',
  'fe.onAria': '{label}: wenn aktiv',
  'fe.offAria': '{label}: wenn nicht aktiv',
  'wa.digits': 'Nur Ziffern, mit Ländervorwahl.',
  'wa.short': 'Zu kurz. Vorwahl angeben, z. B. +41.',
  'wa.long': 'Zu lang für eine Telefonnummer.',
  'wa.prefix': 'Ländervorwahl fehlt. +41 vor die Nummer setzen.',
  'formula.position': 'Position {n}',
  'block.template': 'Zuerst eine Vorlage wählen.',
  'block.formula': 'Formel korrigieren zum Teilen.',
  'block.name': 'Betriebsname angeben.',
  'block.whatsapp': 'WhatsApp-Nummer korrigieren.',
  'share.title': 'Teilen',
  'share.link': 'Link zum Teilen',
  'share.copyLink': 'Link kopieren',
  'share.copied': 'Kopiert',
  'share.copyEmbed': 'Einbettungscode kopieren',
  'share.download': 'JSON herunterladen',
  'share.open': 'Öffnen',
  'share.copiedSr': 'In die Zwischenablage kopiert',
  'widget.loadError': 'Der Rechner konnte nicht geladen werden. Seite neu laden.',
  'q.metaTitle': 'Offertenrechner',
  'q.emptyTitle': 'Kein Rechner in diesem Link',
  'q.emptyBody': 'Der Link scheint unvollständig. Bitte erneut anfordern oder selbst einen erstellen.',
  'q.emptyCta': 'Rechner erstellen',
  'q.msgLang': 'Sprache der Nachricht',
  'q.msgFallback': 'Übersetzung nicht verfügbar. WhatsApp nutzt die Standardnachricht.',
  'q.writing': 'Schreibe…',
  'demo.recorded': 'Demo: aufgezeichnete Antworten',
  'lang.it': 'Italiano',
  'lang.de': 'Deutsch',
  'lang.fr': 'Français',
  'lang.en': 'Englisch',
}

/** Swiss French (fr-CH): offre; TVA. Short copy for /q chrome + full key parity. */
export const FR: Dict = {
  'nav.home': 'Accueil',
  'nav.main': 'Principal',
  'logo.home': 'Quotelet, page d\'accueil',
  'ui.legend': 'Langue',
  'ui.en': 'Anglais',
  'ui.it': 'Italien',
  'build.metaTitle': 'Quotelet: offres instantanées sur tout site, demandes sur WhatsApp',
  'build.title': 'Créer votre calculateur',
  'build.lede': 'Gratuit. Sans compte. Le brouillon reste dans ce navigateur.',
  'build.template': 'Modèle',
  'build.business': 'Votre entreprise',
  'build.businessName': 'Nom de l\'entreprise',
  'build.whatsapp': 'Numéro WhatsApp',
  'build.whatsappHint': 'Avec indicatif. Vide = partage seul.',
  'build.email': 'Email',
  'build.optional': 'facultatif',
  'build.prices': 'Questions et prix',
  'build.vat': 'TVA %',
  'build.vatIncluded': 'Prix TVA comprise',
  'build.formula': 'Formule',
  'build.formulaHint': 'Utilisez + − × ÷, min(), max() et ces noms:',
  'build.preview': 'Aperçu',
  'build.empty': 'Choisissez un modèle pour voir le calculateur ici.',
  'fe.labelFor': 'Libellé pour {id}',
  'fe.idTitle': 'Nom dans la formule',
  'fe.startsAt': 'Valeur initiale',
  'fe.default': '{label}: valeur initiale',
  'fe.option': 'Option {n} de {label}',
  'fe.price': 'Prix {label}',
  'fe.on': 'Si coché',
  'fe.off': 'Si non coché',
  'fe.onAria': '{label}: si coché',
  'fe.offAria': '{label}: si non coché',
  'wa.digits': 'Chiffres seuls, avec l\'indicatif.',
  'wa.short': 'Trop court. Ajoutez l\'indicatif, p. ex. +41.',
  'wa.long': 'Trop long pour un numéro de téléphone.',
  'wa.prefix': 'Indicatif manquant. Tapez +41 avant le numéro.',
  'formula.position': 'position {n}',
  'block.template': 'Choisissez d\'abord un modèle.',
  'block.formula': 'Corrigez la formule pour partager.',
  'block.name': 'Ajoutez le nom de l\'entreprise.',
  'block.whatsapp': 'Corrigez le numéro WhatsApp.',
  'share.title': 'Partager',
  'share.link': 'Lien à partager',
  'share.copyLink': 'Copier le lien',
  'share.copied': 'Copié',
  'share.copyEmbed': 'Copier le code d\'intégration',
  'share.download': 'Télécharger JSON',
  'share.open': 'Ouvrir',
  'share.copiedSr': 'Copié dans le presse-papiers',
  'widget.loadError': 'Le calculateur n\'a pas pu se charger. Rechargez la page.',
  'q.metaTitle': 'Calculateur d\'offre',
  'q.emptyTitle': 'Aucun calculateur dans ce lien',
  'q.emptyBody': 'Le lien semble incomplet. Demandez-le à nouveau, ou créez le vôtre.',
  'q.emptyCta': 'Créer un calculateur',
  'q.msgLang': 'Langue du message',
  'q.msgFallback': 'Traduction indisponible. WhatsApp utilise le message habituel.',
  'q.writing': 'Rédaction…',
  'demo.recorded': 'Démo: réponses enregistrées',
  'lang.it': 'Italiano',
  'lang.de': 'Deutsch',
  'lang.fr': 'Français',
  'lang.en': 'Anglais',
}

/** Keys allowed to read the same in EN and IT (brand, format or loan words Italians use). */
export const SAME_IN_BOTH: readonly UiKey[] = ['build.email', 'build.formula', 'lang.it']

/** Keys allowed to match EN in DE (native names, brand Email, loan overlaps). */
export const SAME_AS_EN_DE: readonly UiKey[] = [
  'build.email', 'lang.it', 'lang.de', 'lang.fr',
]

/** Keys allowed to match EN in FR (native names, brand Email, loan overlaps). */
export const SAME_AS_EN_FR: readonly UiKey[] = [
  'build.email', 'lang.it', 'lang.de', 'lang.fr', 'formula.position',
]

const DICTS: Record<UiLang, Dict> = { en: EN, it: IT, de: DE, fr: FR }

export const isBuilderLang = (v: unknown): v is BuilderLang => v === 'en' || v === 'it'
export const isUiLang = (v: unknown): v is UiLang => v === 'en' || v === 'it' || v === 'de' || v === 'fr'
export const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

export function t(lang: UiLang, key: UiKey, vars?: Record<string, string | number>) {
  const s = (DICTS[lang] ?? EN)[key] ?? EN[key]
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

export type T = (key: UiKey, vars?: Record<string, string | number>) => string
export const translator = (lang: UiLang): T => (key, vars) => t(lang, key, vars)

/** BCP 47 → page chrome language: it*→it, de*→de, fr*→fr, else en. */
export const uiLangOfLocale = (locale: string | undefined): UiLang => {
  const l = locale?.toLowerCase().split(/[-_]/)[0]
  if (l === 'it') return 'it'
  if (l === 'de') return 'de'
  if (l === 'fr') return 'fr'
  return 'en'
}

/** Builder only: ?lang= wins (en|it), then an Italian template in the URL, then the saved choice, then EN. */
export function resolveUiLang(o: { param?: unknown; template?: string; stored?: unknown }): BuilderLang {
  if (isBuilderLang(o.param)) return o.param
  if (o.template?.endsWith('-it')) return 'it'
  if (isBuilderLang(o.stored)) return o.stored
  return 'en'
}

type Store = Pick<Storage, 'getItem' | 'setItem'>
export function loadUiLang(store: Store | undefined): BuilderLang | undefined {
  try {
    const v = store?.getItem(UI_LANG_KEY)
    return isBuilderLang(v) ? v : undefined
  } catch {
    return undefined
  }
}
export function saveUiLang(store: Store | undefined, lang: BuilderLang) {
  try { store?.setItem(UI_LANG_KEY, lang) } catch { /* private mode: keep it in the URL only */ }
}
