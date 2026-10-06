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
