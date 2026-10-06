import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { Config } from '@quotelet/core/types'
import { builderReducer, initBuilder, normalizeWhatsapp, whatsappProblem, canShare } from './builder'

const cfg: Config = JSON.parse(readFileSync(new URL('../../../../fixtures/config-imbianchino.json', import.meta.url), 'utf8'))

describe('builder reducer', () => {
  test('loading a template replaces the config and keeps the raw whatsapp input empty', () => {
    const s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    expect(s.config.id).toBe('imbianchino-it')
    expect(s.templateId).toBe('imbianchino-it')
    expect(s.formula).toBe(cfg.formula)
  })

  test('business name and whatsapp edits normalise the number into the config', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setBusiness', name: 'Rossi Tinteggiature' })
    s = builderReducer(s, { type: 'setWhatsapp', raw: '+39 333 123 4567' })
    expect(s.config.business.name).toBe('Rossi Tinteggiature')
    expect(s.whatsappRaw).toBe('+39 333 123 4567')
    expect(s.config.business.whatsapp).toBe('393331234567')
  })

  test('clearing whatsapp switches to share mode (no number in config)', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setWhatsapp', raw: '' })
    expect(s.config.business.whatsapp).toBeUndefined()
  })

  test('editing a choice option value changes only that option', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setOptionValue', fieldId: 'colore', index: 0, value: 7 })
    const colore = s.config.fields.find((f) => f.id === 'colore')!
    expect(colore.type === 'choice' && colore.options[0].value).toBe(7)
    expect(colore.type === 'choice' && colore.options[1].value).toBe(8)
    expect(cfg.fields.find((f) => f.id === 'colore')!.type === 'choice' && (cfg.fields[2] as any).options[0].value).toBe(6) // input not mutated
  })

  test('field label, toggle factor and VAT edits land in the config', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setFieldLabel', fieldId: 'mq', label: 'Superficie' })
    s = builderReducer(s, { type: 'setToggle', fieldId: 'arredato', which: 'on', value: 1.25 })
    s = builderReducer(s, { type: 'setVat', rate: 10, pricesInclude: true })
    expect(s.config.fields[0].label).toBe('Superficie')
    expect((s.config.fields.find((f) => f.id === 'arredato') as any).on).toBe(1.25)
    expect(s.config.vat).toEqual({ rate: 10, pricesInclude: true, show: true })
  })

  test('formula edits keep the draft formula even when it is invalid, config keeps the last valid one', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    s = builderReducer(s, { type: 'setFormula', src: 'mq * prezzo_inesistente', valid: false })
    expect(s.formula).toBe('mq * prezzo_inesistente')
    expect(s.config.formula).toBe(cfg.formula)
    s = builderReducer(s, { type: 'setFormula', src: 'mq * 5', valid: true })
    expect(s.config.formula).toBe('mq * 5')
  })
})

describe('whatsapp helpers', () => {
  test('normalise strips everything but digits', () => {
    expect(normalizeWhatsapp('+39 333 123 4567')).toBe('393331234567')
    expect(normalizeWhatsapp('(0039) 333-123')).toBe('0039333123')
  })
  test('problem messages for short, long and lettered numbers; none for empty or valid', () => {
    expect(whatsappProblem('')).toBeNull()
    expect(whatsappProblem('+39 333 123 4567')).toBeNull()
    expect(whatsappProblem('12345')).toMatch(/short/i)
    expect(whatsappProblem('1234567890123456')).toMatch(/long/i)
    expect(whatsappProblem('39abc3331234')).toMatch(/digits/i)
  })
})

describe('canShare', () => {
  test('needs a valid formula, a business name and no whatsapp problem', () => {
    let s = builderReducer(initBuilder(), { type: 'loadTemplate', config: cfg })
    expect(canShare(s, { formulaOk: true })).toBe(true)
    expect(canShare(s, { formulaOk: false })).toBe(false)
    s = builderReducer(s, { type: 'setBusiness', name: '  ' })
    expect(canShare(s, { formulaOk: true })).toBe(false)
    s = builderReducer(s, { type: 'setBusiness', name: 'Rossi' })
    s = builderReducer(s, { type: 'setWhatsapp', raw: '123' })
    expect(canShare(s, { formulaOk: true })).toBe(false)
  })
})
