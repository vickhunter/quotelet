// D-004c: every user-facing string in the builder flow goes through the i18n dictionary.
// Static scan: no literal JSX text and no literal aria-label/title/placeholder/alt/label props
// in the files that render /build and /q.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { builderStrings } from './builder'
import { EN, IT } from './i18n'

const FILES = ['routes/Build.tsx', 'routes/Share.tsx', 'components/QuoteWidget.tsx', 'components/UiLangSwitch.tsx']
const src = (f: string) => readFileSync(join(import.meta.dir, '..', f), 'utf8')

// `>Some words<` (JSX text) and `aria-label="Words"` style literals.
const JSX_TEXT = />\s*([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*)\s*</g
const ATTR = /\b(aria-label|title|placeholder|alt|label|legend)=["']([^"']*[A-Za-z]{2,}[^"']*)["']/g
// Template-literal attributes (aria-label={`Label for ${id}`}) and sentence-like string literals
// ('Pick a template first.') anywhere in the component.
const TPL_ATTR = /\b(aria-label|title|placeholder|alt|label|legend)=\{`([^`]*)`\}/g
const SENTENCE = /(['"`])([A-Z][a-z]+(?: [A-Za-z,.'’]+)+[.…]?)\1/g
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('no hard-coded UI strings', () => {
  for (const f of FILES) {
    test(f, () => {
      const code = strip(src(f))
      const text = [...code.matchAll(JSX_TEXT)].map((m) => m[1].trim()).filter((s) => !/^(=>|&&|\|\||\?|:)/.test(s))
      const attrs = [...code.matchAll(ATTR)].map((m) => `${m[1]}="${m[2]}"`)
      const tpl = [...code.matchAll(TPL_ATTR)].filter((m) => /[A-Za-z]{2,}/.test(m[2].replace(/\$\{[^}]*\}/g, ''))).map((m) => m[0])
      const sentences = [...code.matchAll(SENTENCE)].map((m) => m[2])
      expect([...text, ...attrs, ...tpl, ...sentences]).toEqual([])
    })
  }
  test('builder.ts problem messages come from the dictionary', () => {
    for (const k of builderStrings) {
      expect(EN[k]).toBeDefined()
      expect(IT[k]).toBeDefined()
    }
  })
})
