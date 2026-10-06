// UI/UX steps for @aperto (/aperto page and the /q message-language toggle). Owner: UI/UX.
// Needs the built site with /api/aperto in mock mode: `bun run build && APERTUS_MOCK=1 bun run serve`.
import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Locator, Page } from 'playwright'
import assert from 'node:assert/strict'
import { launchBrowser, setField } from '../../sim/lib.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const nb = (s: string | null | undefined) => (s ?? '').replace(/[\u00a0\u202f\u2007]/g, ' ').trim()

type World = {
  owner?: { ctx: BrowserContext; page: Page }
  customer?: { ctx: BrowserContext; page: Page }
  shareLink?: string
}

let shared: Browser | undefined
const browser = async () => (shared ??= await launchBrowser())

async function open(viewport = { width: 1440, height: 900 }) {
  const ctx = await (await browser()).newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] })
  return { ctx, page: await ctx.newPage() }
}
const owner = (w: World) => { assert.ok(w.owner, 'owner page not open'); return w.owner.page }
const customer = (w: World) => { assert.ok(w.customer, 'customer page not open'); return w.customer.page }
const tid = (p: Page | Locator, id: string) => p.locator(`[data-testid="${id}"]`)
const widget = (w: World) => tid(customer(w), 'share-widget')

After({ tags: '@aperto' }, async function (this: World) {
  await this.owner?.ctx.close()
  await this.customer?.ctx.close()
})
AfterAll(async () => { await shared?.close(); shared = undefined })

async function openAperto(w: World, viewport?: { width: number; height: number }) {
  w.owner = await open(viewport)
  await w.owner.page.goto(`${BASE}/aperto`)
  await w.owner.page.evaluate(() => localStorage.removeItem('quotelet:aperto-draft'))
  await w.owner.page.reload()
  await tid(w.owner.page, 'aperto-text').waitFor()
}

Given('the owner opens the Aperto page', async function (this: World) { await openAperto(this) })
Given('the owner opens the Aperto page on a {int}x{int} screen', async function (this: World, width: number, height: number) {
  await openAperto(this, { width, height })
})

When('the owner picks the {string} example', async function (this: World, id: string) {
  const p = owner(this)
  await tid(p, `aperto-chip-${id}`).click()
  assert.match(await tid(p, 'aperto-text').inputValue(), /\S/)
})

When('the owner types {string} in {string}', async function (this: World, text: string, lang: string) {
  const p = owner(this)
  await tid(p, 'aperto-text').fill(text)
  await tid(p, `aperto-lang-${lang}`).check()
})

When('the owner asks for a calculator', async function (this: World) {
  const p = owner(this)
  await tid(p, 'aperto-submit').click()
  await p.locator('[data-testid="validator"][data-state="ok"], [data-testid="validator"][data-state="error"]').waitFor({ timeout: 25_000 })
})

When('the owner reloads the page', async function (this: World) {
  const p = owner(this)
  await p.reload()
  await tid(p, 'aperto-text').waitFor()
})

Then('the validator shows {string}', async function (this: World, summary: string) {
  const v = tid(owner(this), 'validator')
  assert.equal(await v.getAttribute('data-state'), 'ok', `validator: ${await v.textContent()}`)
  assert.equal(nb(await tid(v, 'validator-summary').textContent()), summary)
})

Then('the live preview shows a price range in {string}', async function (this: World, currency: string) {
  const prev = tid(owner(this), 'aperto-preview')
  await tid(prev, 'ql-result-high').waitFor()
  assert.match(nb(await tid(prev, 'ql-result-low').textContent()), new RegExp(currency))
  assert.match(nb(await tid(prev, 'ql-result-high').textContent()), new RegExp(currency))
})

Then('the owner can copy a share link and an embed snippet', async function (this: World) {
  const p = owner(this)
  await tid(p, 'aperto-copy-link').click()
  this.shareLink = await p.evaluate(() => navigator.clipboard.readText())
  assert.match(this.shareLink, /\/q#c=[A-Za-z0-9_-]+$/)
  assert.equal(await tid(p, 'aperto-share-link').inputValue(), this.shareLink)
  await tid(p, 'aperto-copy-embed').click()
  const snippet = await p.evaluate(() => navigator.clipboard.readText())
  assert.match(snippet, /data-quotelet/)
  assert.match(snippet, /quotelet\.js/)
})

When('the customer opens the share link on a phone', async function (this: World) {
  assert.ok(this.shareLink, 'no share link captured')
  this.customer = await open({ width: 375, height: 812 })
  await this.customer.page.goto(this.shareLink.replace(/^https?:\/\/[^/]+/, BASE))
  await tid(widget(this), 'ql-result-high').waitFor()
})

When('the customer sets {string}', async function (this: World, spec: string) {
  for (const pair of spec.split(',').map((s) => s.trim())) {
    const [id, raw] = pair.split('=')
    await setField(widget(this), id, raw === 'true' ? true : raw === 'false' ? false : Number(raw))
  }
})

Then('the customer sees a range from {int} to {int} cents with VAT', async function (this: World, low: number, high: number) {
  const root = widget(this)
  const t0 = Date.now()
  while (Date.now() - t0 < 3000 && (await tid(root, 'ql-result-low').getAttribute('data-cents')) !== String(low)) await customer(this).waitForTimeout(50)
  assert.equal(await tid(root, 'ql-result-low').getAttribute('data-cents'), String(low))
  assert.equal(await tid(root, 'ql-result-high').getAttribute('data-cents'), String(high))
  assert.match(nb(await tid(root, 'ql-vat-note').textContent()), /8[.,]1/)
  const overflow = await customer(this).evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `/q overflows by ${overflow}px`)
})

When('the customer switches the message language to {string}', async function (this: World, lang: string) {
  const p = customer(this)
  await tid(p, `msg-lang-${lang}`).check()
  await p.locator(`[data-testid="msg-preview"][data-lang="${lang}"][data-status="ready"]`).waitFor({ timeout: 25_000 })
})

Then("the message preview is the Italian text with the calculator's amounts", async function (this: World) {
  const p = customer(this)
  const text = nb(await tid(p, 'msg-preview').textContent())
  const low = nb(await tid(widget(this), 'ql-result-low').textContent())
  const high = nb(await tid(widget(this), 'ql-result-high').textContent())
  assert.ok(text.includes(low) && text.includes(high), `preview "${text}" lacks ${low} / ${high}`)
  assert.match(text, /IVA/)
})

Then('the WhatsApp link carries the same amounts as the calculator', async function (this: World) {
  const { ctx, page: p } = this.customer!
  let waUrl = ''
  await ctx.route('https://wa.me/**', (r) => { waUrl = r.request().url(); return r.abort() })
  const root = widget(this)
  await tid(root, 'ql-name').fill('Giulia')
  await tid(root, 'ql-cta-whatsapp').click()
  const t0 = Date.now()
  while (!waUrl && Date.now() - t0 < 5000) await p.waitForTimeout(50)
  assert.ok(waUrl.startsWith('https://wa.me/'), `no WhatsApp navigation (got "${waUrl}")`)
  const text = nb(new URL(waUrl).searchParams.get('text'))
  const low = nb(await tid(root, 'ql-result-low').textContent())
  const high = nb(await tid(root, 'ql-result-high').textContent())
  assert.ok(text.includes(low), `WhatsApp text lacks ${low}: ${text}`)
  assert.ok(text.includes(high), `WhatsApp text lacks ${high}: ${text}`)
  assert.ok(text.startsWith(nb(await tid(p, 'msg-preview').textContent())), 'WhatsApp text is not the Italian message')
  assert.match(text, /Giulia/)
})

Then('the validator shows errors', async function (this: World) {
  const v = tid(owner(this), 'validator')
  assert.equal(await v.getAttribute('data-state'), 'error')
  assert.ok((await tid(v, 'validator-errors').locator('li').count()) >= 1)
})

Then('one error asks for a concrete number', async function (this: World) {
  const items = await tid(owner(this), 'validator-errors').locator('li').allTextContents()
  assert.ok(items.some((t) => /number/i.test(t)), `errors: ${items.join(' | ')}`)
})

Then('no share link is offered', async function (this: World) {
  const p = owner(this)
  assert.equal(await tid(p, 'aperto-share-link').count(), 0)
  assert.equal(await tid(p, 'aperto-preview').count(), 0)
})

Then('the draft {string} and language {string} are still there', async function (this: World, text: string, lang: string) {
  const p = owner(this)
  assert.equal(await tid(p, 'aperto-text').inputValue(), text)
  assert.equal(await tid(p, `aperto-lang-${lang}`).isChecked(), true)
})

Then('the page has no horizontal overflow', async function (this: World) {
  const overflow = await owner(this).evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`)
})
