// D-004c + H-01 /q DE/FR: builder IT must cover every EN key; DE/FR cover the same keys for /q chrome.
// Placeholders match; only brand/format words may stay identical (explicit allowlists).
import { describe, expect, test } from 'bun:test'
import { DE, EN, FR, IT, SAME_AS_EN_DE, SAME_AS_EN_FR, SAME_IN_BOTH, UI_LANG_KEY, loadUiLang, placeholders, resolveUiLang, saveUiLang, t, uiLangOfLocale, type UiKey } from './i18n'

const keys = (o: object) => Object.keys(o).sort()
const Q_KEYS = (keys(EN) as UiKey[]).filter((k) => k.startsWith('q.') || k === 'widget.loadError' || k === 'demo.recorded' || k.startsWith('lang.'))

describe('i18n dictionary', () => {
  test('IT has exactly the EN keys (no missing, no extra)', () => {
    expect(keys(IT)).toEqual(keys(EN))
  })
  test('DE and FR have exactly the EN keys (no missing, no extra)', () => {
    expect(keys(DE)).toEqual(keys(EN))
    expect(keys(FR)).toEqual(keys(EN))
  })
  test('every value is non-empty and free of em dashes', () => {
    for (const d of [EN, IT, DE, FR]) for (const [k, v] of Object.entries(d)) {
      expect(v.trim(), k).not.toBe('')
      expect(v.includes('\u2014'), `${k} has an em dash`).toBe(false)
    }
  })
  test('placeholders match between EN and IT/DE/FR', () => {
    for (const k of keys(EN) as UiKey[]) {
      expect(placeholders(IT[k]), k).toEqual(placeholders(EN[k]))
      expect(placeholders(DE[k]), k).toEqual(placeholders(EN[k]))
      expect(placeholders(FR[k]), k).toEqual(placeholders(EN[k]))
    }
  })
  test('IT differs from EN except for an explicit allowlist', () => {
    const same = (keys(EN) as UiKey[]).filter((k) => IT[k] === EN[k])
    expect(same.filter((k) => !SAME_IN_BOTH.includes(k))).toEqual([])
  })
  test('DE and FR differ from EN except for explicit allowlists', () => {
    const sameDe = (keys(EN) as UiKey[]).filter((k) => DE[k] === EN[k])
    const sameFr = (keys(EN) as UiKey[]).filter((k) => FR[k] === EN[k])
    expect(sameDe.filter((k) => !SAME_AS_EN_DE.includes(k))).toEqual([])
    expect(sameFr.filter((k) => !SAME_AS_EN_FR.includes(k))).toEqual([])
  })
  test('Swiss German orthography: ss, never sharp s', () => {
    for (const [k, v] of Object.entries(DE)) expect(v.includes('\u00df'), k).toBe(false)
  })
  test('Share-page q.* / chrome keys are translated in DE and FR', () => {
    for (const k of Q_KEYS) {
      if (!SAME_AS_EN_DE.includes(k)) expect(DE[k], k).not.toBe(EN[k])
      if (!SAME_AS_EN_FR.includes(k)) expect(FR[k], k).not.toBe(EN[k])
    }
  })
  test('t() fills placeholders and serves de/fr', () => {
    expect(t('it', 'fe.option', { n: 2, label: 'Colore' })).toBe('Opzione 2 di Colore')
    expect(t('en', 'fe.option', { n: 2, label: 'Colour' })).toBe('Option 2 of Colour')
    expect(t('de', 'q.metaTitle').length).toBeGreaterThan(0)
    expect(t('fr', 'q.metaTitle').length).toBeGreaterThan(0)
    expect(t('de', 'q.metaTitle')).not.toBe(EN['q.metaTitle'])
    expect(t('fr', 'q.metaTitle')).not.toBe(EN['q.metaTitle'])
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
    // Builder ignores de/fr query params (builder stays EN/IT only).
    expect(resolveUiLang({ param: 'de', stored: 'it' })).toBe('it')
    expect(resolveUiLang({ param: 'fr' })).toBe('en')
  })
  test('locale maps to a ui language including de-CH and fr-CH', () => {
    expect(uiLangOfLocale('it-IT')).toBe('it')
    expect(uiLangOfLocale('en-IE')).toBe('en')
    expect(uiLangOfLocale(undefined)).toBe('en')
    expect(uiLangOfLocale('de-CH')).toBe('de')
    expect(uiLangOfLocale('de-DE')).toBe('de')
    expect(uiLangOfLocale('de')).toBe('de')
    expect(uiLangOfLocale('fr-CH')).toBe('fr')
    expect(uiLangOfLocale('fr-FR')).toBe('fr')
    expect(uiLangOfLocale('fr')).toBe('fr')
    expect(uiLangOfLocale('DE-ch')).toBe('de')
    expect(uiLangOfLocale('FR-ch')).toBe('fr')
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
    m.set(UI_LANG_KEY, 'de')
    expect(loadUiLang(store)).toBeUndefined()
  })
})
