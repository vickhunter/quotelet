// UI/UX steps for @D-004b. Needs the built site: `bun run build && APERTUS_MOCK=1 bun run serve`.
import { After, AfterAll, Then, When } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from 'playwright'
import assert from 'node:assert/strict'
import { launchBrowser } from '../../sim/lib.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
// A different origin on loopback stands in for a customer's website.
const THIRD_PARTY = 'http://shop.localhost:5999'

type World = { ctx?: BrowserContext; page?: Page; snippet?: string; posts: string[]; violations: string[] }

let shared: Browser | undefined
const browser = async () => (shared ??= await launchBrowser())

async function page(w: World) {
  if (w.page) return w.page
  w.posts ??= []
  w.violations ??= []
  w.ctx = await (await browser()).newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  // Never hit the real waitlist: fake a FormSubmit success and keep the body.
  await w.ctx.route('https://formsubmit.co/**', async (r) => {
    w.posts.push(r.request().postData() ?? '')
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}', headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  w.page = await w.ctx.newPage()
  w.page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) w.violations.push(m.text()) })
  await w.page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to (CSP) ${e.violatedDirective} ${e.blockedURI}`))
  })
  return w.page
}

After({ tags: '@D-004b' }, async function (this: World) { await this.ctx?.close() })
AfterAll(async () => { await shared?.close(); shared = undefined })

async function get(path: string, init?: RequestInit) { return fetch(BASE + path, { redirect: 'manual', ...init }) }

When('a developer reads the snippet on the landing page', async function (this: World) {
  const p = await page(this)
  await p.goto(BASE + '/')
  const code = p.locator('#developers pre code').first()
  await code.waitFor()
  this.snippet = (await code.textContent()) ?? ''
  assert.match(this.snippet, /data-quotelet/)
})

Then('every URL in the snippet answers 200', async function (this: World) {
  const urls = [...(this.snippet ?? '').matchAll(/(?:src|data-config-url)="([^"]+)"/g)].map((m) => m[1])
  assert.ok(urls.length >= 2, `urls: ${urls}`)
  for (const u of urls) {
    const res = await fetch(new URL(u, BASE))
    assert.equal(res.status, 200, `${u} -> ${res.status}`)
  }
})

Then('the snippet pasted on a third-party page shows a working calculator', async function (this: World) {
  const p = await page(this)
  await this.ctx!.route(`${THIRD_PARTY}/**`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body><h1>Rossi shop</h1>${this.snippet}</body></html>` }))
  await p.goto(`${THIRD_PARTY}/preventivo.html`)
  await p.locator('[data-quotelet] >> [data-testid="ql-result-high"]').waitFor({ timeout: 10000 })
  assert.match((await p.locator('[data-quotelet] >> [data-testid="ql-result-high"]').textContent()) ?? '', /\d/)
})

Then('{string} answers 404 with the not-found page', async function (this: World, path: string) {
  const res = await get(path)
  assert.equal(res.status, 404)
  assert.match(await res.text(), /Page not found|Pagina non trovata/)
})

Then('{string} answers 200 as {string} containing {string}', async function (this: World, path: string, type: string, text: string) {
  const res = await get(path)
  assert.equal(res.status, 200, `${path} -> ${res.status}`)
  assert.match(res.headers.get('content-type') ?? '', new RegExp(type.replace('/', '\\/')))
  assert.ok((await res.text()).includes(text), `${path} lacks ${text}`)
})

Then('the app routes {string}, {string}, {string}, {string}, {string} answer 200', async function (this: World, ...paths: string[]) {
  for (const p of paths) {
    const res = await get(p)
    assert.equal(res.status, 200, `${p} -> ${res.status}`)
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
  }
})

Then("{string} carries a CSP with frame-ancestors 'none', nosniff and strict-origin-when-cross-origin", async function (this: World, path: string) {
  const res = await get(path)
  assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
})

Then('{string} and {string} carry no CSP and no frame-ancestors', async function (this: World, a: string, b: string) {
  for (const path of [a, b]) {
    const res = await get(path)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-security-policy'), null, `${path} has a CSP`)
    assert.equal(res.headers.get('x-frame-options'), null, `${path} has X-Frame-Options`)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  }
})

Then('the pages {string}, {string}, {string}, {string} load without CSP violations', async function (this: World, ...paths: string[]) {
  const p = await page(this)
  for (const path of paths) {
    await p.goto(BASE + path)
    await p.locator('h1').first().waitFor()
    await p.locator('[data-quotelet], [data-testid="preview"], [data-testid="aperto-text"], .hero').first().waitFor()
    await p.waitForTimeout(400)
  }
  // /aperto: one real round trip to /api/aperto (connect-src 'self').
  await p.goto(BASE + '/aperto')
  await p.locator('[data-testid="aperto-chip-mover-lugano"]').click()
  await p.locator('[data-testid="aperto-submit"]').click()
  await p.locator('[data-testid="validator"][data-state="ok"]').waitFor({ timeout: 15000 })
  await p.locator('[data-testid="aperto-preview"] >> [data-testid="ql-result-high"]').waitFor()
  assert.deepEqual(this.violations, [])
})

Then('a share link from the builder opens without CSP violations', async function (this: World) {
  const p = await page(this)
  await p.goto(BASE + '/build?template=imbianchino-it')
  await p.locator('[data-testid="business-whatsapp"]').fill('+39 333 123 4567')
  await p.locator('[data-testid="copy-link"]').click()
  const link = await p.evaluate(() => navigator.clipboard.readText())
  await p.goto(link)
  await p.locator('[data-testid="share-widget"] >> [data-testid="ql-result-high"]').waitFor()
  await p.locator('[data-testid="msg-lang-it"]').check()
  await p.locator('[data-testid="msg-preview"][data-status="ready"]').waitFor({ timeout: 15000 })
  assert.deepEqual(this.violations, [])
})

async function joinWaitlist(p: Page) {
  const form = p.locator('form[data-testid="waitlist"]').first()
  await form.scrollIntoViewIfNeeded()
  await form.locator('input[type="email"]').fill('marco@pitture.it')
  await form.locator('button[type="submit"]').click()
  await p.locator('[data-testid="waitlist-success"]').first().waitFor()
}

Then('the landing waitlist still submits under the CSP', async function (this: World) {
  const p = await page(this)
  await p.goto(BASE + '/')
  await joinWaitlist(p)
  assert.equal(this.posts.length, 1)
  assert.deepEqual(this.violations, [])
})

When('a visitor opens {string} and joins the waitlist', async function (this: World, path: string) {
  const p = await page(this)
  this.posts.length = 0
  await p.goto(BASE + path)
  const ref = p.locator('form[data-testid="waitlist"] input[type="hidden"][name="ref"]').first()
  await ref.waitFor({ state: 'attached' })
  ;(this as any).refValue = await ref.inputValue()
  await joinWaitlist(p)
})

Then('the hidden ref field holds {string} and the signup carries ref {string}', async function (this: World, a: string, b: string) {
  assert.equal((this as any).refValue, a)
  assert.equal(this.posts.length, 1)
  assert.equal(JSON.parse(this.posts[0]).ref, b)
})
