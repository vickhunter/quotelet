import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { getTemplate } from '@quotelet/core'
import type { Config } from '@quotelet/core/types'
import { QuoteWidget } from '../components/QuoteWidget'
import { Waitlist } from '../components/Waitlist'
import { SiteHeader, SiteFooter } from '../components/Chrome'
import { useMeta } from '../lib/useMeta'
import './it.css'

export function ItPainters() {
  useMeta(
    'Quanto costa imbiancare casa al m²? Calcolatore 2026',
    'it',
    'Calcola in pochi secondi quanto costa imbiancare casa: metri quadri, altezza, colore. Stima con IVA, da condividere su WhatsApp.',
  )
  // Consumer mode: no business number, so the CTA becomes "share on WhatsApp".
  const config = useMemo(() => {
    const t = getTemplate('imbianchino-it') as Config
    return { ...t, business: { name: 'Stima imbiancatura' } }
  }, [])

  return (
    <>
      <SiteHeader><Link to="/build" search={{ template: 'imbianchino-it' }} className="link">Per imbianchini</Link></SiteHeader>
      <main className="it">
        <div className="wrap it-grid">
          <header className="it-head">
            <p className="eyebrow">Calcolatore gratuito</p>
            <h1>Quanto costa imbiancare casa al m²? Calcolatore 2026</h1>
            <p className="lede">Inserisci i metri quadri e qualche dettaglio. Ottieni una forbice di prezzo con IVA, da condividere su WhatsApp.</p>
          </header>

          <div className="it-widget">
            <QuoteWidget config={config} testId="consumer-widget" />
          </div>

          <article className="it-explainer">
            <h2>Da cosa dipende il prezzo</h2>
            <p>Conta la superficie da pitturare, l'altezza dei soffitti, il colore (il bianco costa meno), se la casa è arredata e se ci sono pareti con muffa da trattare. Come riferimento, i prezzi medi pubblicati da Instapro vanno da circa 5 a 15 € al m² di parete.</p>
            <p><a href="https://www.instapro.it/tinteggiatura/prezzi-costo/quanto-costa-imbiancare-casa" target="_blank" rel="noopener noreferrer">Prezzi medi su Instapro</a></p>
            <p className="note">È una stima, non un preventivo. L'aliquota IVA la conferma l'impresa. Non è consulenza fiscale.</p>
          </article>

          <aside className="pro-box" data-testid="pro-box">
            <h2>Sei un imbianchino?</h2>
            <p>Metti questo calcolatore sul tuo sito con i tuoi prezzi. Le richieste ti arrivano su WhatsApp.</p>
            <a className="btn btn-primary" data-testid="pro-box-cta" href="/build?template=imbianchino-it">Crea il tuo calcolatore</a>
          </aside>

          <section className="it-waitlist" aria-labelledby="it-wl">
            <h2 id="it-wl">Versione ospitata e acconti</h2>
            <p className="muted">Lascia la tua email: ti avvisiamo quando sono pronti.</p>
            <Waitlist locale="it" source="it-imbianchini" />
          </section>
        </div>
      </main>
      <SiteFooter locale="it" />
    </>
  )
}
