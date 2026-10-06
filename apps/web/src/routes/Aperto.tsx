import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LIMITS, encodeConfig, validateConfig } from '@quotelet/core'
import type { Config } from '@quotelet/core/types'
import { APERTO_EXAMPLES, isLang, loadApertoDraft, requestConfig, saveApertoDraft, summarizeConfig, type Lang } from '../lib/aperto'
import { embedSnippet, shareLink } from '../lib/share'
import { useCopy } from '../lib/useCopy'
import { useMeta } from '../lib/useMeta'
import { QuoteWidget } from '../components/QuoteWidget'
import { LangPicker } from '../components/LangPicker'
import { ValidatorPanel, type ValidatorState } from '../components/ValidatorPanel'
import { Phone, SiteHeader } from '../components/Chrome'
import './build.css'
import './aperto.css'

const MAX = 3000

function startDraft(): { text: string; lang: Lang } {
  const d = typeof window !== 'undefined' ? loadApertoDraft(window.localStorage) : null
  if (d) return d
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en'
  return { text: '', lang: isLang(nav) ? nav : 'en' }
}

/** /aperto: describe your prices, Apertus drafts a config, core validates it, you get a calculator. */
export function Aperto() {
  const [draft] = useState(startDraft)
  const [text, setText] = useState(draft.text)
  const [lang, setLang] = useState<Lang>(draft.lang)
  const [status, setStatus] = useState<ValidatorState>({ kind: 'idle' })
  const [config, setConfig] = useState<Config | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const inflight = useRef<AbortController | null>(null)
  const { copied, copy } = useCopy()
  useMeta('Quotelet Aperto: describe your prices, get a calculator')

  useEffect(() => { saveApertoDraft(window.localStorage, { text, lang }) }, [text, lang])
  useEffect(() => () => inflight.current?.abort(), [])

  const encoded = useMemo(() => {
    if (!config) return ''
    try { const e = encodeConfig(config); return e.length <= LIMITS.maxEncoded ? e : '' } catch { return '' }
  }, [config])
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = encoded ? shareLink(origin, encoded) : ''
  const snippet = encoded ? embedSnippet(origin, encoded) : ''
  const loading = status.kind === 'loading'

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!text.trim()) { setStatus({ kind: 'error', attempts: 0, errors: [{ path: '', message: 'Write your prices first, or pick an example.' }] }); textarea.current?.focus(); return }
    inflight.current?.abort()
    const ac = new AbortController()
    inflight.current = ac
    setStatus({ kind: 'loading' })
    setConfig(null)
    try {
      const r = await requestConfig(text, lang, { signal: ac.signal })
      if (ac.signal.aborted) return
      // Defense in depth: the server already validated, but the browser never renders an unchecked config.
      const checked = r.ok ? validateConfig(r.config) : null
      if (r.ok && checked?.ok) {
        setConfig(checked.config)
        setStatus({ kind: 'ok', summary: summarizeConfig(checked.config), attempts: r.attempts, warnings: r.warnings })
      } else if (checked && !checked.ok) {
        setStatus({ kind: 'error', attempts: r.attempts, errors: checked.errors })
      } else if (!r.ok) {
        setStatus({ kind: 'error', attempts: r.attempts, errors: r.errors })
      }
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: false }))
    } catch {
      /* aborted by a newer request */
    }
  }

  return (
    <>
      <SiteHeader>
        <Link to="/build" className="link hide-sm">Builder</Link>
        <Link to="/" className="link">Home</Link>
      </SiteHeader>
      <main className="wrap aperto">
        <div className="aperto-main">
          <header className="aperto-head">
            <p className="eyebrow">Quotelet Aperto · Apertus</p>
            <h1>Write your prices. Get a calculator.</h1>
            <p className="muted">Plain words, in four languages. Every number is checked.</p>
          </header>

          <form className="panel aperto-form" onSubmit={submit} aria-busy={loading}>
            <label className="field" htmlFor="aperto-text">
              <span>Describe your prices</span>
            </label>
            <textarea id="aperto-text" ref={textarea} className="textarea aperto-text" data-testid="aperto-text" rows={5} maxLength={MAX}
              value={text} spellCheck lang={lang} aria-describedby="aperto-hint aperto-count"
              placeholder="Prices, extras, minimum, VAT"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }} />
            <div className="aperto-meta">
              <span id="aperto-hint" className="hint kbd-hint">Ctrl + Enter sends</span>
              <span id="aperto-count" className="hint" aria-live="off">{text.length}/{MAX}</span>
            </div>

            <div className="aperto-examples" role="group" aria-labelledby="aperto-try">
              <span id="aperto-try" className="label">Try</span>
              {APERTO_EXAMPLES.map((ex) => (
                <button key={ex.id} type="button" className="chip" data-testid={`aperto-chip-${ex.id}`} lang={ex.lang}
                  onClick={() => { setText(ex.text); setLang(ex.lang) }}>
                  {ex.label}
                </button>
              ))}
            </div>

            <div className="aperto-actions">
              <LangPicker name="aperto-lang" legend="Language" value={lang} onChange={setLang} testIdPrefix="aperto-lang" />
              <button type="submit" className="btn btn-primary" data-testid="aperto-submit" disabled={loading}>
                {loading ? 'Working…' : 'Make my calculator'}
              </button>
            </div>
          </form>

          <ValidatorPanel ref={panel} state={status} />
        </div>

        <aside className="aperto-side" aria-label="Result">
          {config ? (
            <>
              <Phone label="Live preview">
                <QuoteWidget config={config} testId="aperto-preview" />
              </Phone>
              <section className="panel" aria-labelledby="aperto-share-h">
                <h2 id="aperto-share-h">Share</h2>
                {link ? (
                  <>
                    <div className="share-row">
                      <input className="input" readOnly value={link} aria-label="Share link" data-testid="aperto-share-link" onFocus={(e) => e.target.select()} />
                      <button type="button" className="btn btn-primary btn-small" data-testid="aperto-copy-link" onClick={() => copy('link', link)}>
                        {copied === 'link' ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                    <label className="field">
                      <span>Embed on your site</span>
                      <textarea className="textarea aperto-embed" readOnly rows={3} value={snippet} data-testid="aperto-embed" onFocus={(e) => e.target.select()} />
                    </label>
                    <div className="share-actions">
                      <button type="button" className="btn btn-ghost btn-small" data-testid="aperto-copy-embed" onClick={() => copy('embed', snippet)}>
                        {copied === 'embed' ? 'Copied' : 'Copy embed code'}
                      </button>
                      <a className="btn btn-ghost btn-small" href={link} target="_blank" rel="noopener" data-testid="aperto-open-link">Open link</a>
                    </div>
                  </>
                ) : (
                  <p className="hint">This calculator is too big for a link. Shorten the price list.</p>
                )}
                <p className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</p>
              </section>
            </>
          ) : (
            <div className="empty aperto-empty">
              <p>{loading ? 'Building your calculator…' : 'Your calculator shows up here.'}</p>
            </div>
          )}
        </aside>
      </main>
    </>
  )
}
