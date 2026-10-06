// D-004c proof: a simulated Italian painter at 390 and 1440 builds from imbianchino-it, hits a
// WhatsApp and a formula error, shares, and opens the share link. Screenshots go to proof/d004c-*.png;
// every screen is run through the "no English" scanner and the counts are printed.
// Run against the built site: `bun run build && APERTUS_MOCK=1 bun run serve`, then `bun sim/d004c-proof.ts`.
import type { Page } from 'playwright'
import { launchBrowser } from './lib.ts'
import { collectUiText, englishIn } from './noEnglish.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const OUT = new URL('../proof/', import.meta.url).pathname
const browser = await launchBrowser()
const tid = (p: Page, id: string) => p.locator(`[data-testid="${id}"]`)
let failed = false

async function scan(p: Page, label: string) {
  const items = await collectUiText(p)
  const hits = englishIn(items)
  const shadow = items.filter((i) => i.source.includes('::shadow')).length
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${label}: ${items.length} strings scanned (${shadow} in widget shadow DOM), English hits: ${hits.length}, horizontal overflow ${overflow}px`)
  if (overflow > 0) failed = true
  for (const h of hits) console.log(`  "${h.word}" in ${h.source}: ${h.text}`)
  if (hits.length) failed = true
}

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'it-IT', permissions: ['clipboard-read', 'clipboard-write'] })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/build?template=imbianchino-it`)
  await tid(p, 'preview').locator('[data-testid="ql-result-high"]').waitFor()
  await p.locator('[data-testid="business-name"]').fill('Rossi Tinteggiature')
  await p.waitForTimeout(300)
  await scan(p, `/build IT ${w}`)
  await p.screenshot({ path: `${OUT}d004c-build-${w}.png`, fullPage: w > 400 })

  // Error state: a short WhatsApp number and an unknown name in the formula.
  await tid(p, 'business-whatsapp').fill('333')
  await tid(p, 'formula').fill('mq * prezzo_inesistente')
  await tid(p, 'formula-error').waitFor()
  await scan(p, `/build IT errors ${w}`)
  if (w < 400) {
    await tid(p, 'business-whatsapp').scrollIntoViewIfNeeded()
    await p.screenshot({ path: `${OUT}d004c-build-error-wa-${w}.png` })
    // Instant scroll (the page uses smooth scrolling) so the shot is not taken mid-scroll.
    await p.evaluate(() => {
      const r = document.querySelector('[data-testid="formula"]')!.getBoundingClientRect()
      window.scrollTo({ top: r.top + window.scrollY - 160, behavior: 'instant' })
    })
    await p.waitForTimeout(500)
    await p.screenshot({ path: `${OUT}d004c-build-error-${w}.png` })
  } else {
    await p.screenshot({ path: `${OUT}d004c-build-error-${w}.png`, fullPage: true })
  }

  // Fix and share.
  await tid(p, 'formula').fill('max(150, (mq * 3 * colore * altezza + antimuffa * 3) * arredato)')
  await tid(p, 'business-whatsapp').fill('+39 333 123 4567')
  await tid(p, 'copy-link').click()
  const link = await p.evaluate(() => navigator.clipboard.readText())
  await scan(p, `/build IT shared ${w}`)

  const c2 = await browser.newContext({ viewport: { width: w, height: h }, locale: 'it-IT' })
  const q = await c2.newPage()
  await q.goto(link.replace(/^https?:\/\/[^/]+/, BASE))
  await q.locator('[data-testid="share-widget"] [data-testid="ql-result-high"]').waitFor()
  await q.waitForTimeout(300)
  await scan(q, `/q IT ${w}`)
  await q.screenshot({ path: `${OUT}d004c-share-${w}.png`, fullPage: w > 400 })
  await c2.close()

  // Control: the EN builder must trip the scanner, or the check is not looking.
  if (w > 400) {
    const c3 = await browser.newContext({ viewport: { width: w, height: h } })
    const e = await c3.newPage()
    await e.goto(`${BASE}/build`)
    await e.locator('h1').waitFor()
    const hits = englishIn(await collectUiText(e))
    console.log(`control /build EN ${w}: English hits ${hits.length} (expected > 0)`)
    if (!hits.length) failed = true
    await c3.close()
  }
  await ctx.close()
}
await browser.close()
console.log(failed ? 'FAIL' : 'OK')
process.exit(failed ? 1 : 0)
