import { useState } from 'react'
import { readRef, submitWaitlist } from '../lib/waitlist'

const copy = {
  en: { label: 'Email', placeholder: 'you@company.com', cta: 'Get notified', sending: 'Saving…', done: "You're on the list. One email when it ships." },
  it: { label: 'Email', placeholder: 'tu@impresa.it', cta: 'Avvisami', sending: 'Salvo…', done: 'Fatto. Ti scriviamo una volta, quando è pronto.' },
}

/** sessionStorage can throw on access (sandboxed frames, blocked storage). */
const session = () => { try { return window.sessionStorage } catch { return undefined } }

export function Waitlist({ locale = 'en', source }: { locale?: 'en' | 'it'; source: string }) {
  const t = copy[locale]
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ref] = useState(() => (typeof window === 'undefined' ? '' : readRef(window.location.search, session())))

  if (state === 'done')
    return (
      <div className="waitlist-done" data-testid="waitlist" role="status">
        <span data-testid="waitlist-success" style={{ display: 'contents' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
          {t.done}
        </span>
      </div>
    )

  return (
    <form
      className="waitlist"
      data-testid="waitlist"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        setState('sending')
        const r = await submitWaitlist(email, source, { ref })
        if (r.ok) return setState('done')
        setState('idle')
        setError(locale === 'it' ? (r.error.startsWith('Check') ? "Controlla l'indirizzo email." : 'Non è andata. Riprova tra un minuto.') : r.error)
      }}
    >
      <input type="hidden" name="ref" value={ref} data-testid="waitlist-ref" />
      <label className="sr-only" htmlFor={`wl-${source}`}>{t.label}</label>
      <input
        id={`wl-${source}`}
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder={t.placeholder}
        value={email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `wl-${source}-err` : undefined}
        onChange={(e) => { setEmail(e.target.value); setError(null) }}
      />
      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? t.sending : t.cta}</button>
      {error && <p className="error" id={`wl-${source}-err`} role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
    </form>
  )
}
