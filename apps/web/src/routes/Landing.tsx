import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getTemplate, listTemplates, buildLeadMessage } from '@quotelet/core'
import type { Config, Quote } from '@quotelet/core/types'
import { QuoteWidget } from '../components/QuoteWidget'
import { Waitlist } from '../components/Waitlist'
import { devSnippet } from '../lib/share'
import { SiteHeader, SiteFooter, Phone } from '../components/Chrome'
import './landing.css'

const DEMOS = [
  { id: 'painting-en', label: 'English' },
  { id: 'imbianchino-it', label: 'Italiano' },
] as const

function messageFor(config: Config, quote: Quote | null, name: string) {
  if (!quote || quote.error) return ''
  return buildLeadMessage(config, quote, { name }, 'owner')
}

const snippet = () => devSnippet(window.location.origin)

export function Landing() {
  const [demo, setDemo] = useState<(typeof DEMOS)[number]['id']>('painting-en')
  const config = useMemo(() => getTemplate(demo) as Config, [demo])
  const [quote, setQuote] = useState<Quote | null>(null)
  const message = messageFor(config, quote, demo === 'painting-en' ? 'Anna' : 'Giulia')
  const templates = listTemplates()

  return (
    <>
      <SiteHeader>
        <a className="link hide-sm" href="#how">How it works</a>
        <a className="link hide-sm" href="#developers">Developers</a>
        <Link to="/build" className="btn btn-primary btn-small">Build yours</Link>
      </SiteHeader>

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Open source · MIT</p>
              <h1>Instant quotes on any website. <em>Leads straight to WhatsApp.</em></h1>
              <p className="lede">Open-source quote calculator for service businesses. One script tag or one link. No backend, no signup, stores no customer data.</p>
              <div className="hero-ctas">
                <Link to="/build" className="btn btn-primary">Build your calculator (free)</Link>
                <a href="#waitlist" className="btn btn-ghost">Get notified</a>
              </div>
            </div>

            <div className="hero-demo">
              <div className="demo-switch" role="tablist" aria-label="Demo language">
                {DEMOS.map((d) => (
                  <button key={d.id} role="tab" aria-selected={demo === d.id} className={demo === d.id ? 'on' : ''} onClick={() => { setQuote(null); setDemo(d.id) }}>{d.label}</button>
                ))}
              </div>
              <Phone label="Live demo">
                <QuoteWidget config={config} testId="demo-widget" onQuote={setQuote} />
              </Phone>
              <figure className="wa-preview" aria-live="polite">
                <figcaption>{demo === 'painting-en' ? 'What lands in your WhatsApp' : 'Cosa ti arriva su WhatsApp'}</figcaption>
                <div className="bubble">{message || '…'}</div>
              </figure>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">How it works</p>
              <h2>Live on your site in five minutes.</h2>
            </div>
            <ol className="steps">
              <li><span className="step-n">1</span><h3>Pick a template</h3><p className="muted">Painting, cleaning or moving. Change any label.</p></li>
              <li><span className="step-n">2</span><h3>Set your prices</h3><p className="muted">Per m², per room, minimum job, VAT. The preview updates as you type.</p></li>
              <li><span className="step-n">3</span><h3>Share it</h3><p className="muted">Paste one tag on your site, or put the link in your Instagram bio and WhatsApp Business.</p></li>
            </ol>
          </div>
        </section>

        <section className="section dev" id="developers">
          <div className="wrap dev-grid">
            <div className="section-head">
              <p className="eyebrow">For developers</p>
              <h2>One tag. No framework, no backend.</h2>
              <ul className="facts">
                <li><strong>&lt;15 KB</strong> gzipped, zero dependencies</li>
                <li><strong>Shadow DOM</strong>, so your CSS and ours never clash</li>
                <li><strong>CLI</strong> to validate configs and make links in CI</li>
                <li><strong>MIT</strong>, fork it and ship it</li>
              </ul>
            </div>
            <div className="code-stack">
              <pre className="code" aria-label="Embed snippet"><code>{snippet()}</code></pre>
              <pre className="code" aria-label="CLI"><code><span className="dim">$</span> bun run cli validate painting.json{'\n'}<span className="dim">$</span> bun run cli link painting.json</code></pre>
            </div>
          </div>
        </section>

        <section className="section privacy">
          <div className="wrap privacy-inner">
            <svg viewBox="0 0 48 48" aria-hidden className="privacy-mark"><path d="M24 4 8 10v12c0 10 7 18.5 16 22 9-3.5 16-12 16-22V10L24 4Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><path d="m17 24 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h2>Quotelet never sees your customers.</h2>
            <p className="muted">The quote is computed in the browser and the visitor sends it from their own WhatsApp.</p>
          </div>
        </section>

        <section className="section" id="templates">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">Templates</p>
              <h2>Start from a real price list.</h2>
            </div>
            <ul className="templates">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link to="/build" search={{ template: t.id }} className="template-card">
                    <span className="flag">{t.locale.slice(0, 2).toUpperCase()}</span>
                    <span>{t.title}</span>
                    <span className="arrow" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="wrap faq-grid">
            <div className="section-head"><p className="eyebrow">FAQ</p><h2>Short answers.</h2></div>
            <div className="faq">
              <details><summary>Is the price binding?</summary><p>No. It is an estimate. You write your own disclaimer and it shows under the range.</p></details>
              <details><summary>What VAT rate does it use?</summary><p>The one you set, with prices including or excluding it. Quotelet does the maths, not tax advice.</p></details>
              <details><summary>Is there a hosted version, or payments?</summary><p>Not yet. Deposits and saved calculators are next. Join the list below to hear when.</p></details>
            </div>
          </div>
        </section>

        <section className="section cta-band" id="waitlist">
          <div className="wrap cta-inner">
            <h2>Get notified about the hosted version and deposits</h2>
            <Waitlist source="landing-en" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
