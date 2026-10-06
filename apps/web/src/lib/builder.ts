import type { Config, Field } from '@quotelet/core/types'

export type BuilderState = {
  templateId: string
  config: Config
  /** What the user typed, e.g. "+39 333 123 4567". config.business.whatsapp holds the digits. */
  whatsappRaw: string
  /** Formula as typed; config.formula keeps the last valid one so the preview never breaks. */
  formula: string
}

export type BuilderAction =
  | { type: 'loadTemplate'; config: Config }
  | { type: 'setTitle'; title: string }
  | { type: 'setBusiness'; name: string }
  | { type: 'setWhatsapp'; raw: string }
  | { type: 'setEmail'; email: string }
  | { type: 'setFieldLabel'; fieldId: string; label: string }
  | { type: 'setOptionLabel'; fieldId: string; index: number; label: string }
  | { type: 'setOptionValue'; fieldId: string; index: number; value: number }
  | { type: 'setToggle'; fieldId: string; which: 'on' | 'off'; value: number }
  | { type: 'setNumberDefault'; fieldId: string; value: number }
  | { type: 'setFormula'; src: string; valid: boolean }
  | { type: 'setVat'; rate: number; pricesInclude: boolean }
  | { type: 'setRange'; low: number; high: number }
  | { type: 'setDisclaimer'; text: string }

const EMPTY: Config = {
  v: 1, id: 'custom', locale: 'en-US', currency: 'USD', title: '',
  business: { name: '' }, fields: [], formula: '0',
}

export const initBuilder = (): BuilderState => ({ templateId: '', config: EMPTY, whatsappRaw: '', formula: EMPTY.formula })

export const normalizeWhatsapp = (raw: string) => raw.replace(/\D/g, '')

export function whatsappProblem(raw: string): string | null {
  if (!raw.trim()) return null
  if (/[a-z]/i.test(raw)) return 'Use digits only, with the country code.'
  const d = normalizeWhatsapp(raw)
  if (d.length < 8) return 'Too short. Include the country code, e.g. +39.'
  if (d.length > 15) return 'Too long for a phone number.'
  return null
}

export const canShare = (s: BuilderState, { formulaOk }: { formulaOk: boolean }) =>
  formulaOk && s.config.business.name.trim() !== '' && whatsappProblem(s.whatsappRaw) === null

const mapField = (c: Config, id: string, fn: (f: Field) => Field): Config => ({
  ...c,
  fields: c.fields.map((f) => (f.id === id ? fn(f) : f)),
})

const withConfig = (s: BuilderState, config: Config): BuilderState => ({ ...s, config })

export function builderReducer(s: BuilderState, a: BuilderAction): BuilderState {
  const c = s.config
  switch (a.type) {
    case 'loadTemplate': {
      const config = structuredClone(a.config)
      return { templateId: config.id, config, whatsappRaw: config.business.whatsapp ? `+${config.business.whatsapp}` : '', formula: config.formula }
    }
    case 'setTitle':
      return withConfig(s, { ...c, title: a.title })
    case 'setBusiness':
      return withConfig(s, { ...c, business: { ...c.business, name: a.name } })
    case 'setWhatsapp': {
      const { whatsapp: _, ...rest } = c.business
      const digits = normalizeWhatsapp(a.raw)
      const business = digits && !whatsappProblem(a.raw) ? { ...rest, whatsapp: digits } : rest
      return { ...s, whatsappRaw: a.raw, config: { ...c, business } }
    }
    case 'setEmail': {
      const { email: _, ...rest } = c.business
      return withConfig(s, { ...c, business: a.email.trim() ? { ...rest, email: a.email.trim() } : rest })
    }
    case 'setFieldLabel':
      return withConfig(s, mapField(c, a.fieldId, (f) => ({ ...f, label: a.label })))
    case 'setOptionLabel':
    case 'setOptionValue':
      return withConfig(s, mapField(c, a.fieldId, (f) => f.type !== 'choice' ? f : {
        ...f,
        options: f.options.map((o, i) => i !== a.index ? o : a.type === 'setOptionLabel' ? { ...o, label: a.label } : { ...o, value: a.value }),
      }))
    case 'setToggle':
      return withConfig(s, mapField(c, a.fieldId, (f) => (f.type === 'toggle' ? { ...f, [a.which]: a.value } : f)))
    case 'setNumberDefault':
      return withConfig(s, mapField(c, a.fieldId, (f) => (f.type === 'number' ? { ...f, default: a.value } : f)))
    case 'setFormula':
      return { ...s, formula: a.src, config: a.valid ? { ...c, formula: a.src } : c }
    case 'setVat':
      return withConfig(s, { ...c, vat: { rate: a.rate, pricesInclude: a.pricesInclude, show: c.vat?.show ?? true } })
    case 'setRange':
      return withConfig(s, { ...c, range: { low: a.low, high: a.high } })
    case 'setDisclaimer':
      return withConfig(s, { ...c, disclaimer: a.text })
  }
}
