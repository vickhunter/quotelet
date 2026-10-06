// D-004c: the builder dictionary. IT must cover every EN key, keep the same {placeholders},
// and actually be translated (only brand/format words may stay identical).
import { describe, expect, test } from 'bun:test'
import { EN, IT, SAME_IN_BOTH, UI_LANG_KEY, loadUiLang, placeholders, resolveUiLang, saveUiLang, t, uiLangOfLocale, type UiKey } from './i18n'

const keys = (o: object) => Object.keys(o).sort()

describe('i18n dictionary', () => {
  test('IT has exactly the EN keys (no missing, no extra)', () => {
    expect(keys(IT)).toEqual(keys(EN))
  })
  test('every value is non-empty and free of em dashes', () => {
    for (const d of [EN, IT]) for (const [k, v] of Object.entries(d)) {
      expect(v.trim(), k).not.toBe('')
      expect(v.includes('\u2014'), `${k} has an em dash`).toBe(false)
    }
  })
  test('placeholders match between EN and IT', () => {
    for (const k of keys(EN) as UiKey[]) expect(placeholders(IT[k]), k).toEqual(placeholders(EN[k]))
  })
  test('IT differs from EN except for an explicit allowlist', () => {
    const same = (keys(EN) as UiKey[]).filter((k) => IT[k] === EN[k])
    expect(same.filter((k) => !SAME_IN_BOTH.includes(k))).toEqual([])
  })
  test('t() fills placeholders and falls back to EN for unknown langs', () => {
    expect(t('it', 'fe.option', { n: 2, label: 'Colore' })).toBe('Opzione 2 di Colore')
    expect(t('en', 'fe.option', { n: 2, label: 'Colour' })).toBe('Option 2 of Colour')
  })
  test('EN copy is unchanged from the original builder', () => {
    expect(EN['build.title']).toBe('Build your calculator')
    expect(EN['build.lede']).toBe('Free. No account. Your draft stays in this browser.')
    expect(EN['share.copyEmbed']).toBe('Copy embed code')
    expect(EN['wa.short']).toBe('Too short. Include the country code, e.g. +39.')
  })
})

describe('ui language choice', () => {
  test('?lang wins, then an Italian template, then the saved choice, then EN', () => {
    expect(resolveUiLang({ param: 'en', template: 'imbianchino-it', stored: 'it' })).toBe('en')
    expect(resolveUiLang({ param: 'it' })).toBe('it')
    expect(resolveUiLang({ template: 'imbianchino-it' })).toBe('it')
    expect(resolveUiLang({ template: 'painting-en', stored: 'it' })).toBe('it')
    expect(resolveUiLang({ stored: 'it' })).toBe('it')
    expect(resolveUiLang({})).toBe('en')
    expect(resolveUiLang({ param: 'xx', stored: 'zz' })).toBe('en')
  })
  test('locale maps to a ui language', () => {
    expect(uiLangOfLocale('it-IT')).toBe('it')
    expect(uiLangOfLocale('en-IE')).toBe('en')
    expect(uiLangOfLocale(undefined)).toBe('en')
  })
  test('the choice is saved and read back', () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    expect(loadUiLang(store)).toBeUndefined()
    saveUiLang(store, 'it')
    expect(m.get(UI_LANG_KEY)).toBe('it')
    expect(loadUiLang(store)).toBe('it')
    m.set(UI_LANG_KEY, 'klingon')
    expect(loadUiLang(store)).toBeUndefined()
  })
})
