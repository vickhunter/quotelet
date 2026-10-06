import { describe, expect, test } from 'bun:test'
import { isValidEmail, submitWaitlist } from './waitlist'

describe('waitlist', () => {
  test('client validation', () => {
    expect(isValidEmail('a@b.it')).toBe(true)
    expect(isValidEmail(' marco@pitture.it ')).toBe(true)
    expect(isValidEmail('marco@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
  test('posts JSON with the email and source, resolves ok on success', async () => {
    let body: any
    const fetchImpl = async (_u: string, init: any) => { body = JSON.parse(init.body); return new Response('{"success":"true"}') }
    const r = await submitWaitlist('marco@pitture.it', 'it-painters', { endpoint: 'https://x/ajax', fetchImpl })
    expect(r).toEqual({ ok: true })
    expect(body.email).toBe('marco@pitture.it')
    expect(body.source).toBe('it-painters')
  })
  test('invalid email never hits the network', async () => {
    let called = false
    const r = await submitWaitlist('nope', 'en', { endpoint: 'https://x', fetchImpl: async () => { called = true; return new Response('') } })
    expect(r.ok).toBe(false)
    expect(called).toBe(false)
  })
  test('server or network failure resolves to an error, never throws', async () => {
    const r1 = await submitWaitlist('a@b.it', 'en', { endpoint: 'https://x', fetchImpl: async () => new Response('{"success":"false"}', { status: 500 }) })
    const r2 = await submitWaitlist('a@b.it', 'en', { endpoint: 'https://x', fetchImpl: async () => { throw new Error('offline') } })
    expect(r1.ok).toBe(false)
    expect(r2.ok).toBe(false)
  })
})

// D-004b: launch tracking. The page's ?ref= travels with the signup as a hidden "ref" field.
import { REF_KEY, readRef } from './waitlist'
describe('waitlist ref (D-004b)', () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }
  test('reads ?ref= and remembers it for the session', () => {
    const s = store()
    expect(readRef('?ref=launch-hn', s)).toBe('launch-hn')
    expect(s.m.get(REF_KEY)).toBe('launch-hn')
    expect(readRef('', s)).toBe('launch-hn')
    expect(readRef('?ref=x2', s)).toBe('x2')
  })
  test('cleans the value: safe characters only, 64 max, empty when absent', () => {
    expect(readRef('?ref=%3Cscript%3Ealert(1)%3C%2Fscript%3E', store())).toBe('scriptalert1script')
    expect(readRef(`?ref=${'a'.repeat(100)}`, store())).toHaveLength(64)
    expect(readRef('?utm=1', store())).toBe('')
    expect(readRef('?ref=', store())).toBe('')
  })
  test('a throwing storage never breaks the page', () => {
    const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(readRef('?ref=ok', bad)).toBe('ok')
    expect(readRef('', bad)).toBe('')
  })
  test('the ref goes into the posted body, and is left out when empty', async () => {
    let body: any
    const fetchImpl = async (_u: string, init: any) => { body = JSON.parse(init.body); return new Response('{"success":"true"}') }
    await submitWaitlist('a@b.it', 'landing-en', { endpoint: 'https://x', fetchImpl, ref: 'launch-hn' })
    expect(body.ref).toBe('launch-hn')
    await submitWaitlist('a@b.it', 'landing-en', { endpoint: 'https://x', fetchImpl, ref: '' })
    expect('ref' in body).toBe(false)
  })
})
