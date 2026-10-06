import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { builderReducer, initBuilder } from './builder'
import { saveDraft, loadDraft, clearDraft, DRAFT_KEY } from './draft'

const cfg = JSON.parse(readFileSync(new URL('../../../../fixtures/config-imbianchino.json', import.meta.url), 'utf8'))
function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('localStorage draft', () => {
  test('round-trips the builder state', () => {
    const st = memoryStorage()
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setBusiness', name: 'Marco Pitture' })
    saveDraft(st, s)
    expect(st.m.has(DRAFT_KEY)).toBe(true)
    expect(loadDraft(st)).toEqual(s)
  })
  test('garbage or a wrong version returns null instead of throwing', () => {
    const st = memoryStorage()
    st.setItem(DRAFT_KEY, '{not json')
    expect(loadDraft(st)).toBeNull()
    st.setItem(DRAFT_KEY, JSON.stringify({ version: 999, state: {} }))
    expect(loadDraft(st)).toBeNull()
  })
  test('a storage that throws (private mode) never breaks the builder', () => {
    const bad = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    expect(() => saveDraft(bad, initBuilder())).not.toThrow()
    expect(loadDraft(bad)).toBeNull()
    expect(() => clearDraft(bad)).not.toThrow()
  })
})
