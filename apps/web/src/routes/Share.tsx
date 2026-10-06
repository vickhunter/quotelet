import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { decodeConfig } from '@quotelet/core'
import { cleanLeadName } from '@quotelet/core/handoff'
import type { Config, Quote } from '@quotelet/core/types'
import { QuoteWidget } from '../components/QuoteWidget'
import { LangPicker } from '../components/LangPicker'
import { LANGS, isRecording, leadText, messageKey, requestMessage, waUrl, type Lang } from '../lib/aperto'
import { loadUiLang, translator, uiLangOfLocale, type T } from '../lib/i18n'
import { useMeta } from '../lib/useMeta'
import './share.css'

const readHash = () => new URLSearchParams(window.location.hash.slice(1)).get('c') ?? ''
type Msg = { key: string; lang: Lang; status: 'loading' | 'ready' | 'fallback'; text?: string; demo?: boolean }

/** /q#c=<base64url config>. The config lives in the fragment, so it never reaches a server. */
export function Share() {
  const [encoded, setEncoded] = useState(readHash)
  useEffect(() => {
    const on = () => setEncoded(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const config = useMemo(() => { const r = encoded ? decodeConfig(encoded) : null; return r?.ok ? r.config : null }, [encoded])
  // The page speaks the calculator's language; with no readable config, the builder's saved choice.
  const lang = config ? uiLangOfLocale(config.locale) : (loadUiLang(window.localStorage) ?? 'en')
  const tr = useMemo(() => translator(lang), [lang])
  useMeta(tr('q.metaTitle'), lang)

  return (
    <main className="share-page">
      {encoded ? (
        <>
          {config ? <SharedCalculator key={encoded} config={config} encoded={encoded} tr={tr} /> : <QuoteWidget config={encoded} testId="share-widget" className="share-widget" loadError={tr('widget.loadError')} />}
        </>
      ) : (
        <div className="share-empty">
          <h1>{tr('q.emptyTitle')}</h1>
          <p className="muted">{tr('q.emptyBody')}</p>
          <Link to="/build" search={lang === 'it' ? { lang: 'it' } : {}} className="btn btn-primary">{tr('q.emptyCta')}</Link>
        </div>
      )}
    </main>
  )
}

/** Widget plus the optional "message language" toggle. With a language picked, the WhatsApp CTA
 *  sends the server's text (core amounts) instead of core's default message; on any failure the
 *  widget's own CTA runs unchanged. */
function SharedCalculator({ config, encoded, tr }: { config: Config; encoded: string; tr: T }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lang, setLang] = useState<Lang | null>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const live = useRef({ config, quote, msg, lang })
  live.current = { config, quote, msg, lang }

  // Fetch the message for the current quote + language (debounced while the customer types).
  useEffect(() => {
    if (!lang || !quote) return
    const key = messageKey(quote, lang)
    if (msg?.key === key && msg.status !== 'loading') return
    setMsg({ key, lang, status: 'loading' })
    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const r = await requestMessage(config, quote, lang, { signal: ac.signal })
        if (!ac.signal.aborted) setMsg(r.ok ? { key, lang, status: 'ready', text: r.text, demo: isRecording(r) } : { key, lang, status: 'fallback' })
      } catch { /* aborted */ }
    }, 500) // debounce: the proxy allows about 10 calls per minute per IP
    return () => { ac.abort(); window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, quote, config])

  // Take over the widget's WhatsApp click only when a fresh message for this exact quote is ready.
  useEffect(() => {
    const el = wrap.current!
    const onClick = (e: MouseEvent) => {
      const { config: c, quote: q, msg: m, lang: l } = live.current
      const host = el.querySelector('[data-testid="share-widget"]')
      const root = host?.shadowRoot
      const btn = root?.querySelector('[data-testid="ql-cta-whatsapp"]')
      if (!host || !btn || !e.composedPath().includes(btn)) return
      if (!q || q.error || !l || !m || m.status !== 'ready' || !m.text || m.key !== messageKey(q, l)) return
      let name: string
      try { name = cleanLeadName((root!.querySelector('[data-testid="ql-name"]') as HTMLInputElement | null)?.value) } catch { return } // widget shows its hint
      e.stopPropagation()
      e.preventDefault()
      host.dispatchEvent(new CustomEvent('quotelet:lead', { detail: { channel: 'whatsapp', id: c.id }, bubbles: true, composed: true }))
      window.open(waUrl(c, leadText(c, q, m.text, name)), '_blank', 'noopener')
    }
    el.addEventListener('click', onClick, true)
    return () => el.removeEventListener('click', onClick, true)
  }, [])

  const current = lang && quote && msg && msg.key === messageKey(quote, lang) ? msg : null
  const langNames = useMemo(() => Object.fromEntries(LANGS.map((l) => [l, tr(`lang.${l}`)])) as Record<Lang, string>, [tr])
  return (
    <div className="share-stack" ref={wrap}>
      <QuoteWidget config={encoded} testId="share-widget" className="share-widget" onQuote={setQuote} loadError={tr('widget.loadError')} />
      <section className="msg-lang" aria-label={tr('q.msgLang')}>
        <LangPicker name="msg-lang" legend={tr('q.msgLang')} value={lang} onChange={setLang} testIdPrefix="msg-lang" names={langNames} />
        {lang && (
          <div className="msg-preview" data-testid="msg-preview" data-lang={current?.lang ?? lang} data-status={current?.status ?? 'loading'} aria-live="polite" lang={lang}>
            {current?.status === 'ready' ? current.text
              : current?.status === 'fallback' ? <span className="hint">{tr('q.msgFallback')}</span>
              : <span className="hint"><span className="spinner" aria-hidden /> {tr('q.writing')}</span>}
          </div>
        )}
        {lang && current?.status === 'ready' && current.demo && <p className="demo-tag" data-testid="msg-demo">{tr('demo.recorded')}</p>}
      </section>
    </div>
  )
}
