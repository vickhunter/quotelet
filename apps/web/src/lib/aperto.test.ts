import { describe, expect, test } from 'bun:test'
import { computeQuote } from '@quotelet/core'
import type { Config } from '@quotelet/core/types'
import {
  APERTO_DRAFT_KEY, APERTO_EXAMPLES, langOfLocale, leadText, loadApertoDraft, messageKey, requestConfig, requestMessage,
  saveApertoDraft, summarizeConfig, waUrl,
} from './aperto'

const mover: Config = {
  v: 1, id: 'umzug-lugano', locale: 'de-CH', currency: 'CHF', title: 'Was kostet Ihr Umzug?', business: { name: 'Umzug' },
  fields: [
    { id: 'volumen', type: 'number', label: 'Umzugsvolumen', unit: 'm³', min: 1, max: 200, step: 1, default: 20 },
    { id: 'etage_auszug', type: 'number', label: 'Stockwerk Auszug', min: 0, max: 20, step: 1, default: 0 },
    { id: 'etage_einzug', type: 'number', label: 'Stockwerk Einzug', min: 0, max: 20, step: 1, default: 0 },
    { id: 'ohne_lift', type: 'toggle', label: 'Kein Lift', on: 1, off: 0, default: false },
  ],
  formula: 'max(300, volumen * 45 + (etage_auszug + etage_einzug) * 20 * ohne_lift)',
  range: { low: 0.9, high: 1.1 }, rounding: 10, vat: { rate: 8.1, pricesInclude: true, show: true },
}
const quote = computeQuote(mover, { volumen: 20, etage_auszug: 3, etage_einzug: 0, ohne_lift: true })
const nb = (s: string) => s.replace(/[\u00a0\u202f\u2007]/g, ' ')

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
type Call = { url: string; init: RequestInit }
function fakeFetch(res: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return res() }) as unknown as typeof fetch
  return { f, calls }
}

describe('aperto examples', () => {
  test('three chips: mover Lugano DE/CHF, painter Padova IT/EUR, cleaner Lausanne FR/CHF', () => {
    expect(APERTO_EXAMPLES.map((e) => [e.id, e.lang])).toEqual([['mover-lugano', 'de'], ['painter-padova', 'it'], ['cleaner-lausanne', 'fr']])
    expect(APERTO_EXAMPLES[0].text).toBe('Umzug: 45 CHF pro m³, +20 CHF pro Stockwerk ohne Lift, mindestens 300 CHF, MwSt 8.1% inklusive')
  })
})

describe('validator summary', () => {
  test('counts fields and confirms the formula', () => {
    expect(summarizeConfig(mover)).toBe('4 fields, formula OK')
    expect(summarizeConfig({ ...mover, fields: [mover.fields[0]], formula: 'max(300, volumen * 45)' })).toBe('1 field, formula OK')
  })
  test('a formula that does not compile is never called OK', () => {
    expect(summarizeConfig({ ...mover, formula: 'volumen * nope' })).toMatch(/formula error/)
  })
})

describe('aperto draft', () => {
  test('round-trips text and language', () => {
    const st = memoryStorage()
    saveApertoDraft(st, { text: 'Umzug: 45 CHF', lang: 'de' })
    expect(st.m.has(APERTO_DRAFT_KEY)).toBe(true)
    expect(loadApertoDraft(st)).toEqual({ text: 'Umzug: 45 CHF', lang: 'de' })
  })
  test('garbage, a wrong version or a bad language returns null', () => {
    const st = memoryStorage()
    st.setItem(APERTO_DRAFT_KEY, '{nope')
    expect(loadApertoDraft(st)).toBeNull()
    st.setItem(APERTO_DRAFT_KEY, JSON.stringify({ version: 9, text: 'x', lang: 'de' }))
    expect(loadApertoDraft(st)).toBeNull()
    st.setItem(APERTO_DRAFT_KEY, JSON.stringify({ version: 1, text: 'x', lang: 'es' }))
    expect(loadApertoDraft(st)).toBeNull()
  })
  test('a throwing storage never breaks the page', () => {
    const bad = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    expect(() => saveApertoDraft(bad, { text: 'x', lang: 'it' })).not.toThrow()
    expect(loadApertoDraft(bad)).toBeNull()
  })
})

describe('requestConfig', () => {
  test('posts action config with text and lang and returns the success body', async () => {
    const { f, calls } = fakeFetch(() => Response.json({ ok: true, config: mover, attempts: 1, warnings: [] }))
    const r = await requestConfig(' Umzug: 45 CHF ', 'de', { fetch: f })
    expect(r).toEqual({ ok: true, config: mover, attempts: 1, warnings: [] })
    expect(calls[0].url).toBe('/api/aperto')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ action: 'config', text: 'Umzug: 45 CHF', lang: 'de' })
  })
  test('validator failures pass through with their error list', async () => {
    const errors = [{ path: 'fields[1].on', message: 'must be a number' }]
    const { f } = fakeFetch(() => Response.json({ ok: false, errors, attempts: 2 }))
    expect(await requestConfig('Gardening: 50 per hour, a bit more on Sundays', 'en', { fetch: f })).toEqual({ ok: false, errors, attempts: 2 })
  })
  test('empty or oversized text fails before any request', async () => {
    const { f, calls } = fakeFetch(() => Response.json({}))
    expect((await requestConfig('   ', 'it', { fetch: f })).ok).toBe(false)
    const big = await requestConfig('€'.repeat(2000), 'it', { fetch: f })
    expect(big.ok).toBe(false)
    expect(calls.length).toBe(0)
  })
  test('rate limit, network failure and non-JSON answers become readable errors', async () => {
    const limited = await requestConfig('x 1', 'it', { fetch: fakeFetch(() => new Response('{"ok":false,"errors":[]}', { status: 429, headers: { 'Retry-After': '30' } })).f })
    expect(limited.ok).toBe(false)
    if (!limited.ok) expect(limited.errors[0].message).toMatch(/30 s/)
    const down = await requestConfig('x 1', 'it', { fetch: fakeFetch(() => { throw new TypeError('Failed to fetch') }).f })
    expect(down.ok).toBe(false)
    if (!down.ok) expect(down.errors[0].path).toBe('network')
    const html = await requestConfig('x 1', 'it', { fetch: fakeFetch(() => new Response('<!doctype html>', { status: 200 })).f })
    expect(html.ok).toBe(false)
  })
})

describe('requestMessage', () => {
  test('posts action message with config, quote and lang', async () => {
    const { f, calls } = fakeFetch(() => Response.json({ ok: true, text: 'Buongiorno', source: 'model' }))
    expect(await requestMessage(mover, quote, 'it', { fetch: f })).toEqual({ ok: true, text: 'Buongiorno', source: 'model' })
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.action).toBe('message')
    expect(body.lang).toBe('it')
    expect(body.config).toEqual(mover)
    expect(body.quote.lowCents).toBe(quote.lowCents)
  })
  test('any failure returns ok:false so the page falls back to the core message', async () => {
    expect((await requestMessage(mover, quote, 'it', { fetch: fakeFetch(() => Response.json({ ok: false, errors: [] }, { status: 400 })).f })).ok).toBe(false)
    expect((await requestMessage(mover, quote, 'it', { fetch: fakeFetch(() => { throw new Error('offline') }).f })).ok).toBe(false)
  })
})

describe('WhatsApp text', () => {
  const text = `Buongiorno Umzug, la stima è tra ${nb(quote.display.low)} e ${nb(quote.display.high)}. IVA 8.1% inclusa.`
  test('keeps the model text, adds the answers and the customer name, amounts untouched', () => {
    const t = leadText(mover, quote, text, 'Giulia')
    expect(t.startsWith(text)).toBe(true)
    expect(t).toContain('- Umzugsvolumen: 20')
    expect(t.trim().endsWith('Giulia')).toBe(true)
    expect(t).toContain(nb(quote.display.low))
    expect(t).toContain(nb(quote.display.high))
  })
  test('wa.me link targets the owner number, or share mode without one', () => {
    expect(waUrl(mover, 'ciao')).toBe('https://wa.me/?text=ciao')
    expect(waUrl({ ...mover, business: { name: 'U', whatsapp: '41791234567' } }, 'a b')).toBe('https://wa.me/41791234567?text=a%20b')
  })
  test('messageKey changes with the amounts and the language', () => {
    const other = computeQuote(mover, { volumen: 30, etage_auszug: 0, etage_einzug: 0, ohne_lift: false })
    expect(messageKey(quote, 'it')).not.toBe(messageKey(other, 'it'))
    expect(messageKey(quote, 'it')).not.toBe(messageKey(quote, 'de'))
  })
})

describe('langOfLocale', () => {
  test('maps config locales to the four message languages', () => {
    expect(langOfLocale('de-CH')).toBe('de')
    expect(langOfLocale('fr-CH')).toBe('fr')
    expect(langOfLocale('it-IT')).toBe('it')
    expect(langOfLocale('en-IE')).toBe('en')
    expect(langOfLocale('es-ES')).toBe('en')
  })
})
