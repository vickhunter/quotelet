import { t, type UiLang } from './i18n'

// packages/core reports formula errors as English strings with no codes, so the IT builder
// maps them by message pattern (one entry per error site in packages/core/src/formula.ts).
// A message core adds later falls back to a generic Italian line instead of leaking English.
const IT_PATTERNS: [RegExp, string][] = [
  [/^Unknown identifier "(.*)"$/, 'Nome sconosciuto "$1"'],
  [/^Unknown identifier$/, 'Nome sconosciuto'],
  [/^Assignment is not allowed.*$/, 'Qui non va "=". Dentro if() usa "=="'],
  [/^Unexpected character "(.*)"$/, 'Carattere non valido "$1"'],
  [/^Expected "(.*)" but the formula ended$/, 'Manca "$1" alla fine'],
  [/^Expected "(.*)"$/, 'Qui ci vuole "$1"'],
  [/^Expected (.+)$/, 'Qui ci vuole $1'],
  [/^Formula is nested too deeply$/, 'Troppe parentesi una dentro l\'altra'],
  [/^"(.*)" must be followed by "\("$/, 'Dopo "$1" ci vuole "("'],
  [/^if\(\) needs 3 arguments.*$/, 'if() vuole 3 parti: if(condizione, allora, altrimenti)'],
  [/^(\w+)\(\) needs at least 1 argument$/, '$1() vuole almeno un valore'],
  [/^(\w+)\(\) takes exactly 1 argument$/, '$1() vuole un solo valore'],
  [/^Unexpected end of formula$/, 'La formula finisce troppo presto'],
  [/^Unexpected "(.*)"$/, '"$1" qui non va'],
  [/^Comparisons are only allowed as the first argument of if\(\)$/, 'I confronti vanno solo come prima parte di if()'],
  [/^Missing operator between values$/, 'Manca un operatore tra due valori'],
  [/^Formula must be a string$/, 'La formula deve essere un testo'],
  [/^Formula is longer than (\d+) characters$/, 'La formula supera i $1 caratteri'],
  [/^Formula is empty$/, 'La formula è vuota'],
  [/^Formula could not be parsed$/, 'Formula non leggibile'],
]
export const IT_FORMULA_FALLBACK = 'Formula non valida'

export function italianFormulaMessage(message: string) {
  for (const [re, it] of IT_PATTERNS) if (re.test(message)) return message.replace(re, it)
  return IT_FORMULA_FALLBACK
}

/** Turns a compileFormula error into one readable line that names the offending token. */
export function formulaErrorMessage(src: string, err: { pos: number; message: string }, lang: UiLang = 'en') {
  const token = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(err.pos))?.[0]
  const message = lang === 'it' ? italianFormulaMessage(err.message) : err.message
  const named = token && !message.includes(token) ? `${message}: ${token}` : message
  return `${named} (${t(lang, 'formula.position', { n: err.pos + 1 })})`
}
