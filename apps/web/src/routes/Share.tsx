import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { QuoteWidget } from '../components/QuoteWidget'
import { useMeta } from '../lib/useMeta'
import './share.css'

const readHash = () => new URLSearchParams(window.location.hash.slice(1)).get('c') ?? ''

/** /q#c=<base64url config>. The config lives in the fragment, so it never reaches a server. */
export function Share() {
  const [encoded, setEncoded] = useState(readHash)
  useEffect(() => {
    const on = () => setEncoded(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useMeta('Quote calculator')

  return (
    <main className="share-page">
      {encoded ? (
        <QuoteWidget config={encoded} testId="share-widget" className="share-widget" />
      ) : (
        <div className="share-empty">
          <h1>No calculator in this link</h1>
          <p className="muted">The link looks cut off. Ask for it again, or build your own.</p>
          <Link to="/build" className="btn btn-primary">Build a calculator</Link>
        </div>
      )}
    </main>
  )
}
