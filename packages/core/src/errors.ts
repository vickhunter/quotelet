// Config error messages in it/en/de/fr (fix 8b).
// validateConfig / decodeConfig / compileFormula and the widget keep producing { path, message } with the
// ENGLISH message (the API, the section 9 proxy contract and @aperto repair prompts depend on it). Each English
// message template has a stable code (errorCode) and it/de/fr text; localizeError() turns an error into the
// widget's display line in its language. Placeholders: %0, %1 (same set in every language). Swiss German: ss.
// The catalog is packed text (one line per message: en|it|de|fr) to keep the widget under its gzip budget;
// the code names are only needed by errorCode/ERRORS, which the widget does not import (tree-shaken).
import { lang } from "./i18n.ts";
import type { ValidationError } from "./types.ts";

const ROWS = `Config must be a JSON object|La configurazione deve essere un oggetto JSON|Die Konfiguration muss ein JSON-Objekt sein|La configuration doit être un objet JSON
is required|è obbligatorio|ist erforderlich|est obligatoire
must be a string|deve essere un testo|muss ein Text sein|doit être un texte
must not be empty|non può essere vuoto|darf nicht leer sein|ne doit pas être vide
must be at most %0 characters|può avere al massimo %0 caratteri|darf höchstens %0 Zeichen lang sein|doit comporter au maximum %0 caractères
must be plain text (no control characters)|deve essere testo semplice (senza caratteri di controllo)|muss reiner Text sein (ohne Steuerzeichen)|doit être du texte brut (sans caractères de contrôle)
must be 1 (config version)|deve essere 1 (versione della configurazione)|muss 1 sein (Version der Konfiguration)|doit être 1 (version de la configuration)
must match ^[a-z][a-z0-9_-]{0,31}$|deve rispettare il formato ^[a-z][a-z0-9_-]{0,31}$|muss dem Muster ^[a-z][a-z0-9_-]{0,31}$ entsprechen|doit respecter le format ^[a-z][a-z0-9_-]{0,31}$
must match ^[a-z][a-z0-9_]{0,31}$|deve rispettare il formato ^[a-z][a-z0-9_]{0,31}$|muss dem Muster ^[a-z][a-z0-9_]{0,31}$ entsprechen|doit respecter le format ^[a-z][a-z0-9_]{0,31}$
must be a BCP 47 locale like it-IT|deve essere un codice lingua BCP 47 come it-IT|muss ein BCP-47-Sprachcode wie de-CH sein|doit être un code de langue BCP 47 comme fr-CH
must be an ISO 4217 code like EUR|deve essere un codice ISO 4217 come EUR|muss ein ISO-4217-Code wie CHF sein|doit être un code ISO 4217 comme CHF
is not a supported currency|non è una valuta supportata|ist keine unterstützte Währung|n'est pas une devise prise en charge
must be an object with at least a name|deve essere un oggetto con almeno un nome|muss ein Objekt mit mindestens einem Namen sein|doit être un objet avec au moins un nom
must be a phone number (digits only, 8-15 long)|deve essere un numero di telefono (solo cifre, da 8 a 15)|muss eine Telefonnummer sein (nur Ziffern, 8 bis 15 Stellen)|doit être un numéro de téléphone (chiffres uniquement, 8 à 15)
must be digits only (international format, no +), 8-15 long|deve contenere solo cifre (formato internazionale, senza +), da 8 a 15|darf nur Ziffern enthalten (internationales Format, ohne +), 8 bis 15 Stellen|doit contenir uniquement des chiffres (format international, sans +), 8 à 15
must be a valid email address|deve essere un indirizzo email valido|muss eine gültige E-Mail-Adresse sein|doit être une adresse e-mail valide
must be an array of 1-12 fields|deve essere un elenco di 1-12 campi|muss eine Liste mit 1 bis 12 Feldern sein|doit être une liste de 1 à 12 champs
must contain 1-12 fields|deve contenere da 1 a 12 campi|muss 1 bis 12 Felder enthalten|doit contenir de 1 à 12 champs
must be an object|deve essere un oggetto|muss ein Objekt sein|doit être un objet
"%0" is a reserved word|"%0" è una parola riservata|"%0" ist ein reserviertes Wort|"%0" est un mot réservé
duplicate field id "%0"|id di campo duplicato "%0"|doppelte Feld-ID "%0"|identifiant de champ en double "%0"
must be a number|deve essere un numero|muss eine Zahl sein|doit être un nombre
must be greater than min|deve essere maggiore del minimo|muss grösser als das Minimum sein|doit être supérieur au minimum
must be a positive number|deve essere un numero positivo|muss eine positive Zahl sein|doit être un nombre positif
must be a number between min and max|deve essere un numero tra minimo e massimo|muss eine Zahl zwischen Minimum und Maximum sein|doit être un nombre entre le minimum et le maximum
must be an array of 1-20 options|deve essere un elenco di 1-20 opzioni|muss eine Liste mit 1 bis 20 Optionen sein|doit être une liste de 1 à 20 options
must be an object { label, value }|deve essere un oggetto con etichetta e valore|muss ein Objekt mit Bezeichnung und Wert sein|doit être un objet avec un libellé et une valeur
must be an option index between 0 and %0|deve essere l'indice di un'opzione tra 0 e %0|muss die Nummer einer Option zwischen 0 und %0 sein|doit être l'indice d'une option entre 0 et %0
must be true or false|deve essere vero o falso|muss wahr oder falsch sein|doit être vrai ou faux
must be "number", "choice" or "toggle"|deve essere numero, scelta o interruttore|muss Zahl, Auswahl oder Schalter sein|doit être nombre, choix ou interrupteur
%0 (at position %1)|%0 (alla posizione %1)|%0 (an Stelle %1)|%0 (à la position %1)
must be { low, high } with 0 < low <= high <= 10|deve avere fattore basso e alto con 0 < basso <= alto <= 10|braucht einen unteren und oberen Faktor mit 0 < unten <= oben <= 10|doit avoir un facteur bas et haut avec 0 < bas <= haut <= 10
must be a currency amount between 0.01 and 100000 (whole cents)|deve essere un importo tra 0,01 e 100000 (centesimi interi)|muss ein Betrag zwischen 0.01 und 100000 sein (ganze Rappen bzw. Cent)|doit être un montant entre 0.01 et 100000 (centimes entiers)
must be { rate, pricesInclude, show }|deve contenere aliquota, prezzi IVA inclusa e visualizzazione|muss Satz, Preise inkl. MWST und Anzeige enthalten|doit contenir le taux, les prix TVA comprise et l'affichage
must be a percentage between 0 and 100|deve essere una percentuale tra 0 e 100|muss ein Prozentsatz zwischen 0 und 100 sein|doit être un pourcentage entre 0 et 100
Encoded config is larger than 8 KB|La configurazione codificata supera 8 KB|Die codierte Konfiguration ist grösser als 8 KB|La configuration encodée dépasse 8 Ko
Division by zero with the default answers (the quote will show 0)|Divisione per zero con le risposte predefinite (la stima mostrerà 0)|Division durch null mit den Standardantworten (die Schätzung zeigt 0)|Division par zéro avec les réponses par défaut (l'estimation affichera 0)
Config could not be validated|Impossibile verificare la configurazione|Die Konfiguration konnte nicht geprüft werden|La configuration n'a pas pu être vérifiée
Encoded config must be a string|La configurazione codificata deve essere un testo|Die codierte Konfiguration muss ein Text sein|La configuration encodée doit être un texte
Encoded config is empty|La configurazione codificata è vuota|Die codierte Konfiguration ist leer|La configuration encodée est vide
Encoded config is not valid base64url|La configurazione codificata non è base64url valido|Die codierte Konfiguration ist kein gültiges base64url|La configuration encodée n'est pas du base64url valide
Encoded config is not valid UTF-8|La configurazione codificata non è UTF-8 valido|Die codierte Konfiguration ist kein gültiges UTF-8|La configuration encodée n'est pas de l'UTF-8 valide
Encoded config is not valid JSON|La configurazione codificata non è JSON valido|Die codierte Konfiguration ist kein gültiges JSON|La configuration encodée n'est pas du JSON valide
Encoded config could not be read|Impossibile leggere la configurazione codificata|Die codierte Konfiguration konnte nicht gelesen werden|La configuration encodée n'a pas pu être lue
Unknown identifier "%0"|Identificatore sconosciuto "%0"|Unbekannte Feld-ID "%0"|Identifiant inconnu "%0"
Assignment is not allowed (use == inside if())|L'assegnazione non è consentita (usa == dentro if())|Zuweisungen sind nicht erlaubt (== innerhalb von if() verwenden)|L'affectation n'est pas autorisée (utilisez == dans if())
Unexpected character "%0"|Carattere inatteso "%0"|Unerwartetes Zeichen "%0"|Caractère inattendu "%0"
Expected "%0" but the formula ended|Atteso "%0", ma la formula è finita|"%0" erwartet, aber die Formel ist zu Ende|"%0" attendu, mais la formule est terminée
Expected "%0"|Atteso "%0"|"%0" erwartet|"%0" attendu
Formula is nested too deeply|La formula è annidata troppo in profondità|Die Formel ist zu tief verschachtelt|La formule est trop imbriquée
"%0" must be followed by "("|"%0" deve essere seguito da "("|Nach "%0" muss "(" folgen|"%0" doit être suivi de "("
if() needs 3 arguments: if(condition, then, else)|if() richiede 3 argomenti: if(condizione, allora, altrimenti)|if() braucht 3 Werte: if(Bedingung, dann, sonst)|if() demande 3 paramètres: if(condition, alors, sinon)
%0() needs at least 1 argument|%0() richiede almeno 1 argomento|%0() braucht mindestens 1 Wert|%0() demande au moins 1 paramètre
%0() takes exactly 1 argument|%0() accetta esattamente 1 argomento|%0() braucht genau 1 Wert|%0() demande exactement 1 paramètre
Unexpected end of formula|Fine della formula inattesa|Unerwartetes Ende der Formel|Fin de formule inattendue
Unexpected "%0"|Inatteso: "%0"|Unerwartet: "%0"|Inattendu: "%0"
Comparisons are only allowed as the first argument of if()|I confronti sono ammessi solo come primo argomento di if()|Vergleiche sind nur als erster Wert von if() erlaubt|Les comparaisons ne sont autorisées que comme premier paramètre de if()
Missing operator between values|Manca un operatore tra i valori|Zwischen den Werten fehlt ein Rechenzeichen|Opérateur manquant entre les valeurs
Formula must be a string|La formula deve essere un testo|Die Formel muss ein Text sein|La formule doit être un texte
Formula is longer than %0 characters|La formula supera %0 caratteri|Die Formel ist länger als %0 Zeichen|La formule dépasse %0 caractères
Formula is empty|La formula è vuota|Die Formel ist leer|La formule est vide
Formula could not be parsed|Impossibile leggere la formula|Die Formel konnte nicht gelesen werden|La formule n'a pas pu être lue
Division by zero at position %0|Divisione per zero alla posizione %0|Division durch null an Stelle %0|Division par zéro à la position %0
No config given (expected a config object or a base64url string)|Nessuna configurazione (serve un oggetto o un testo base64url)|Keine Konfiguration angegeben (erwartet: Objekt oder base64url-Text)|Aucune configuration fournie (objet ou texte base64url attendu)
The calculator could not start|Il calcolatore non è riuscito ad avviarsi|Der Rechner konnte nicht starten|Le calculateur n'a pas pu démarrer
Config request failed (HTTP %0)|Caricamento della configurazione non riuscito (HTTP %0)|Die Konfiguration konnte nicht geladen werden (HTTP %0)|La configuration n'a pas pu être chargée (HTTP %0)
Config file is too large|Il file di configurazione è troppo grande|Die Konfigurationsdatei ist zu gross|Le fichier de configuration est trop volumineux
Config could not be loaded|Impossibile caricare la configurazione|Die Konfiguration konnte nicht geladen werden|La configuration n'a pas pu être chargée`;
const CODES = `notObject|required|string|empty|maxChars|plain|version|configId|fieldId|locale|currencyCode|currencyUnsupported|businessObj|waPhone|waDigits|email|fieldsArray|fieldsCount|object|reserved|duplicateId|number|maxGtMin|positive|defaultRange|optionsArray|optionObj|defaultIndex|bool|fieldType|formulaAt|range|rounding|vatObj|vatRate|tooLarge|divZero|notValidated|encString|encEmpty|encB64|encUtf8|encJson|encRead|unknownId|assign|unexpectedChar|expectedEnd|expected|nested|needsParen|if3|minArgs|oneArg|unexpectedEnd|unexpected|comparison|missingOp|formulaString|formulaLong|formulaEmpty|formulaParse|divAt|noConfig|cantStart|http|fileLarge|loadFail`;
// path key|it|de|fr; "x[]" is an indexed segment (1-based in the display)
const PATHS = `v|versione|Version|version
id|id|ID|identifiant
locale|lingua|Sprache|langue
currency|valuta|Währung|devise
title|titolo|Titel|titre
business|attività|Firma|entreprise
name|nome|Name|nom
whatsapp|WhatsApp|WhatsApp|WhatsApp
email|email|E-Mail|e-mail
fields|campi|Felder|champs
label|etichetta|Bezeichnung|libellé
type|tipo|Typ|type
min|minimo|Minimum|minimum
max|massimo|Maximum|maximum
step|passo|Schritt|pas
unit|unità|Einheit|unité
default|predefinito|Standardwert|valeur par défaut
options|opzioni|Optionen|options
value|valore|Wert|valeur
on|valore se attivo|Wert wenn an|valeur si activé
off|valore se disattivo|Wert wenn aus|valeur si désactivé
formula|formula|Formel|formule
range|intervallo|Spanne|fourchette
rounding|arrotondamento|Rundung|arrondi
vat|IVA|MWST|TVA
rate|aliquota|Satz|taux
pricesInclude|prezzi IVA inclusa|Preise inkl. MWST|prix TVA comprise
show|visualizzazione|Anzeige|affichage
disclaimer|avvertenza|Hinweis|mention
branding|marchio Quotelet|Quotelet-Hinweis|mention Quotelet
fields[]|campo %0|Feld %0|champ %0
options[]|opzione %0|Option %0|option %0`;
const GENERIC = ["valore non valido", "ungültiger Wert", "valeur non valide"]; // unknown message: it, de, fr
const LI = { it: 1, de: 2, fr: 3 } as const;
const SEP = " › ";

let rows: string[][] | undefined;
const table = () => (rows ??= ROWS.split("\n").map((l) => l.split("|")));
let paths: Record<string, string[]> | undefined;
const pathTable = () => (paths ??= Object.fromEntries(PATHS.split("\n").map((l) => { const [k, ...t] = l.split("|"); return [k, ["", ...t]]; })));
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const fill = (tpl: string, p: (string | number)[]) => tpl.replace(/%(\d)/g, (_, i) => String(p[Number(i)] ?? ""));

let matchers: { i: number; re: RegExp; order: number[] }[] | undefined;
function match(message: unknown): { i: number; params: string[] } | null {
  if (typeof message !== "string") return null;
  matchers ??= table().map((r, i) => ({
    i, order: (r[0].match(/%\d/g) ?? []).map((s) => Number(s[1])),
    re: new RegExp("^" + r[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%\d/g, "(.*?)") + "$", "s"),
  })).sort((a, b) => table()[b.i][0].length - table()[a.i][0].length);
  for (const m of matchers) {
    const r = m.re.exec(message);
    if (r) { const params: string[] = []; m.order.forEach((n, k) => { params[n] = r[k + 1]; }); return { i: m.i, params }; }
  }
  return null;
}

export type ErrorText = { en: string; it: string; de: string; fr: string };
/** code -> { en, it, de, fr } templates. */
export const ERRORS: Record<string, ErrorText> = /* @__PURE__ */ (() => {
  const out: Record<string, ErrorText> = {};
  CODES.split("|").forEach((c, i) => { const [en, it, de, fr] = table()[i]; out[c] = { en, it, de, fr }; });
  return out;
})();

/** Stable code of an English error message (or of a ValidationError); null if it is not one of ours. */
export function errorCode(e: string | ValidationError): string | null {
  const m = match(typeof e === "string" ? e : e?.message);
  return m ? CODES.split("|")[m.i] : null;
}

/** "fields[2].options[0].label" -> "Feld 3 > Option 1 > Bezeichnung" (de). English keeps the raw path. */
export function localizePath(p: string, locale: string | null | undefined): string {
  const l = lang(locale);
  if (l === "en" || !p) return p;
  const t = pathTable(), i = LI[l];
  return p.split(".").map((seg) => {
    const m = /^([A-Za-z]+)\[(\d+)\]$/.exec(seg);
    if (m && own(t, m[1] + "[]")) return fill(t[m[1] + "[]"][i], [Number(m[2]) + 1]);
    return own(t, seg) ? t[seg][i] : seg;
  }).join(SEP);
}

/** English message -> the same message in the locale's language (nested formula errors included). */
export function localizeMessage(message: string, locale: string | null | undefined): string {
  const l = lang(locale);
  if (l === "en") return message;
  const m = match(message);
  if (!m) return GENERIC[LI[l] - 1];
  return fill(table()[m.i][LI[l]], m.params.map((p) => (match(p) ? localizeMessage(p, l) : p)));
}

/** Display line for one error in the widget's language: "path: message" (English: exactly as before). */
export function localizeError(e: ValidationError, locale: string | null | undefined): string {
  const p = localizePath(e.path, locale), msg = localizeMessage(e.message, locale);
  return p ? `${p}: ${msg}` : msg;
}
