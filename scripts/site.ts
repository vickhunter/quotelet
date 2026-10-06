// D-004b: one source for the static host config. scripts/assemble.ts writes it into apps/web/dist
// (vercel.json, 404.html, robots.txt, sitemap.xml, painting.json); scripts/serve.ts applies the same
// routes and headers locally, so the Playwright checks see what Vercel serves.
import { createHash } from 'node:crypto'
import { getTemplate } from '../packages/core/src/index.ts'
import { CSS } from '../packages/widget/src/styles.ts'

export const SITE_URL = 'https://quotelet.vercel.app'
/** Client routes in apps/web/src/main.tsx (site.test.ts keeps them in sync). Everything else is a 404. */
export const SPA_PATHS = ['/', '/build', '/q', '/aperto', '/it/quanto-costa-imbiancare'] as const
/** Public pages for search engines (/q without a config is an empty page). */
export const SITEMAP_PATHS = ['/', '/build', '/aperto', '/it/quanto-costa-imbiancare'] as const
/** Files the landing developer snippet points at. */
export const EMBED_FILES = ['/quotelet.js', '/painting.json'] as const

export const paintingConfig = () => getTemplate('painting-en')!

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
export const sitemapXml = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SITEMAP_PATHS.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}\n</urlset>\n`

/** The widget renders one constant <style> into its shadow root; the CSP allows exactly that text. */
export const widgetStyleHash = () => `sha256-${createHash('sha256').update(CSS).digest('base64')}`

export const csp = () => [
  "default-src 'self'",
  "script-src 'self'",
  `style-src 'self' '${widgetStyleHash()}'`,
  "img-src 'self' data:",
  "font-src 'self' data:", // Vite inlines small font subsets as data: URIs
  "connect-src 'self' https://formsubmit.co", // waitlist posts to FormSubmit's AJAX endpoint
  "form-action 'self' https://formsubmit.co",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

// Paths other sites load (embed script, JSON configs, AI Engineer's harness pages) or that are not
// documents (api, hashed assets): no CSP and no frame-ancestors there.
const NOT_APP = ['quotelet\\.js', 'painting\\.json', 'fixtures/', 'harness/', 'api/', 'assets/']

type Rule = { source: string; re: RegExp; headers: Record<string, string> }
const rules = (): Rule[] => [
  {
    source: '/(.*)', re: /^\//,
    headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
  },
  {
    source: `/((?!${NOT_APP.join('|')}).*)`, re: new RegExp(`^/(?!${NOT_APP.join('|')})`),
    headers: { 'Content-Security-Policy': csp() },
  },
  {
    source: '/(painting\\.json|fixtures/.*)', re: /^\/(painting\.json$|fixtures\/)/,
    headers: { 'Access-Control-Allow-Origin': '*' }, // configs are public; the widget fetches them from any site
  },
  {
    source: '/assets/(.*)', re: /^\/assets\//,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  },
]

/** Headers for a request path, merged in rule order (what Vercel does with vercel.json `headers`). */
export function headersFor(path: string): Record<string, string> {
  return Object.assign({}, ...rules().filter((r) => r.re.test(path)).map((r) => r.headers))
}

export const isSpaPath = (path: string) => (SPA_PATHS as readonly string[]).includes(path)

export function vercelConfig() {
  return {
    rewrites: SPA_PATHS.filter((p) => p !== '/').map((source) => ({ source, destination: '/index.html' })),
    headers: rules().map((r) => ({ source: r.source, headers: Object.entries(r.headers).map(([key, value]) => ({ key, value })) })),
  }
}
