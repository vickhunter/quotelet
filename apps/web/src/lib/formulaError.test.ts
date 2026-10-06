import { describe, expect, test } from 'bun:test'
import { formulaErrorMessage } from './formulaError'

describe('formula error message', () => {
  test('names the unknown identifier found at the error position', () => {
    const msg = formulaErrorMessage('mq * prezzo_inesistente', { pos: 5, message: 'Unknown identifier' })
    expect(msg).toContain('prezzo_inesistente')
    expect(msg).toMatch(/position 6/)
  })
  test('does not repeat the name when core already includes it', () => {
    const msg = formulaErrorMessage('mq * foo', { pos: 5, message: 'Unknown identifier "foo"' })
    expect(msg.match(/foo/g)!.length).toBe(1)
  })
  test('non-identifier errors keep the core message and position', () => {
    expect(formulaErrorMessage('mq * (2', { pos: 7, message: 'Expected )' })).toBe('Expected ) (position 8)')
  })
})
