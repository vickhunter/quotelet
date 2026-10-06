import { describe, expect, test } from 'bun:test'
import { shareLink, embedSnippet } from './share'

describe('share outputs', () => {
  test('share link puts the encoded config in the fragment', () => {
    expect(shareLink('https://quotelet.vercel.app', 'eyJ2IjoxfQ')).toBe('https://quotelet.vercel.app/q#c=eyJ2IjoxfQ')
    expect(shareLink('http://127.0.0.1:4173/', 'abc')).toBe('http://127.0.0.1:4173/q#c=abc')
  })
  test('embed snippet is one div plus one deferred script from the same origin', () => {
    const s = embedSnippet('https://quotelet.vercel.app', 'abc')
    expect(s).toBe('<div data-quotelet data-config="abc"></div>\n<script src="https://quotelet.vercel.app/quotelet.js" defer></script>')
  })
})
