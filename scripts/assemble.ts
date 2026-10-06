// Copies the widget bundle (and AI Engineer's harness pages, if any) into the web build: apps/web/dist is the deploy folder.
import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const OUT = join(ROOT, 'apps/web/dist')
const widget = join(ROOT, 'dist/quotelet.js')
if (!existsSync(join(OUT, 'index.html'))) throw new Error('apps/web/dist missing: run bun run build:web first')
if (!existsSync(widget)) throw new Error('dist/quotelet.js missing: run bun run build:widget first')
cpSync(widget, join(OUT, 'quotelet.js'))
if (existsSync(join(ROOT, 'harness'))) cpSync(join(ROOT, 'harness'), join(OUT, 'harness'), { recursive: true })
for (const f of ['config-imbianchino.json']) if (existsSync(join(ROOT, 'fixtures', f))) cpSync(join(ROOT, 'fixtures', f), join(OUT, 'fixtures', f), { recursive: true })
// Static host config: SPA fallback for /build, /q, /it/... (Vercel).
writeFileSync(join(OUT, 'vercel.json'), JSON.stringify({ rewrites: [{ source: '/((?!api/|assets/|fonts/|harness/|fixtures/|quotelet\\.js|favicon\\.svg).*)', destination: '/index.html' }] }, null, 2))
console.log('assembled', OUT)
