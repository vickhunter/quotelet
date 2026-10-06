// Copies the widget bundle (and AI Engineer's harness pages, if any) into the web build: apps/web/dist is the deploy folder.
// D-004b: also writes the static host config from scripts/site.ts (routes, headers, robots, sitemap, painting.json).
import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { paintingConfig, robotsTxt, sitemapXml, vercelConfig } from './site.ts'

const ROOT = join(import.meta.dir, '..')
const OUT = join(ROOT, 'apps/web/dist')
const widget = join(ROOT, 'dist/quotelet.js')
if (!existsSync(join(OUT, 'index.html'))) throw new Error('apps/web/dist missing: run bun run build:web first')
if (!existsSync(join(OUT, '404.html'))) throw new Error('apps/web/dist/404.html missing (apps/web/public/404.html)')
if (!existsSync(widget)) throw new Error('dist/quotelet.js missing: run bun run build:widget first')
cpSync(widget, join(OUT, 'quotelet.js'))
if (existsSync(join(ROOT, 'harness'))) cpSync(join(ROOT, 'harness'), join(OUT, 'harness'), { recursive: true })
for (const f of ['config-imbianchino.json']) if (existsSync(join(ROOT, 'fixtures', f))) cpSync(join(ROOT, 'fixtures', f), join(OUT, 'fixtures', f), { recursive: true })
// The landing developer snippet points at /painting.json: ship it (the painting-en template).
writeFileSync(join(OUT, 'painting.json'), JSON.stringify(paintingConfig(), null, 2) + '\n')
writeFileSync(join(OUT, 'robots.txt'), robotsTxt())
writeFileSync(join(OUT, 'sitemap.xml'), sitemapXml())
// Static host config (Vercel): only the client routes go to index.html, anything else gets 404.html.
writeFileSync(join(OUT, 'vercel.json'), JSON.stringify(vercelConfig(), null, 2))
console.log('assembled', OUT)
