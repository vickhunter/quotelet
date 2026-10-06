import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export function Logo({ label = 'Quotelet home' }: { label?: string }) {
  return (
    <Link to="/" className="logo" aria-label={label}>
      <svg viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="#17140F" /><path d="M9 20.5c0-4.7 3.1-9 7-12.5 3.9 3.5 7 7.8 7 12.5a7 7 0 0 1-14 0Z" fill="#E4572E" /></svg>
      quotelet
    </Link>
  )
}

export function SiteHeader({ children, homeLabel, navLabel = 'Main' }: { children?: ReactNode; homeLabel?: string; navLabel?: string }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="wrap">
        <Logo label={homeLabel} />
        <nav className="nav" aria-label={navLabel}>{children}</nav>
      </div>
    </header>
  )
}

export function SiteFooter({ locale = 'en' }: { locale?: 'en' | 'it' }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>{locale === 'it' ? 'Open source, licenza MIT. Nessun cookie di tracciamento.' : 'Open source, MIT licensed. No tracking cookies.'}</span>
        <span>{locale === 'it' ? 'Nessuna affiliazione con le aziende citate.' : 'No affiliation with any company named.'}</span>
      </div>
    </footer>
  )
}

export function Phone({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="phone" aria-label={label}>
      <div className="phone-screen">
        <div className="phone-bar" aria-hidden />
        {children}
      </div>
    </div>
  )
}
