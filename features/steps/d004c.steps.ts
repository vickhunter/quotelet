// UI/UX steps for @D-004c (Italian /build and the IT share page). Owner: UI/UX.
// Needs the built site: `bun run build && APERTUS_MOCK=1 bun run serve`.
import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from 'playwright'
import assert from 'node:assert/strict'
import { getTemplate } from '../../packages/core/src/index.ts'
import { launchBrowser } from '../../sim/lib.ts'
import { englishIn, collectUiText } from '../../sim/noEnglish.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'

type World = {
  viewport?: { width: number; height: number }
  painter?: { ctx: BrowserContext; page: Page }
  customer?: { ctx: BrowserContext; page: Page }
  shareLink?: string
}

let shared: Browser | undefined
const browser = async () => (shared ??= await launchBrowser())
const tid = (p: Page, id: string) => p.locator(`[data-testid="${id}"]`)

async function painter(w: World) {
  if (w.painter) return w.painter.page
  const ctx = await (await browser()).newContext({
    viewport: w.viewport ?? { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    locale: 'it-IT',
  })
  w.painter = { ctx, page: await ctx.newPage() }
  return w.painter.page
}

async function assertNoEnglish(p: Page, where: string) {
  const items = await collectUiText(p)
  const hits = englishIn(items)
  assert.deepEqual(hits, [], `English on ${where}:\n${hits.map((h) => `  "${h.word}" in ${h.source}: ${h.text}`).join('\n')}`)
}

After({ tags: '@D-004c' }, async function (this: World) {
  await this.painter?.ctx.close()
  await this.customer?.ctx.close()
})
AfterAll(async () => { await shared?.close(); shared = undefined })

Given('the painter uses a {int}x{int} screen', function (this: World, width: number, height: number) {
  this.viewport = { width, height }
})

When('the painter opens {string}', async function (this: World, path: string) {
  const p = await painter(this)
  await p.goto(BASE + path)
  await p.locator('h1').waitFor()
})

When('the painter reopens {string} without parameters', async function (this: World, path: string) {
  const p = await painter(this)
  await p.goto(BASE + path)
  await p.locator('h1').waitFor()
  await p.waitForTimeout(150)
})

Then('the builder is in Italian with no English text', async function (this: World) {
  const p = await painter(this)
  assert.equal(await p.locator('h1').textContent(), 'Crea il tuo calcolatore')
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'it')
  await assertNoEnglish(p, '/build (IT)')
})

Then('the painter sees no English text', async function (this: World) {
  await assertNoEnglish(await painter(this), '/build (IT)')
})

When('the painter types the WhatsApp number {string}', async function (this: World, wa: string) {
  await tid(await painter(this), 'business-whatsapp').fill(wa)
})

Then('the WhatsApp error reads {string}', async function (this: World, text: string) {
  const err = tid(await painter(this), 'whatsapp-error')
  await err.waitFor()
  assert.match((await err.textContent()) ?? '', new RegExp(text))
})

When('the painter writes the formula {string}', async function (this: World, src: string) {
  await tid(await painter(this), 'formula').fill(src)
})

Then('the formula error reads {string} and names {string}', async function (this: World, text: string, name: string) {
  const err = tid(await painter(this), 'formula-error')
  await err.waitFor()
  const got = (await err.textContent()) ?? ''
  assert.match(got, new RegExp(text))
  assert.match(got, new RegExp(name))
  assert.match(got, /posizione \d+/)
})

Then('the painter cannot copy the share link yet', async function (this: World) {
  const p = await painter(this)
  assert.equal(await tid(p, 'copy-link').isDisabled(), true)
  await tid(p, 'share-blockers').waitFor()
})

When('the painter restores the template formula', async function (this: World) {
  await tid(await painter(this), 'formula').fill(getTemplate('imbianchino-it')!.formula)
})

When('the painter enters business {string} and WhatsApp {string}', async function (this: World, name: string, wa: string) {
  const p = await painter(this)
  await tid(p, 'business-name').fill(name)
  await tid(p, 'business-whatsapp').fill(wa)
})

Then('the painter copies a working share link', async function (this: World) {
  const p = await painter(this)
  await tid(p, 'copy-link').click()
  this.shareLink = await p.evaluate(() => navigator.clipboard.readText())
  assert.match(this.shareLink, /\/q#c=[A-Za-z0-9_-]+$/)
  assert.equal(await tid(p, 'copy-link').textContent(), 'Copiato')
})

When("a customer opens the painter's share link on a {int}x{int} screen", async function (this: World, width: number, height: number) {
  assert.ok(this.shareLink, 'no share link captured')
  const ctx = await (await browser()).newContext({ viewport: { width, height } })
  this.customer = { ctx, page: await ctx.newPage() }
  await this.customer.page.goto(this.shareLink.replace(/^https?:\/\/[^/]+/, BASE))
  await this.customer.page.locator('[data-testid="share-widget"] [data-testid="ql-result-high"]').waitFor()
})

Then('the share page is in Italian with no English text', async function (this: World) {
  assert.ok(this.customer)
  const p = this.customer.page
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'it')
  await assertNoEnglish(p, '/q (IT)')
})

Then('only Italian templates are offered', async function (this: World) {
  const p = await painter(this)
  const ids = await p.locator('[data-testid^="template-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
  assert.ok(ids.length >= 3, `templates: ${ids}`)
  assert.deepEqual(ids.filter((id) => !id?.endsWith('-it')), [])
})

When('the painter picks the template {string}', async function (this: World, tpl: string) {
  const p = await painter(this)
  await tid(p, `template-${tpl}`).click()
  await tid(p, 'preview').locator('[data-testid="ql-result-high"]').waitFor()
})

When('the painter switches the builder to {string}', async function (this: World, lang: string) {
  const p = await painter(this)
  await tid(p, `ui-lang-${lang}`).check()
  await p.waitForFunction((l) => document.documentElement.lang === l, lang)
  assert.match(p.url(), new RegExp(`lang=${lang}`))
})

Then('the builder heading reads {string}', async function (this: World, text: string) {
  const p = await painter(this)
  assert.equal(await p.locator('h1').textContent(), text)
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'en')
})
