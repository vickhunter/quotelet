import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { compileFormula, encodeConfig, getTemplate, listTemplates } from '@quotelet/core'
import type { Config, Field } from '@quotelet/core/types'
import { builderReducer, canShare, initBuilder, whatsappProblemKey, type BuilderAction, type BuilderState } from '../lib/builder'
import { loadDraft, saveDraft } from '../lib/draft'
import { formulaErrorMessage } from '../lib/formulaError'
import { embedSnippet, shareLink } from '../lib/share'
import { useCopy } from '../lib/useCopy'
import { useMeta } from '../lib/useMeta'
import { loadUiLang, resolveUiLang, saveUiLang, translator, type T, type UiLang } from '../lib/i18n'
import { QuoteWidget } from '../components/QuoteWidget'
import { SiteHeader, Phone } from '../components/Chrome'
import { UiLangSwitch } from '../components/UiLangSwitch'
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

function FieldEditor({ field, dispatch, tr }: { field: Field; dispatch: React.Dispatch<BuilderAction>; tr: T }) {
  return (
    <div className="fe">
      <div className="fe-head">
        <input className="input fe-label" aria-label={tr('fe.labelFor', { id: field.id })} value={field.label} maxLength={80}
          onChange={(e) => dispatch({ type: 'setFieldLabel', fieldId: field.id, label: e.target.value })} />
        <code className="fe-id" title={tr('fe.idTitle')}>{field.id}</code>
      </div>
      {field.type === 'number' && (
        <label className="fe-row">
          <span>{tr('fe.startsAt')}</span>
          <NumInput value={field.default} onValue={(n) => dispatch({ type: 'setNumberDefault', fieldId: field.id, value: n })} aria-label={tr('fe.default', { label: field.label })} />
          {field.unit && <span className="unit">{field.unit}</span>}
        </label>
      )}
      {field.type === 'choice' && field.options.map((o, i) => (
        <div className="fe-row" key={i}>
          <input className="input" aria-label={tr('fe.option', { n: i + 1, label: field.label })} value={o.label} maxLength={80}
            onChange={(e) => dispatch({ type: 'setOptionLabel', fieldId: field.id, index: i, label: e.target.value })} />
          <NumInput value={o.value} data-testid="option-value" data-option-label={o.label} aria-label={tr('fe.price', { label: o.label })}
            onValue={(n) => dispatch({ type: 'setOptionValue', fieldId: field.id, index: i, value: n })} />
        </div>
      ))}
      {field.type === 'toggle' && (['on', 'off'] as const).map((w) => (
        <label className="fe-row" key={w}>
          <span>{tr(w === 'on' ? 'fe.on' : 'fe.off')}</span>
          <NumInput value={field[w]} aria-label={tr(w === 'on' ? 'fe.onAria' : 'fe.offAria', { label: field.label })} onValue={(n) => dispatch({ type: 'setToggle', fieldId: field.id, which: w, value: n })} />
        </label>
      ))}
    </div>
  )
}

export function Build() {
  const { template, lang: langParam } = useSearch({ from: '/build' })
  const navigate = useNavigate({ from: '/build' })
  const [lang, setLang] = useState<UiLang>(() =>
    resolveUiLang({ param: langParam, template, stored: typeof window !== 'undefined' ? loadUiLang(window.localStorage) : undefined }))
  const tr = useMemo(() => translator(lang), [lang])
  useEffect(() => saveUiLang(window.localStorage, lang), [lang])
  useMeta(tr('build.metaTitle'), lang)
  const switchLang = (l: UiLang) => {
    setLang(l)
    void navigate({ search: (s: { template?: string; lang?: UiLang }) => ({ ...s, lang: l }), replace: true })
  }
  const [state, dispatch] = useReducer(builderReducer, template, startState)
  const { copied, copy } = useCopy()
  const c = state.config
  const ready = state.templateId !== ''

  useEffect(() => { if (ready) saveDraft(window.localStorage, state) }, [state, ready])

  const fieldIds = useMemo(() => c.fields.map((f) => f.id), [c.fields])
  const compiled = useMemo(() => compileFormula(state.formula, fieldIds), [state.formula, fieldIds])
  const formulaError = compiled.ok ? null : formulaErrorMessage(state.formula, compiled.error, lang)
  const waKey = whatsappProblemKey(state.whatsappRaw)
  const waProblem = waKey ? tr(waKey) : null
  const shareable = ready && canShare(state, { formulaOk: compiled.ok })
  const encoded = useMemo(() => (shareable ? encodeConfig(c) : ''), [shareable, c])
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = encoded ? shareLink(origin, encoded) : ''
  const snippet = encoded ? embedSnippet(origin, encoded) : ''
  const blocker = !ready ? tr('block.template') : formulaError ? tr('block.formula') : !c.business.name.trim() ? tr('block.name') : waProblem ? tr('block.whatsapp') : null
  // Italian UI offers Italian templates only: an English template title would break the IT page.
  const templates = useMemo(() => listTemplates().filter((x) => lang === 'en' || x.locale.startsWith('it')), [lang])

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `${c.id}.json` }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <SiteHeader homeLabel={tr('logo.home')} navLabel={tr('nav.main')}>
        <UiLangSwitch value={lang} onChange={switchLang} />
        <Link to="/" className="link">{tr('nav.home')}</Link>
      </SiteHeader>
      <main className="wrap builder">
        <div className="builder-form">
          <header className="builder-head">
            <h1>{tr('build.title')}</h1>
            <p className="muted">{tr('build.lede')}</p>
          </header>

          <section className="panel" aria-labelledby="s-template">
            <h2 id="s-template">{tr('build.template')}</h2>
            <div className="tpl-grid">
              {templates.map((t) => (
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
                <h2 id="s-business">{tr('build.business')}</h2>
                <label className="field"><span>{tr('build.businessName')}</span>
                  <input className="input" data-testid="business-name" value={c.business.name} maxLength={80} autoComplete="organization"
                    onFocus={(e) => e.target.select()} onChange={(e) => dispatch({ type: 'setBusiness', name: e.target.value })} />
                </label>
                <label className="field"><span>{tr('build.whatsapp')}</span>
                  <input className="input" data-testid="business-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 333 123 4567"
                    value={state.whatsappRaw} aria-invalid={waProblem ? true : undefined} aria-describedby="wa-hint"
                    onChange={(e) => dispatch({ type: 'setWhatsapp', raw: e.target.value })} />
                  <span id="wa-hint" className={waProblem ? 'error' : 'hint'} data-testid={waProblem ? 'whatsapp-error' : undefined}>{waProblem ?? tr('build.whatsappHint')}</span>
                </label>
                <label className="field"><span>{tr('build.email')} <span className="opt">{tr('build.optional')}</span></span>
                  <input className="input" type="email" inputMode="email" autoComplete="email" value={c.business.email ?? ''}
                    onChange={(e) => dispatch({ type: 'setEmail', email: e.target.value })} />
                </label>
              </section>

              <section className="panel" aria-labelledby="s-prices">
                <h2 id="s-prices">{tr('build.prices')}</h2>
                <div className="fe-list">{c.fields.map((f) => <FieldEditor key={f.id} field={f} dispatch={dispatch} tr={tr} />)}</div>
                <div className="vat-row">
                  <label className="field"><span>{tr('build.vat')}</span>
                    <NumInput value={c.vat?.rate ?? 0} onValue={(n) => dispatch({ type: 'setVat', rate: n, pricesInclude: c.vat?.pricesInclude ?? false })} />
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={c.vat?.pricesInclude ?? false}
                      onChange={(e) => dispatch({ type: 'setVat', rate: c.vat?.rate ?? 0, pricesInclude: e.target.checked })} />
                    {tr('build.vatIncluded')}
                  </label>
                </div>
              </section>

              <section className="panel" aria-labelledby="s-formula">
                <h2 id="s-formula">{tr('build.formula')}</h2>
                <textarea className="textarea" data-testid="formula" spellCheck={false} maxLength={500} rows={3}
                  value={state.formula} aria-invalid={formulaError ? true : undefined} aria-describedby="formula-msg"
                  onChange={(e) => dispatch({ type: 'setFormula', src: e.target.value, valid: compileFormula(e.target.value, fieldIds).ok })} />
                {formulaError
                  ? <p id="formula-msg" className="error" role="alert" data-testid="formula-error">{formulaError}</p>
                  : <p id="formula-msg" className="hint">{tr('build.formulaHint')}</p>}
                <div className="chips">{fieldIds.map((id) => <code key={id}>{id}</code>)}</div>
              </section>
            </>
          )}
        </div>

        <aside className="builder-side">
          <div className="sticky">
            {ready ? (
              <Phone label={tr('build.preview')}>
                <QuoteWidget config={c} testId="preview" loadError={tr('widget.loadError')} />
              </Phone>
            ) : (
              <div className="empty"><p>{tr('build.empty')}</p></div>
            )}

            <div className="share panel" aria-labelledby="s-share">
              <h2 id="s-share">{tr('share.title')}</h2>
              {blocker && <p className="hint" data-testid="share-blockers">{blocker}</p>}
              <div className="share-row">
                <input className="input" readOnly value={link} placeholder={tr('share.link')} aria-label={tr('share.link')} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-primary btn-small" data-testid="copy-link" disabled={!shareable} onClick={() => copy('link', link)}>
                  {copied === 'link' ? tr('share.copied') : tr('share.copyLink')}
                </button>
              </div>
              <div className="share-actions">
                <button type="button" className="btn btn-ghost btn-small" data-testid="copy-embed" disabled={!shareable} onClick={() => copy('embed', snippet)}>
                  {copied === 'embed' ? tr('share.copied') : tr('share.copyEmbed')}
                </button>
                <button type="button" className="btn btn-ghost btn-small" data-testid="download-json" disabled={!shareable} onClick={download}>{tr('share.download')}</button>
                {link && <a className="btn btn-ghost btn-small" href={link} target="_blank" rel="noopener">{tr('share.open')}</a>}
              </div>
              <p className="sr-only" role="status">{copied ? tr('share.copiedSr') : ''}</p>
            </div>
          </div>
        </aside>
      </main>
    </>
  )
}
