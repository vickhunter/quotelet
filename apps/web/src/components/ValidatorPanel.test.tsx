import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ValidatorPanel } from './ValidatorPanel'
import { LangPicker } from './LangPicker'

describe('ValidatorPanel', () => {
  test('idle renders nothing visible but keeps the live region', () => {
    const html = renderToStaticMarkup(<ValidatorPanel state={{ kind: 'idle' }} />)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-state="idle"')
  })
  test('loading shows a spinner with a text label', () => {
    const html = renderToStaticMarkup(<ValidatorPanel state={{ kind: 'loading' }} />)
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('spinner')
    expect(html).toMatch(/Reading your prices/)
  })
  test('ok shows the green summary, retries and warnings', () => {
    const html = renderToStaticMarkup(<ValidatorPanel state={{ kind: 'ok', summary: '4 fields, formula OK', attempts: 2, warnings: [{ path: 'formula', message: 'check 7' }] }} />)
    expect(html).toContain('data-state="ok"')
    expect(html).toContain('4 fields, formula OK')
    expect(html).toMatch(/fixed on retry/)
    expect(html).toContain('check 7')
  })
  test('error lists every path and message, escaped', () => {
    const html = renderToStaticMarkup(<ValidatorPanel state={{ kind: 'error', attempts: 2, errors: [{ path: 'fields[1].on', message: 'must be a number' }, { path: 'text', message: '<b>Add a number</b>' }] }} />)
    expect(html).toContain('data-state="error"')
    expect(html).toContain('fields[1].on')
    expect(html).toContain('must be a number')
    expect(html).toContain('&lt;b&gt;Add a number&lt;/b&gt;')
    expect(html.match(/<li/g)?.length).toBe(2)
  })
})

describe('LangPicker', () => {
  test('a labelled radio group with IT DE FR EN and the current value checked', () => {
    const html = renderToStaticMarkup(<LangPicker name="l" legend="Language" value="de" onChange={() => {}} />)
    expect(html).toContain('<legend')
    expect(html).toContain('Language')
    for (const l of ['IT', 'DE', 'FR', 'EN']) expect(html).toContain(`>${l}<`)
    expect(html.match(/type="radio"/g)?.length).toBe(4)
    expect(html).toMatch(/value="de"[^>]*checked|checked[^>]*value="de"/)
  })
})
