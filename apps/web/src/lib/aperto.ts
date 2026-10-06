// Browser side of Quotelet Aperto: talks to POST /api/aperto (hack-apertus-quotelet.md section 9).
// Amounts never come from here: the server re-formats core cents, and the WhatsApp text only adds
// core's own answer lines and the customer's name.
import { compileFormula } from '@quotelet/core'
import type { Config, Quote } from '@quotelet/core/types'
import { EXAMPLES } from '../../../../packages/aperto/src/examples.ts'
import { LANGS } from '../../../../packages/aperto/src/types.ts'
import type { ApiError, ConfigResponse, Lang, MessageResponse } from '../../../../packages/aperto/src/types.ts'

export type { ApiError, ConfigResponse, Lang, MessageResponse }
export { LANGS }
export const LANG_NAMES: Record<Lang, string> = { it: 'Italiano', de: 'Deutsch', fr: 'Français', en: 'English' }
export const APERTO_PATH = '/api/aperto'
const MAX_BODY = 4096
const MAX_TEXT = 3000
const SPACES = /[\u00a0\u202f\u2007]/g

/** The three chips (the broken example stays out: the demo types it by hand). */
export const APERTO_EXAMPLES = EXAMPLES.filter((e) => e.id !== 'broken-sundays')
export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as readonly string[]).includes(x)
export const langOfLocale = (locale: string): Lang => { const l = locale.slice(0, 2).toLowerCase(); return isLang(l) ? l : 'en' }

export function summarizeConfig(config: Config): string {
  const n = config.fields.length
  const ok = compileFormula(config.formula, config.fields.map((f) => f.id)).ok
  return `${n} field${n === 1 ? '' : 's'}, ${ok ? 'formula OK' : 'formula error'}`
}

// ---- draft (textarea + language), so a refresh never loses it ----------------------------------
export const APERTO_DRAFT_KEY = 'quotelet:aperto-draft'
export type ApertoDraft = { text: string; lang: Lang }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function saveApertoDraft(store: Store, d: ApertoDraft) {
  try { store.setItem(APERTO_DRAFT_KEY, JSON.stringify({ version: 1, text: d.text, lang: d.lang })) } catch { /* private mode or quota */ }
}
export function loadApertoDraft(store: Store): ApertoDraft | null {
  try {
    const p = JSON.parse(store.getItem(APERTO_DRAFT_KEY) ?? 'null')
    if (p?.version !== 1 || typeof p.text !== 'string' || !isLang(p.lang)) return null
    return { text: p.text.slice(0, MAX_TEXT), lang: p.lang }
  } catch { return null }
}

// ---- transport ---------------------------------------------------------------------------------
type Opts = { fetch?: typeof fetch; signal?: AbortSignal }
type Raw = { kind: 'http'; status: number; body: any; retryAfter: string | null } | { kind: 'down'; status: 0; error: string }
const bytes = (s: string) => new TextEncoder().encode(s).length

async function post(payload: unknown, opts: Opts): Promise<Raw> {
  const f = opts.fetch ?? fetch
  try {
    const res = await f(APERTO_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: opts.signal })
    let body: any = null
    try { body = await res.json() } catch { /* not JSON */ }
    return { kind: 'http', status: res.status, body, retryAfter: res.headers.get('Retry-After') }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    return { kind: 'down', status: 0, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

const fail = (path: string, message: string, attempts = 0): ConfigResponse => ({ ok: false, errors: [{ path, message }], attempts })

export async function requestConfig(text: string, lang: Lang, opts: Opts = {}): Promise<ConfigResponse> {
  const t = text.trim()
  if (!t) return fail('text', 'Write your prices first.')
  const payload = { action: 'config' as const, text: t, lang }
  if (t.length > MAX_TEXT || bytes(JSON.stringify(payload)) > MAX_BODY) return fail('text', 'Too long. Keep it under about 3000 characters.')
  const r = await post(payload, opts)
  if (r.kind === 'down') return fail('network', r.error)
  if (r.status === 429) return fail('request', `Too many tries. Wait ${r.retryAfter ?? '60'} s and try again.`)
  const b = r.body
  if (b?.ok === true && b.config) return { ok: true, config: b.config, attempts: Number(b.attempts) || 1, warnings: Array.isArray(b.warnings) ? b.warnings : [] }
  if (b?.ok === false && Array.isArray(b.errors) && b.errors.length) return { ok: false, errors: b.errors, attempts: Number(b.attempts) || 0 }
  return fail('request', `The server answered ${r.status || 'nothing'} without a result. Try again.`)
}

export async function requestMessage(config: Config, quote: Quote, lang: Lang, opts: Opts = {}): Promise<MessageResponse> {
  let payload: any = { action: 'message', config, quote, lang }
  // The server reads only the cents; drop display strings if a large config would pass 4 KB.
  if (bytes(JSON.stringify(payload)) > MAX_BODY) payload = { ...payload, quote: { ...quote, answers: [], display: { low: '', high: '', vatNote: '', lowGross: '', highGross: '' } } }
  if (bytes(JSON.stringify(payload)) > MAX_BODY) return { ok: false, errors: [{ path: 'request', message: 'config too large for the message service' }] }
  const r = await post(payload, opts)
  if (r.kind === 'down') return { ok: false, errors: [{ path: 'network', message: r.error }] }
  if (r.status === 200 && r.body?.ok === true && typeof r.body.text === 'string' && r.body.text.trim()) return { ok: true, text: r.body.text, source: r.body.source === 'model' ? 'model' : 'template' }
  return { ok: false, errors: Array.isArray(r.body?.errors) ? r.body.errors : [{ path: 'request', message: `HTTP ${r.status}` }] }
}

// ---- WhatsApp ----------------------------------------------------------------------------------
/** Same quote and language => same message. */
export const messageKey = (q: Quote, lang: Lang) => [lang, q.lowCents, q.highCents, q.vat.lowGrossCents, q.vat.highGrossCents, q.vat.rate, q.vat.pricesInclude].join('|')

/** The server's text (core amounts already in it), then core's answer lines, then the customer's name. */
export function leadText(_config: Config, quote: Quote, text: string, name: string): string {
  const lines = [text.trim(), '', ...quote.answers.map((a) => `- ${a.label}: ${a.display}`), '', name]
  return lines.join('\n').replace(SPACES, ' ')
}
export const waUrl = (config: Config, text: string) => `https://wa.me/${config.business.whatsapp ?? ''}?text=${encodeURIComponent(text)}`
