import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { compileFormula, encodeConfig, getTemplate, listTemplates } from '@quotelet/core'
import type { Config, Field } from '@quotelet/core/types'
import { builderReducer, canShare, initBuilder, whatsappProblem, type BuilderAction, type BuilderState } from '../lib/builder'
import { loadDraft, saveDraft } from '../lib/draft'
import { formulaErrorMessage } from '../lib/formulaError'
import { embedSnippet, shareLink } from '../lib/share'
import { QuoteWidget } from '../components/QuoteWidget'
import { SiteHeader, Phone } from '../components/Chrome'
import './build.css'

function startState(templateParam?: string): BuilderState {
  const draft = typeof window !== 'undefined' ? loadDraft(window.localStorage) : null
  if (templateParam && draft?.templateId !== templateParam) {
    const tpl = getTemplate(templateParam) as Config | undefined
    if (tpl) return builderReducer(initBuilder(), { type: 'loadTemplate', config: tpl })
  }
  return draft ?? initBuilder()
}

/** Text input for numbers: keeps what the user types, dispatches only parseable values. Accepts "7,5". */
function NumInput({ value, onValue, ...rest }: { value: number | undefined; onValue: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const last = useRef(value)
  if (value !== last.current) {
    last.current = value
    if (Number(text.replace(',', '.')) !== value) setText(value === undefined ? '' : String(value))
  }
  return (
    <input
      {...rest}
      className={`input num ${rest.className ?? ''}`}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(n)) { last.current = n; onValue(n) }
      }}
    />
  )
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (what: string, text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text })
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(what)
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
  }
  return { copied, copy }
}

function FieldEditor({ field, dispatch }: { field: Field; dispatch: React.Dispatch<BuilderAction> }) {
  return (
    <div className="fe">
      <div className="fe-head">
        <input className="input fe-label" aria-label={`Label for ${field.id}`} value={field.label} maxLength={80}
          onChange={(e) => dispatch({ type: 'setFieldLabel', fieldId: field.id, label: e.target.value })} />
        <code className="fe-id" title="Name to use in the formula">{field.id}</code>
      </div>
      {field.type === 'number' && (
        <label className="fe-row">
          <span>Starts at</span>
          <NumInput value={field.default} onValue={(n) => dispatch({ type: 'setNumberDefault', fieldId: field.id, value: n })} aria-label={`${field.label} default`} />
          {field.unit && <span className="unit">{field.unit}</span>}
        </label>
      )}
      {field.type === 'choice' && field.options.map((o, i) => (
        <div className="fe-row" key={i}>
          <input className="input" aria-label={`Option ${i + 1} of ${field.label}`} value={o.label} maxLength={80}
            onChange={(e) => dispatch({ type: 'setOptionLabel', fieldId: field.id, index: i, label: e.target.value })} />
          <NumInput value={o.value} data-testid="option-value" data-option-label={o.label} aria-label={`${o.label} price`}
            onValue={(n) => dispatch({ type: 'setOptionValue', fieldId: field.id, index: i, value: n })} />
        </div>
      ))}
      {field.type === 'toggle' && (['on', 'off'] as const).map((w) => (
        <label className="fe-row" key={w}>
          <span>{w === 'on' ? 'When ticked' : 'When not ticked'}</span>
          <NumInput value={field[w]} aria-label={`${field.label} ${w}`} onValue={(n) => dispatch({ type: 'setToggle', fieldId: field.id, which: w, value: n })} />
        </label>
      ))}
    </div>
  )
}

export function Build() {
  const { template } = useSearch({ from: '/build' })
  const [state, dispatch] = useReducer(builderReducer, template, startState)
  const { copied, copy } = useCopy()
  const c = state.config
  const ready = state.templateId !== ''

  useEffect(() => { if (ready) saveDraft(window.localStorage, state) }, [state, ready])

  const fieldIds = useMemo(() => c.fields.map((f) => f.id), [c.fields])
  const compiled = useMemo(() => compileFormula(state.formula, fieldIds), [state.formula, fieldIds])
  const formulaError = compiled.ok ? null : formulaErrorMessage(state.formula, compiled.error)
  const waProblem = whatsappProblem(state.whatsappRaw)
  const shareable = ready && canShare(state, { formulaOk: compiled.ok })
  const encoded = useMemo(() => (shareable ? encodeConfig(c) : ''), [shareable, c])
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = encoded ? shareLink(origin, encoded) : ''
  const snippet = encoded ? embedSnippet(origin, encoded) : ''
  const blocker = !ready ? 'Pick a template first.' : formulaError ? 'Fix the formula to share.' : !c.business.name.trim() ? 'Add your business name.' : waProblem ? 'Fix the WhatsApp number.' : null

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `${c.id}.json` }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <SiteHeader><Link to="/" className="link">Home</Link></SiteHeader>
      <main className="wrap builder">
        <div className="builder-form">
          <header className="builder-head">
            <h1>Build your calculator</h1>
            <p className="muted">Free. No account. Your draft stays in this browser.</p>
          </header>

          <section className="panel" aria-labelledby="s-template">
            <h2 id="s-template">Template</h2>
            <div className="tpl-grid">
              {listTemplates().map((t) => (
                <button key={t.id} type="button" data-testid={`template-${t.id}`} aria-pressed={state.templateId === t.id}
                  className={`tpl${state.templateId === t.id ? ' on' : ''}`}
                  onClick={() => dispatch({ type: 'loadTemplate', config: getTemplate(t.id) as Config })}>
                  <span className="flag">{t.locale.slice(0, 2).toUpperCase()}</span>
                  <span>{t.title}</span>
                </button>
              ))}
            </div>
          </section>

          {ready && (
            <>
              <section className="panel" aria-labelledby="s-business">
                <h2 id="s-business">Your business</h2>
                <label className="field"><span>Business name</span>
                  <input className="input" data-testid="business-name" value={c.business.name} maxLength={80} autoComplete="organization"
                    onFocus={(e) => e.target.select()} onChange={(e) => dispatch({ type: 'setBusiness', name: e.target.value })} />
                </label>
                <label className="field"><span>WhatsApp number</span>
                  <input className="input" data-testid="business-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 333 123 4567"
                    value={state.whatsappRaw} aria-invalid={waProblem ? true : undefined} aria-describedby="wa-hint"
                    onChange={(e) => dispatch({ type: 'setWhatsapp', raw: e.target.value })} />
                  <span id="wa-hint" className={waProblem ? 'error' : 'hint'}>{waProblem ?? 'With country code. Leave empty for a share-only calculator.'}</span>
                </label>
                <label className="field"><span>Email <span className="opt">optional</span></span>
                  <input className="input" type="email" inputMode="email" autoComplete="email" value={c.business.email ?? ''}
                    onChange={(e) => dispatch({ type: 'setEmail', email: e.target.value })} />
                </label>
              </section>

              <section className="panel" aria-labelledby="s-prices">
                <h2 id="s-prices">Questions and prices</h2>
                <div className="fe-list">{c.fields.map((f) => <FieldEditor key={f.id} field={f} dispatch={dispatch} />)}</div>
                <div className="vat-row">
                  <label className="field"><span>VAT %</span>
                    <NumInput value={c.vat?.rate ?? 0} onValue={(n) => dispatch({ type: 'setVat', rate: n, pricesInclude: c.vat?.pricesInclude ?? false })} />
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={c.vat?.pricesInclude ?? false}
                      onChange={(e) => dispatch({ type: 'setVat', rate: c.vat?.rate ?? 0, pricesInclude: e.target.checked })} />
                    Prices include VAT
                  </label>
                </div>
              </section>

              <section className="panel" aria-labelledby="s-formula">
                <h2 id="s-formula">Formula</h2>
                <textarea className="textarea" data-testid="formula" spellCheck={false} maxLength={500} rows={3}
                  value={state.formula} aria-invalid={formulaError ? true : undefined} aria-describedby="formula-msg"
                  onChange={(e) => dispatch({ type: 'setFormula', src: e.target.value, valid: compileFormula(e.target.value, fieldIds).ok })} />
                {formulaError
                  ? <p id="formula-msg" className="error" role="alert" data-testid="formula-error">{formulaError}</p>
                  : <p id="formula-msg" className="hint">Use + − × ÷, min(), max() and these names:</p>}
                <div className="chips">{fieldIds.map((id) => <code key={id}>{id}</code>)}</div>
              </section>
            </>
          )}
        </div>

        <aside className="builder-side">
          <div className="sticky">
            {ready ? (
              <Phone label="Live preview">
                <QuoteWidget config={c} testId="preview" />
              </Phone>
            ) : (
              <div className="empty"><p>Pick a template to see your calculator here.</p></div>
            )}

            <div className="share panel" aria-labelledby="s-share">
              <h2 id="s-share">Share</h2>
              {blocker && <p className="hint">{blocker}</p>}
              <div className="share-row">
                <input className="input" readOnly value={link} placeholder="Share link" aria-label="Share link" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-primary btn-small" data-testid="copy-link" disabled={!shareable} onClick={() => copy('link', link)}>
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div className="share-actions">
                <button type="button" className="btn btn-ghost btn-small" data-testid="copy-embed" disabled={!shareable} onClick={() => copy('embed', snippet)}>
                  {copied === 'embed' ? 'Copied' : 'Copy embed code'}
                </button>
                <button type="button" className="btn btn-ghost btn-small" data-testid="download-json" disabled={!shareable} onClick={download}>Download JSON</button>
                {link && <a className="btn btn-ghost btn-small" href={link} target="_blank" rel="noopener">Open</a>}
              </div>
              <p className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</p>
            </div>
          </div>
        </aside>
      </main>
    </>
  )
}
