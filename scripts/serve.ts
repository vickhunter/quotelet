// Local static server for the built site on 127.0.0.1:4173. Usage: bun run build && bun run serve
// D-004b: same routes and headers as the generated vercel.json (scripts/site.ts): client routes get
// index.html, anything else 404.html with status 404.
import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { APERTO_PATH, localApertoHandler } from '../packages/aperto/src/local.ts'
import { headersFor, isSpaPath } from './site.ts'

const ROOT = join(import.meta.dir, '..', 'apps/web/dist')
const port = Number(process.env.PORT ?? 4173)
const aperto = localApertoHandler() // H-01: POST /api/aperto (APERTUS_MOCK=1 = recorded answers, no key)

Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch(req) {
    const pathname = new URL(req.url).pathname
    if (pathname === APERTO_PATH) return withHeaders(pathname, aperto(req))
    const path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(ROOT, path)
    if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 })
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html') // static hosts serve dir/index.html
    const html = { 'Content-Type': 'text/html; charset=utf-8' }
    if (path === '/' || isSpaPath(path)) return new Response(Bun.file(join(ROOT, 'index.html')), { headers: { ...html, ...headersFor(path) } })
    if (existsSync(file) && statSync(file).isFile()) return new Response(Bun.file(file), { headers: headersFor(path) })
    return new Response(Bun.file(join(ROOT, '404.html')), { status: 404, headers: { ...html, ...headersFor(path) } })
  },
})
console.log(`quotelet: http://127.0.0.1:${port}`)

async function withHeaders(path: string, res: Response | Promise<Response>) {
  const r = await res
  const headers = new Headers(r.headers)
  for (const [k, v] of Object.entries(headersFor(path))) if (!headers.has(k)) headers.set(k, v)
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers })
}
