// UI/UX steps for the @D-004 scenarios (landing, /build, /q). Owner: UI/UX.
// Runs against the local static build: `bun run build && bun run serve` (127.0.0.1:4173).
import { Before, After, AfterAll, Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber'
import { type Browser, type BrowserContext, type Page, } from 'playwright'
import assert from 'node:assert/strict'
import { launchBrowser } from '../../sim/lib.ts'

setDefaultTimeout(30_000)

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const WAITLIST_HOST = 'https://formsubmit.co/**'

type World = {
  browser?: Browser
  context?: BrowserContext
  page?: Page
  viewport?: { width: number; height: number }
  previewHighBefore?: string
  shareLink?: string
  embedSnippet?: string
  waitlistPosts: string[]
}

let sharedBrowser: Browser | undefined
async function browser() {
  sharedBrowser ??= await launchBrowser()
  return sharedBrowser
}

async function page(w: World) {
  if (w.page) return w.page
  w.context = await (await browser()).newContext({
    viewport: w.viewport ?? { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  w.waitlistPosts = []
  // Never hit the real waitlist from tests: fake a FormSubmit success.
  await w.context.route(WAITLIST_HOST, async (route) => {
    w.waitlistPosts.push(route.request().postData() ?? '')
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' })
  })
  w.page = await w.context.newPage()
  return w.page
}

const preview = (p: Page) => p.locator('[data-testid="preview"]')

Before({ tags: '@D-004' }, function (this: World) {
  this.waitlistPosts = []
})

After({ tags: '@D-004' }, async function (this: World) {
  await this.context?.close()
})

AfterAll(async () => {
  await sharedBrowser?.close()
})

Given('a {int}x{int} viewport', function (this: World, width: number, height: number) {
  this.viewport = { width, height }
})

Given('I open {string}', async function (this: World, path: string) {
  const p = await page(this)
  await p.goto(BASE + path)
})

Given('I open {string} with template {string}', async function (this: World, path: string, tpl: string) {
  const p = await page(this)
  await p.goto(`${BASE}${path}?template=${encodeURIComponent(tpl)}`)
  await p.locator('[data-testid="formula"]').waitFor()
})

When('I pick the template {string}', async function (this: World, tpl: string) {
  const p = await page(this)
  await p.locator(`[data-testid="template-${tpl}"]`).click()
  await preview(p).locator('[data-testid="ql-result-high"]').waitFor()
})

When(
  'I set the business name to {string} and WhatsApp to {string}',
  async function (this: World, name: string, wa: string) {
    const p = await page(this)
    await p.locator('[data-testid="business-name"]').fill(name)
    await p.locator('[data-testid="business-whatsapp"]').fill(wa)
  },
)

When('I change the {string} price to {int}', async function (this: World, label: string, value: number) {
  const p = await page(this)
  const high = preview(p).locator('[data-testid="ql-result-high"]')
  this.previewHighBefore = (await high.textContent()) ?? ''
  await p.locator(`[data-testid="option-value"][data-option-label="${label}"]`).fill(String(value))
})

Then('the live preview high amount updates', async function (this: World) {
  const p = await page(this)
  const high = preview(p).locator('[data-testid="ql-result-high"]')
  const t0 = Date.now()
  let now = await high.textContent()
  while (now === this.previewHighBefore && Date.now() - t0 < 3000) {
    await p.waitForTimeout(50)
    now = await high.textContent()
  }
  assert.notEqual(now, this.previewHighBefore, 'preview high amount did not change')
})

Then('I can copy a share link and an embed snippet', async function (this: World) {
  const p = await page(this)
  await p.locator('[data-testid="copy-link"]').click()
  this.shareLink = await p.evaluate(() => navigator.clipboard.readText())
  assert.match(this.shareLink, /\/q#c=[A-Za-z0-9_-]+$/)
  await p.locator('[data-testid="copy-embed"]').click()
  this.embedSnippet = await p.evaluate(() => navigator.clipboard.readText())
  assert.match(this.embedSnippet, /data-quotelet/)
  assert.match(this.embedSnippet, /quotelet\.js/)
})

Then(
  'opening the share link in a fresh browser shows the same calculator with WhatsApp {string}',
  async function (this: World, digits: string) {
    assert.ok(this.shareLink, 'no share link captured')
    const ctx = await (await browser()).newContext()
    try {
      let waUrl = ''
      await ctx.route('https://wa.me/**', (r) => {
        waUrl = r.request().url()
        return r.abort()
      })
      const fresh = await ctx.newPage()
      await fresh.goto(this.shareLink.replace(/^https?:\/\/[^/]+/, BASE))
      const root = fresh.locator('[data-testid="share-widget"]')
      await root.locator('[data-testid="ql-result-high"]').waitFor()
      assert.equal(
        await root.locator('[data-testid="ql-result-high"]').textContent(),
        await preview(this.page!).locator('[data-testid="ql-result-high"]').textContent(),
      )
      await root.locator('[data-testid="ql-name"]').fill('Giulia')
      const href = await root.locator('[data-testid="ql-cta-whatsapp"]').getAttribute('href')
      if (href) waUrl = href
      else {
        await root.locator('[data-testid="ql-cta-whatsapp"]').click()
        await fresh.waitForTimeout(500)
      }
      assert.ok(waUrl.startsWith(`https://wa.me/${digits}?text=`), `got ${waUrl}`)
    } finally {
      await ctx.close()
    }
  },
)

When('I type the formula {string}', async function (this: World, src: string) {
  const p = await page(this)
  await p.locator('[data-testid="formula"]').fill(src)
})

Then('I see an error naming {string}', async function (this: World, name: string) {
  const p = await page(this)
  const err = p.locator('[data-testid="formula-error"]')
  await err.waitFor()
  assert.match((await err.textContent()) ?? '', new RegExp(name))
})

Then('the share link button is disabled', async function (this: World) {
  const p = await page(this)
  assert.equal(await p.locator('[data-testid="copy-link"]').isDisabled(), true)
})

Then('the calculator shows a range without horizontal scrolling', async function (this: World) {
  const p = await page(this)
  const root = p.locator('[data-testid="consumer-widget"]')
  await root.locator('[data-testid="ql-result-low"]').waitFor()
  await root.locator('[data-testid="ql-result-high"]').waitFor()
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`)
})

Then('the {string} box links to {string}', async function (this: World, heading: string, href: string) {
  const p = await page(this)
  const box = p.locator('[data-testid="pro-box"]')
  assert.match((await box.textContent()) ?? '', new RegExp(heading.replace('?', '\\?')))
  assert.equal(await box.locator('a[data-testid="pro-box-cta"]').getAttribute('href'), href)
})

Then('the waitlist form accepts an email', async function (this: World) {
  const p = await page(this)
  const form = p.locator('[data-testid="waitlist"]')
  await form.locator('input[type=email]').fill('test+bdd@example.com')
  await form.locator('button[type=submit]').click()
  await form.locator('[data-testid="waitlist-success"]').waitFor()
  assert.equal(this.waitlistPosts.length, 1)
  assert.match(this.waitlistPosts[0], /test\+bdd@example\.com/)
})

