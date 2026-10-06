// D-004c: core formula errors stay English (packages/core has no error codes), so the IT
// builder maps them by message pattern. Every message core can emit must map to Italian.
import { describe, expect, test } from 'bun:test'
import { compileFormula } from '@quotelet/core'
import { formulaErrorMessage, italianFormulaMessage } from './formulaError'
import { ENGLISH_WORDS } from './englishWords'

const ids = ['mq', 'colore']
// One formula per error site in packages/core/src/formula.ts.
const BAD = [
  'mq * prezzo', // Unknown identifier
  'mq = 3', // Assignment
  'mq $ 2', // Unexpected character
  'max(mq', // Expected ")" but the formula ended
  'if(mq > 1, 2, 3 4)', // Expected ")" / Missing operator
  '('.repeat(70) + 'mq' + ')'.repeat(70), // nested too deeply
  'max + 1', // must be followed by "("
  'if(mq > 1, 2)', // if() needs 3 arguments
  'max()', // needs at least 1 argument
  'round(mq, 2)', // takes exactly 1 argument
  'mq *', // Unexpected end
  'mq * )', // Unexpected ")"
  'mq > 2', // Comparisons only in if()
  'mq colore', // Missing operator between values
  '', // empty
  'mq + '.repeat(400) + 'mq', // too long
]

const englishIn = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => ENGLISH_WORDS.has(w))

describe('formula errors in Italian', () => {
  test('every core error message maps to Italian with no English words', () => {
    const seen = new Set<string>()
    for (const src of BAD) {
      const r = compileFormula(src, ids)
      expect(r.ok, src).toBe(false)
      if (r.ok) continue
      seen.add(r.error.message.replace(/"[^"]*"|\d+/g, '_'))
      const it = formulaErrorMessage(src, r.error, 'it')
      expect(englishIn(it), `${r.error.message} -> ${it}`).toEqual([])
      expect(italianFormulaMessage(r.error.message), r.error.message).not.toBe('Formula non valida')
      expect(it).toMatch(/\(posizione \d+\)$/)
    }
    expect(seen.size).toBeGreaterThanOrEqual(14)
  })
  test('core messages without a live trigger map too', () => {
    expect(italianFormulaMessage('Formula must be a string')).toBe('La formula deve essere un testo')
    expect(italianFormulaMessage('Formula could not be parsed')).toBe('Formula non leggibile')
    expect(italianFormulaMessage('Expected )')).toBe('Qui ci vuole )')
  })
  test('the unknown name keeps the user token', () => {
    expect(formulaErrorMessage('mq * prezzo_inesistente', { pos: 5, message: 'Unknown identifier "prezzo_inesistente"' }, 'it'))
      .toBe('Nome sconosciuto "prezzo_inesistente" (posizione 6)')
  })
  test('an unknown future core message falls back to generic Italian', () => {
    expect(formulaErrorMessage('mq', { pos: 0, message: 'Something new went wrong' }, 'it')).toBe('Formula non valida: mq (posizione 1)')
  })
  test('EN output is unchanged', () => {
    expect(formulaErrorMessage('mq * (2', { pos: 7, message: 'Expected )' })).toBe('Expected ) (position 8)')
    expect(formulaErrorMessage('mq * (2', { pos: 7, message: 'Expected )' }, 'en')).toBe('Expected ) (position 8)')
  })
})
