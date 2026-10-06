// H-01 Quotelet Aperto proof (owner: UI/UX): screenshots, cover and the demo video of the section 6
// happy path. Needs the local build with recorded answers: `bun run build && APERTUS_MOCK=1 bun run serve`.
// Run: `node --import tsx sim/aperto-proof.ts [shots|video|all]`. Raw video: /tmp/quotelet-aperto-demo.raw.webm (RAW=...),
// captions proof/aperto-demo.srt; then `node --import tsx sim/aperto-video.ts` makes proof/aperto-demo.mp4.
import type { BrowserContext, Page } from 'playwright'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchBrowser, setField } from './lib.ts'
import { EXAMPLES } from '../packages/aperto/src/examples.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const OUT = 'proof'
const RAW = process.env.RAW ?? '/tmp/quotelet-aperto-demo.raw.webm'
const MOVER = 'mover-lugano'
const BROKEN = 'Gardening: 50 per hour, a bit more on Sundays'
mkdirSync(OUT, { recursive: true })

const tid = (p: Page, id: string) => p.locator(`[data-testid="${id}"]`)
const preview = (p: Page) => tid(p, 'aperto-preview')
const widget = (p: Page) => tid(p, 'share-widget')
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function freshAperto(p: Page) {
  await p.goto(`${BASE}/aperto`)
  await p.evaluate(() => localStorage.removeItem('quotelet:aperto-draft'))
  await p.reload()
  await tid(p, 'aperto-text').waitFor()
}
async function makeMover(p: Page) {
  await tid(p, `aperto-chip-${MOVER}`).click()
  await tid(p, 'aperto-submit').click()
  await p.locator('[data-testid="validator"][data-state="ok"]').waitFor()
  await preview(p).locator('[data-testid="ql-result-high"]').waitFor()
}
async function customerItalian(p: Page, link: string) {
  await p.goto(link)
  await widget(p).locator('[data-testid="ql-result-high"]').waitFor()
  await setField(widget(p), 'volumen', 20)
  await setField(widget(p), 'etage_auszug', 3)
  await setField(widget(p), 'ohne_lift', true)
  await tid(p, 'msg-lang-it').check()
  await p.locator('[data-testid="msg-preview"][data-lang="it"][data-status="ready"]').waitFor()
}
const settle = async (p: Page) => { await p.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0) }); await p.waitForTimeout(400) }

async function shots() {
  const b = await launchBrowser()
  try {
    for (const [w, h] of [[375, 812], [1440, 900]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 375 ? 2 : 1 })
      const p = await ctx.newPage()
      await freshAperto(p)
      await makeMover(p)
      await settle(p)
      await p.screenshot({ path: `${OUT}/aperto-page-${w}.png`, fullPage: true })
      const link = await tid(p, 'aperto-share-link').inputValue()
      const ox = await overflow(p)
      await customerItalian(p, link)
      await settle(p)
      await p.screenshot({ path: `${OUT}/aperto-q-${w}.png`, fullPage: true })
      console.log(`shots ${w}: /aperto overflow ${ox}px, /q overflow ${await overflow(p)}px`)
      await ctx.close()
    }
    // Cover: 1600x900 CSS px rendered at 0.8x, so the PNG is 1280x720 and shows form, validator and preview.
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 0.8 })
    const p = await ctx.newPage()
    await freshAperto(p)
    await makeMover(p)
    await settle(p)
    await p.screenshot({ path: `${OUT}/aperto-cover.png` })
    await ctx.close()
    console.log('cover 1280x720 done')
  } finally { await b.close() }
}

// ---- demo-only pages (eval table, self-host, close card), rendered from the README -------------
const assets = readdirSync('apps/web/dist/assets')
const font = (re: RegExp) => assets.find((f) => re.test(f)) ?? ''
const FONTS = `@font-face{font-family:IS;src:url(/assets/${font(/^instrument-sans-latin-wght.*woff2$/)}) format('woff2');font-weight:100 900}
@font-face{font-family:BG;src:url(/assets/${font(/^bricolage-grotesque-latin-wght.*woff2$/)}) format('woff2');font-weight:100 900}
@font-face{font-family:JM;src:url(/assets/${font(/^jetbrains-mono-latin-400.*woff2$/)}) format('woff2')}`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)_([^_]+)_/g, '$1<i>$2</i>').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
function md(src: string): string {
  const out: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++ }
      i--
      const [head, , ...body] = rows
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
    } else if (/^\s*(\d+\.|-) /.test(l)) out.push(`<p class="li${/^\s{2,}/.test(l) ? ' sub' : ''}">${inline(l.trim().replace(/^-\s/, '• '))}</p>`)
    else if (l.startsWith('### ')) out.push(`<h1>${inline(l.slice(4))}</h1>`)
    else if (l.trim() && !l.startsWith('<!--')) out.push(`<p>${inline(l)}</p>`)
  }
  return out.join('\n')
}
const readme = readFileSync('README.md', 'utf8')
const section = (from: string, to: string) => { const a = readme.indexOf(from); const b = readme.indexOf(to, a + 1); return a < 0 ? '' : readme.slice(a, b < 0 ? undefined : b) }
const page = (body: string, extra = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><style>${FONTS}
body{margin:0;background:#F4EFE4;color:#17140F;font:400 19px/1.5 IS,system-ui,sans-serif;padding:44px 64px}
h1{font:700 40px/1.05 BG,system-ui;letter-spacing:-.02em;margin:0 0 18px} p{margin:0 0 12px;max-width:1100px} .li{margin:0 0 8px} .sub{padding-left:28px;font-size:17px}
code{font:15px JM,monospace;background:#EBE3D2;padding:1px 6px;border-radius:5px} table{border-collapse:collapse;margin-top:14px;font-size:15px;background:#FFFDF8;border:1px solid #DDD3BF}
th,td{padding:9px 12px;border-bottom:1px solid #DDD3BF;text-align:left;vertical-align:top} th{font-weight:650;background:#EBE3D2} i{color:#4B4539}${extra}</style><body>${body}</body></html>`
const DEMO: Record<string, string> = {
  '/__demo/eval': page(`<h1>Eval: 30 price lists, 4 languages, 8B vs 70B</h1>${md(section('<!-- aperto-eval:start -->', '<!-- aperto-eval:end -->'))}<p><code>bun run eval:aperto</code> reruns it against any OpenAI-compatible endpoint.</p>`, 'table{font-size:14px}'),
  '/__demo/selfhost': page(md(section('### Sovereign deployment', '### Hackathon disclosure'))),
  '/__demo/close': page(`<div class="c"><svg viewBox="0 0 32 32" width="72" height="72"><rect width="32" height="32" rx="8" fill="#17140F"/><path d="M9 20.5c0-4.7 3.1-9 7-12.5 3.9 3.5 7 7.8 7 12.5a7 7 0 0 1-14 0Z" fill="#E4572E"/></svg><h1>Quotelet Aperto</h1><p>Plain words in. Checked calculators out.</p><p class="m">Apertus writes words. Quotelet does the math.</p></div>`,
    '.c{height:100vh;margin:-44px -64px;display:grid;place-content:center;justify-items:center;gap:6px;text-align:center}.c h1{font-size:64px;margin:16px 0 4px}.c p{font-size:24px}.m{color:#7A7262;font-size:19px!important}'),
}
const waStub = (text: string) => page(`<p class="tag">wa.me link opened (demo stub, nothing sent)</p><div class="bubble">${esc(text).replace(/\n/g, '<br>')}</div>`,
  '.tag{font:600 14px/1 IS;letter-spacing:.08em;text-transform:uppercase;color:#7A7262;margin-bottom:22px}.bubble{max-width:620px;background:#DCF3E3;border-radius:16px 16px 16px 4px;padding:18px 22px;font-size:21px;box-shadow:0 8px 24px -12px rgba(0,0,0,.25)}')

async function demoRoutes(ctx: BrowserContext) {
  await ctx.route(`${BASE}/__demo/**`, (r) => {
    const u = new URL(r.request().url())
    const html = u.pathname === '/__demo/wa' ? waStub(u.searchParams.get('text') ?? '') : DEMO[u.pathname]
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html ?? 'not found' })
  })
  // The WhatsApp CTA opens wa.me; in the recording it lands on a local stub that prints the text
  // (same tab, same origin: routed redirects are not intercepted again, so no 302 trick).
  await ctx.route('https://wa.me/**', (r) => r.abort())
  await ctx.addInitScript((base: string) => {
    window.open = ((u: string) => {
      const url = new URL(u, location.href)
      window.location.assign(url.hostname === 'wa.me' ? `${base}/__demo/wa${url.search}` : url.href)
      return null
    }) as typeof window.open
    // Visible cursor for the recording (headless video has none).
    addEventListener('DOMContentLoaded', () => {
      const d = document.createElement('div')
      d.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(217,72,31,.35);border:2px solid #D9481F;z-index:2147483647;pointer-events:none;transition:transform .08s linear,width .15s,height .15s;transform:translate(-50px,-50px)'
      document.documentElement.appendChild(d)
      addEventListener('mousemove', (e) => { d.style.transform = `translate(${e.clientX}px,${e.clientY}px)` }, true)
      addEventListener('mousedown', () => { d.style.background = 'rgba(217,72,31,.7)' }, true)
      addEventListener('mouseup', () => { d.style.background = 'rgba(217,72,31,.35)' }, true)
    })
  }, BASE)
}

type Cue = [number, number, string]
const CUES: Cue[] = [
  [0.3, 8, 'Marco runs a one-person moving company in Lugano.'],
  [8, 16.5, 'Leads arrive at 21:00, in Italian and in German.'],
  [16.5, 24.8, 'He quotes by hand. Whoever answers first gets the job.'],
  [25, 31.5, 'Quotelet Aperto: he writes his prices in plain German.'],
  [31.5, 39, 'Apertus turns the text into a calculator config.'],
  [39, 47, 'The validator checks it: 4 fields, formula OK.'],
  [47, 56, 'Prices stay a checked formula in code. Apertus never does the math.'],
  [56, 64.8, 'Live preview in de-CH with CHF. Copy the link or the embed code.'],
  [65, 73, 'The customer opens the link. The config lives in the URL, nothing is stored.'],
  [73, 84, '20 m³, 3rd floor, no lift.'],
  [84, 94.8, 'A range with VAT, computed and formatted by Quotelet core.'],
  [95, 102, 'Message language: Italian. Apertus writes the words only.'],
  [102, 109, 'French, German: the amounts come from core, never from the model.'],
  [109, 114.8, 'WhatsApp gets the Italian text with the same amounts.'],
  [115, 121, 'Now a vague price list: "a bit more on Sundays".'],
  [121, 128, 'The validator rejects it. One repair try asks for a number.'],
  [128, 134.8, 'Still no number, so the errors are shown. No guessed prices.'],
  [135, 143, 'Public eval: 30 price lists, 4 languages, 8B vs 70B.'],
  [143, 151, 'Valid configs, quote match, latency and cost per calculator.'],
  [151, 159.8, 'These rows are a dry run of the harness. Real Apertus numbers come next.'],
  [160, 167.5, 'Open weights: self-host Apertus with vLLM or Ollama, same env vars.'],
  [167.5, 174.8, 'No database, no cookies. Price lists and quotes stay with you.'],
  [175, 178.3, 'Quotelet Aperto. Plain words in, checked calculators out.'],
]
const ts = (s: number) => { const ms = Math.round(s * 1000); const p = (n: number, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}` }
const srt = (cues: Cue[]) => cues.map(([a, b, t], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${t}\n`).join('\n')

// The box can stall under load, so the recording is not wall-clock scripted. Each beat records its
// [start, done] video time; sim/aperto-video.ts fits every beat into its slot (hold or fast-forward)
// and burns the captions, so the cues stay in sync whatever the machine speed.
type Beat = { slot: [number, number]; at: [number, number]; name: string }
const BEATS_FILE = `${RAW}.beats.json`

async function video() {
  const dir = '/tmp/quotelet-aperto-video'
  rmSync(dir, { recursive: true, force: true })
  const b = await launchBrowser()
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } }, permissions: ['clipboard-read', 'clipboard-write'] })
  ctx.setDefaultTimeout(600_000)
  await demoRoutes(ctx)
  const p = await ctx.newPage()
  const t0 = Date.now()
  const now = () => (Date.now() - t0) / 1000
  const beats: Beat[] = []
  const beat = async (name: string, from: number, to: number, fn: () => Promise<unknown>, dwell = 1200) => {
    const s = now()
    await fn()
    await p.waitForTimeout(dwell)
    beats.push({ name, slot: [from, to], at: [s, now()] })
    console.log(`beat ${name}: ${s.toFixed(1)}-${now().toFixed(1)}s -> slot ${from}-${to}`)
  }
  const hover = (id: string) => tid(p, id).hover().catch(() => {})
  const w = (id: string) => widget(p).locator(`[data-testid="${id}"]`)
  const mover = EXAMPLES.find((e) => e.id === MOVER)!.text
  try {
    await freshAperto(p)
    await p.waitForTimeout(500)
    await beat('intro', 0, 25, async () => { await p.mouse.move(640, 360); await p.waitForTimeout(1500); await hover('aperto-text'); await p.waitForTimeout(1500); await hover(`aperto-chip-${MOVER}`) }, 2500)
    await beat('type', 25, 31.5, async () => { await tid(p, 'aperto-text').click(); await tid(p, 'aperto-text').pressSequentially(mover, { delay: 25 }); await tid(p, 'aperto-lang-de').check() })
    await beat('validate', 31.5, 47, async () => { await tid(p, 'aperto-submit').click(); await p.locator('[data-testid="validator"][data-state="ok"]').waitFor(); await hover('validator-summary') }, 2500)
    await beat('preview', 47, 56, async () => { await preview(p).hover() }, 2000)
    await beat('share', 56, 65, async () => { await tid(p, 'aperto-copy-link').scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await tid(p, 'aperto-copy-link').click(); await p.waitForTimeout(900); await tid(p, 'aperto-copy-embed').click() })
    const link = await tid(p, 'aperto-share-link').inputValue()
    await beat('open-link', 65, 73, async () => { await p.goto(link); await w('ql-result-high').waitFor() })
    await beat('answers', 73, 84, async () => {
      await w('ql-field-volumen').click(); await w('ql-field-volumen').fill(''); await w('ql-field-volumen').pressSequentially('20', { delay: 200 })
      await p.waitForTimeout(500); await w('ql-field-etage_auszug').click(); await w('ql-field-etage_auszug').fill('3')
      await p.waitForTimeout(500); await w('ql-field-ohne_lift').check()
    })
    await beat('range', 84, 95, async () => { await w('ql-result-high').hover(); await p.waitForTimeout(1500); await tid(p, 'msg-lang-it').scrollIntoViewIfNeeded() })
    const ready = (l: string) => p.locator(`[data-testid="msg-preview"][data-lang="${l}"][data-status="ready"]`).waitFor()
    await beat('italian', 95, 102, async () => { await tid(p, 'msg-lang-it').check(); await ready('it') }, 2000)
    await beat('fr-de', 102, 109, async () => { await tid(p, 'msg-lang-fr').check(); await ready('fr'); await p.waitForTimeout(1500); await tid(p, 'msg-lang-de').check(); await ready('de'); await p.waitForTimeout(1500); await tid(p, 'msg-lang-it').check(); await ready('it') })
    await beat('whatsapp', 109, 115, async () => {
      await w('ql-name').scrollIntoViewIfNeeded(); await w('ql-name').click(); await w('ql-name').pressSequentially('Giulia', { delay: 80 })
      await w('ql-cta-whatsapp').click(); await p.waitForURL(/__demo\/wa/)
    }, 2000)
    await beat('broken-input', 115, 121, async () => {
      await p.goto(`${BASE}/aperto`); await tid(p, 'aperto-text').waitFor(); await tid(p, 'aperto-text').fill('')
      await tid(p, 'aperto-text').pressSequentially(BROKEN, { delay: 30 }); await tid(p, 'aperto-lang-en').check()
    })
    await beat('rejected', 121, 135, async () => { await tid(p, 'aperto-submit').click(); await p.locator('[data-testid="validator"][data-state="error"]').waitFor(); await hover('validator-errors') }, 2500)
    await beat('eval', 135, 160, () => p.goto(`${BASE}/__demo/eval`), 3000)
    await beat('selfhost', 160, 175, () => p.goto(`${BASE}/__demo/selfhost`), 3000)
    await beat('close', 175, 178.5, () => p.goto(`${BASE}/__demo/close`), 2500)
  } catch (e) {
    console.error(`demo step failed at ${now().toFixed(1)}s:`, e)
    throw e
  } finally {
    const v = p.video()
    await ctx.close().catch(() => {})
    if (v) renameSync(await v.path(), RAW)
    await b.close()
  }
  writeFileSync(BEATS_FILE, JSON.stringify(beats, null, 2))
  writeFileSync(join(OUT, 'aperto-demo.srt'), srt(CUES))
  console.log(`video: ${RAW}, beats: ${BEATS_FILE}, captions: ${OUT}/aperto-demo.srt (${CUES.length} cues)`)
}

const mode = process.argv[2] ?? 'all'
if (mode === 'shots' || mode === 'all') await shots()
if (mode === 'video' || mode === 'all') await video()
