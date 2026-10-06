// Local static server for the built site on 127.0.0.1:4173 with SPA fallback. Usage: bun run build && bun run serve
import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { APERTO_PATH, localApertoHandler } from '../packages/aperto/src/local.ts'

const ROOT = join(import.meta.dir, '..', 'apps/web/dist')
const port = Number(process.env.PORT ?? 4173)
const aperto = localApertoHandler() // H-01: POST /api/aperto (APERTUS_MOCK=1 = recorded answers, no key)

Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch(req) {
    if (new URL(req.url).pathname === APERTO_PATH) return aperto(req)
    const path = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(ROOT, path)
    if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 })
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (existsSync(file)) {
      const headers: Record<string, string> = path.startsWith('/assets/') ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}
      return new Response(Bun.file(file), { headers })
    }
    if (/\.[a-z0-9]+$/i.test(path)) return new Response('Not found', { status: 404 })
    return new Response(Bun.file(join(ROOT, 'index.html')), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  },
})
console.log(`quotelet: http://127.0.0.1:${port}`)
