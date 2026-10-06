import { useEffect, useRef } from 'react'
import type { Config, Quote } from '@quotelet/core/types'
import { EN } from '../lib/i18n'

type Handle = { update(answers: Record<string, number | boolean>): void; destroy(): void }
type QuoteletApi = { mount(el: Element, config: unknown): Handle }
declare global { interface Window { Quotelet?: QuoteletApi } }

/** Resolves once /quotelet.js has run (it is a deferred script in index.html). */
function quotelet(): Promise<QuoteletApi> {
  if (window.Quotelet) return Promise.resolve(window.Quotelet)
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const tick = () => (window.Quotelet ? resolve(window.Quotelet) : Date.now() - t0 > 8000 ? reject(new Error('widget did not load')) : setTimeout(tick, 30))
    tick()
  })
}

type Props = {
  config: Config | string
  testId?: string
  className?: string
  onQuote?: (q: Quote) => void
  /** Shown if /quotelet.js never loads. */
  loadError?: string
}

/** Mounts the real embeddable widget. Remounts when the config changes. */
export function QuoteWidget({ config, testId, className, onQuote, loadError = EN['widget.loadError'] }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const onQuoteRef = useRef(onQuote)
  onQuoteRef.current = onQuote
  const key = typeof config === 'string' ? config : JSON.stringify(config)

  useEffect(() => {
    let handle: Handle | undefined
    let cancelled = false
    const node = el.current!
    const listener = (e: Event) => { const q = (e as CustomEvent<{ quote?: Quote }>).detail?.quote; if (q) onQuoteRef.current?.(q) }
    node.addEventListener('quotelet:quote', listener)
    quotelet().then(
      (Q) => { if (!cancelled) handle = Q.mount(node, typeof config === 'string' ? config : JSON.parse(key)) },
      () => { if (!cancelled) node.textContent = loadError },
    )
    return () => {
      cancelled = true
      node.removeEventListener('quotelet:quote', listener)
      handle?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <div ref={el} data-testid={testId} className={className} />
}
