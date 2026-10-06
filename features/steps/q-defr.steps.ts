// UI/UX steps for @H-01-q-defr (DE/FR /q chrome). Owner: UI/UX.
// Needs the built site: `bun run build && APERTUS_MOCK=1 bun run serve`.
import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from 'playwright'
import assert from 'node:assert/strict'
import { encodeConfig } from '../../packages/core/src/index.ts'
import { launchBrowser } from '../../sim/lib.ts'
import { ALSO_DE_FR, collectUiText, englishIn } from '../../sim/noEnglish.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'

type World = {
  locale?: string
  encoded?: string
  visitor?: { ctx: BrowserContext; page: Page }
}

let shared: Browser | undefined
const browser = async () => (shared ??= await launchBrowser())

function swissConfig(locale: string) {
  const lang = locale.toLowerCase().startsWith('de') ? 'de' : 'fr'
  return {
    v: 1 as const,
    id: `swiss-${lang}`,
    locale,
    currency: 'CHF',
    title: lang === 'de' ? 'Umzug in Lugano' : 'Nettoyage de fin de bail',
    business: {
      name: lang === 'de' ? 'Muster Umzüge' : 'Nettoyage Dupont',
      whatsapp: '41791234567',
      email: 'info@example.ch',
    },
    fields: lang === 'de'
      ? [
          { id: 'volumen', type: 'number' as const, label: 'Volumen', unit: 'm³', min: 1, max: 200, step: 1, default: 20 },
          { id: 'etage', type: 'choice' as const, label: 'Stockwerk', options: [{ label: 'Erdgeschoss', value: 0 }, { label: '3. Stock', value: 3 }], default: 1 },
          { id: 'lift', type: 'toggle' as const, label: 'Ohne Lift', on: 20, off: 0, default: true },
        ]
      : [
          { id: 'pieces', type: 'number' as const, label: 'Nombre de pièces', min: 1, max: 12, step: 1, default: 3 },
          { id: 'etat', type: 'choice' as const, label: 'État du logement', options: [{ label: 'Bon', value: 1 }, { label: 'Très sale', value: 1.5 }], default: 0 },
          { id: 'vitres', type: 'toggle' as const, label: 'Vitres incluses', on: 80, off: 0, default: true },
        ],
    formula: lang === 'de' ? 'max(300, volumen * 45 + etage * 20 + lift)' : 'pieces * 180 * etat + vitres',
    range: { low: 0.9, high: 1.1 },
    rounding: 10,
    vat: { rate: 8.1, pricesInclude: false, show: true },
  }
}

After({ tags: '@H-01-q-defr' }, async function (this: World) {
  await this.visitor?.ctx.close()
  this.visitor = undefined
})
AfterAll(async () => { await shared?.close(); shared = undefined })

Given('a {string} share calculator', function (this: World, locale: string) {
  this.locale = locale
  this.encoded = encodeConfig(swissConfig(locale) as Parameters<typeof encodeConfig>[0])
})

When('a visitor opens the share link on a {int}x{int} screen', async function (this: World, width: number, height: number) {
  assert.ok(this.encoded, 'no encoded config')
  const ctx = await (await browser()).newContext({ viewport: { width, height } })
  this.visitor = { ctx, page: await ctx.newPage() }
  await this.visitor.page.goto(`${BASE}/q#c=${this.encoded}`)
  await this.visitor.page.locator('[data-testid="share-widget"] [data-testid="ql-result-high"]').waitFor()
  await this.visitor.page.locator('[data-testid="msg-lang-it"]').waitFor()
})

Then('the share page is in {string} with no English text', async function (this: World, lang: string) {
  assert.ok(this.visitor)
  const p = this.visitor.page
  assert.equal(await p.evaluate(() => document.documentElement.lang), lang)
  const items = await collectUiText(p)
  const hits = englishIn(items, ALSO_DE_FR)
  assert.deepEqual(hits, [], `English on /q (${lang}):\n${hits.map((h) => `  "${h.word}" in ${h.source}: ${h.text}`).join('\n')}`)
})
