// D-004 persona simulations (design section 13): 1 Giulia on the real /q page, 2 Marco through /build.
// Run: `bun run build && bun run serve` in one shell, then `bun run sim:d004`. Logs to proof/sim-<date>.log.
import { chromium, type Browser, type Page, type Request } from 'playwright'
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { computeQuote, defaultAnswers, buildWhatsAppUrl, validateConfig } from '@quotelet/core'
import { setField, base64url } from './lib.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const ORIGIN = new URL(BASE).origin
const day = new Date().toISOString().slice(0, 10)
mkdirSync('proof', { recursive: true })
const LOG = `proof/sim-${day}.log`
const log = (line: string) => {
  const l = `${new Date().toISOString()} [d004] ${line}`
  console.log(l)
  appendFileSync(LOG, l + '\n')
}

type Watch = { foreign: string[]; nonGet: string[]; consoleErrors: string[] }
function watch(page: Page): Watch {
  const w: Watch = { foreign: [], nonGet: [], consoleErrors: [] }
  page.on('request', (r: Request) => {
    const u = r.url()
    if (u.startsWith('data:') || u.startsWith('blob:')) return
    if (new URL(u).origin !== ORIGIN && !u.startsWith('https://wa.me/')) w.foreign.push(u)
    if (r.method() !== 'GET') w.nonGet.push(`${r.method()} ${u}`)
  })
  page.on('console', (m) => m.type() === 'error' && w.consoleErrors.push(m.text()))
  page.on('pageerror', (e) => w.consoleErrors.push(String(e)))
  return w
}

const fixture = JSON.parse(readFileSync('fixtures/config-imbianchino.json', 'utf8'))
const checked = validateConfig(fixture)
if (!checked.ok) throw new Error('fixture config-imbianchino.json is invalid: ' + JSON.stringify(checked.errors))
const config = checked.config

// Giulia: open a share link → 75 m² → colore → name → WhatsApp. Returns failures.
async function giulia(browser: Browser, link: string, cfg: typeof config, label: string) {
  const fails: string[] = []
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const w = watch(page)
  let waUrl = ''
  await ctx.route('https://wa.me/**', (r) => {
    waUrl = r.request().url()
    return r.abort()
  })
  let actions = 0
  const root = page.locator('[data-testid="share-widget"]')
  await page.goto(link); actions++
  await root.locator('[data-testid="ql-result-high"]').waitFor()
  await setField(root, 'mq', 75); actions++
  await setField(root, 'colore', { index: 1 }); actions++
  await root.locator('[data-testid="ql-name"]').fill('Giulia'); actions++
  const cta = root.locator('[data-testid="ql-cta-whatsapp"]')
  const href = await cta.getAttribute('href')
  await cta.click(); actions++
  await page.waitForTimeout(300)
  waUrl ||= href ?? ''

  const answers = { ...defaultAnswers(cfg), mq: 75, colore: 1 }
  const q = computeQuote(cfg, answers)
  const low = await root.locator('[data-testid="ql-result-low"]').textContent()
  const high = await root.locator('[data-testid="ql-result-high"]').textContent()
  if (!low?.includes(q.display.low) && !low?.includes(q.display.lowGross)) fails.push(`low "${low}" ≠ core ${q.display.low}/${q.display.lowGross}`)
  if (!high?.includes(q.display.high) && !high?.includes(q.display.highGross)) fails.push(`high "${high}" ≠ core ${q.display.high}/${q.display.highGross}`)
  const expected = buildWhatsAppUrl(cfg, q, { name: 'Giulia' })
  if (waUrl !== expected) fails.push(`wa.me mismatch\n  got ${waUrl}\n  exp ${expected}`)
  if (w.foreign.length) fails.push(`third-party requests: ${w.foreign.join(', ')}`)
  if (w.nonGet.length) fails.push(`non-GET requests: ${w.nonGet.join(', ')}`)
  if (w.consoleErrors.length) fails.push(`console errors: ${w.consoleErrors.join(' | ')}`)
  if (actions > 8) fails.push(`${actions} actions > 8`)
  await page.screenshot({ path: `proof/sim-${label}-375.png`, fullPage: true })
  await ctx.close()
  log(`${label}: actions=${actions} low="${low}" high="${high}" ${fails.length ? 'FAIL' : 'PASS'}`)
  return fails
}

async function marco(browser: Browser) {
  const fails: string[] = []
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const w = watch(page)
  await page.goto(`${BASE}/build`)
  await page.locator('[data-testid="template-imbianchino-it"]').click()
  await page.locator('[data-testid="business-name"]').fill('Marco Pitture')
  await page.locator('[data-testid="business-whatsapp"]').fill('+39 347 765 4321')
  await page.locator('[data-testid="option-value"][data-option-label="Bianco"]').fill('7')
  await page.waitForTimeout(400)
  // Draft must survive a reload.
  await page.reload()
  const nameAfter = await page.locator('[data-testid="business-name"]').inputValue()
  if (nameAfter !== 'Marco Pitture') fails.push(`draft lost on reload (name="${nameAfter}")`)
  const priceAfter = await page.locator('[data-testid="option-value"][data-option-label="Bianco"]').inputValue()
  if (priceAfter !== '7') fails.push(`draft lost price on reload ("${priceAfter}")`)
  await page.locator('[data-testid="copy-link"]').click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  if (!/\/q#c=[A-Za-z0-9_-]+$/.test(link)) fails.push(`bad share link ${link}`)
  if (w.consoleErrors.length) fails.push(`console errors on /build: ${w.consoleErrors.join(' | ')}`)
  if (w.foreign.length) fails.push(`third-party requests on /build: ${w.foreign.join(', ')}`)
  await page.screenshot({ path: 'proof/sim-marco-build-390.png', fullPage: true })
  await ctx.close()
  log(`marco: link=${link.slice(0, 60)}… ${fails.length ? 'FAIL' : 'PASS'}`)
  if (fails.length) return fails

  // Run Giulia's steps on Marco's link, against Marco's own config.
  const enc = new URL(link).hash.replace('#c=', '')
  const marcoCfg = JSON.parse(Buffer.from(enc, 'base64url').toString('utf8'))
  if (marcoCfg.business?.whatsapp !== '393477654321') fails.push(`whatsapp in link = ${marcoCfg.business?.whatsapp}`)
  return fails.concat(await giulia(browser, link.replace(/^https?:\/\/[^/]+/, BASE), marcoCfg, 'giulia-on-marco-link'))
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results: Record<string, string[]> = {}
try {
  results['1 Giulia /q'] = await giulia(browser, `${BASE}/q#c=${base64url(fixture)}`, config, 'giulia-q')
  results['2 Marco /build'] = await marco(browser)
} catch (e) {
  results['crash'] = [String(e)]
} finally {
  await browser.close()
}
let failed = 0
for (const [name, fails] of Object.entries(results)) {
  if (fails.length) failed++
  log(`${fails.length ? 'FAIL' : 'PASS'} persona ${name}${fails.length ? '\n  - ' + fails.join('\n  - ') : ''}`)
}
log(`sim:d004 ${failed ? `FAILED (${failed})` : 'PASSED'}`)
process.exit(failed ? 1 : 0)
